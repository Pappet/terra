/**
 * Fixed-Timestep-Loop: koppelt die Sim an eine Uhr, nicht an den Renderer.
 * DOM-frei – der Browser injiziert performance.now, Tests eine manuelle Uhr
 * (DECISIONS D004). Determinismus: gleich viele update()-Aufrufe mit gleicher
 * Action-Zufuhr ergeben immer denselben Weltzustand, unabhängig vom Timing.
 */
import { SIM_CONFIG, SPEED_STEPS, type SimSpeed } from '../data/config';
import type { World } from './world';

export interface LoopOptions {
  /** Uhr in Millisekunden (Browser: performance.now; Tests: manuelle Uhr). */
  now?: () => number;
  ticksPerSecond?: number;
  maxTicksPerFrame?: number;
}

export interface LoopUpdateResult {
  /** Anzahl Ticks, die in diesem update() tatsächlich gelaufen sind. */
  ticked: number;
}

export class SimLoop {
  private readonly world: World;
  private readonly now: () => number;
  private readonly msPerTick: number;
  private readonly maxTicksPerFrame: number;

  private speedStep: SimSpeed = 1;
  private accMs = 0;
  private lastMs = 0;
  private hasPrev = false;

  constructor(world: World, opts: LoopOptions = {}) {
    this.world = world;
    this.now = opts.now ?? (() => performance.now());
    this.msPerTick = 1000 / (opts.ticksPerSecond ?? SIM_CONFIG.ticksPerSecond);
    this.maxTicksPerFrame = opts.maxTicksPerFrame ?? SIM_CONFIG.maxTicksPerFrame;
    this.lastMs = this.now();
  }

  get speed(): SimSpeed {
    return this.speedStep;
  }

  setSpeed(speed: number): void {
    if (!(SPEED_STEPS as readonly number[]).includes(speed)) {
      throw new Error(`Unbekannte Geschwindigkeitsstufe: ${String(speed)}`);
    }
    this.speedStep = speed as SimSpeed;
  }

  /**
   * Genau einen Tick erzwingen – von der UI genutzt, um Editor-Actions auch
   * bei Pause anzuwenden, ohne die Uhr laufen zu lassen.
   */
  stepOnce(): void {
    this.world.update();
  }

  /**
   * Ein Frame: verstrichene Zeit in Ticks umsetzen. Liefert, wie viele Ticks
   * gelaufen sind (Renderer-Cache-Invalidierung).
   *
   * Nach langen Pausen (Tab im Hintergrund) wird die verstrichene Zeit gekappt,
   * statt sie nachzuholen – die Sim läuft nie in eine Todesspirale.
   */
  update(): LoopUpdateResult {
    const nowMs = this.now();
    if (!this.hasPrev) {
      this.hasPrev = true;
      this.lastMs = nowMs;
      return { ticked: 0 };
    }
    const dtMs = Math.max(0, nowMs - this.lastMs);
    this.lastMs = nowMs;

    if (this.speedStep === 0) {
      this.accMs = 0;
      return { ticked: 0 };
    }

    this.accMs += Math.min(dtMs, this.maxTicksPerFrame * this.msPerTick) * this.speedStep;

    let ticked = 0;
    while (this.accMs >= this.msPerTick && ticked < this.maxTicksPerFrame) {
      this.world.update();
      this.accMs -= this.msPerTick;
      ticked++;
    }
    if (ticked >= this.maxTicksPerFrame) {
      this.accMs = 0; // Rest verwerfen, nicht aufstauen
    }
    return { ticked };
  }
}
