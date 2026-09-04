/**
 * Der Weltzustand: Struct-of-Arrays, serialisierbar, komplett DOM-frei.
 *
 * Änderungsregeln:
 * - Der Weltzustand ändert sich NUR über Actions in der Warteschlange, die
 *   `update()` zu Beginn des Ticks abarbeitet.
 * - Kein Objektzeiger-Netz: Tile-Daten liegen in einem flachen Uint8Array,
 *   der RNG-Zustand ist ein uint32. Alles im Savegame landsicher abbildbar.
 */
import { applyAction, type GameAction } from './actions';
import { Rng } from './rng';
import { SIM_CONFIG } from '../data/config';
import { TILE_TYPES } from '../data/tiles';

/** JSON-Savegame-Layout (Version in SIM_CONFIG.saveVersion). */
export interface SerializedWorld {
  saveVersion: number;
  seed: number;
  tick: number;
  width: number;
  height: number;
  tiles: number[];
  rngState: number;
}

export class World {
  readonly seed: number;
  readonly width: number;
  readonly height: number;

  tick = 0;
  tiles: Uint8Array;
  /** Erhöht sich bei jeder Änderung an `tiles` – Cache-Invalidierung fürs Rendering. */
  tileRev = 0;

  private rng: Rng;
  private queue: GameAction[] = [];

  constructor(seed: number, width: number, height: number) {
    this.seed = seed >>> 0;
    this.width = width;
    this.height = height;
    this.tiles = new Uint8Array(width * height);
    this.rng = new Rng(this.seed);
  }

  /** Action einreihen; sie greift zu Beginn des nächsten update(). */
  enqueue(action: GameAction): void {
    this.queue.push(action);
  }

  /** Ein Sim-Tick: wartende Actions anwenden, dann Uhr weitersetzen. */
  update(): void {
    if (this.queue.length > 0) {
      for (const action of this.queue) {
        applyAction(this.tiles, this.width, this.height, action);
      }
      this.tileRev++;
      this.queue = [];
    }
    // Ab M1 laufen hier die eigentlichen Simulationssysteme.
    this.tick++;
  }

  get rngStateU32(): number {
    return this.rng.stateU32;
  }

  serialize(): SerializedWorld {
    return {
      saveVersion: SIM_CONFIG.saveVersion,
      seed: this.seed,
      tick: this.tick,
      width: this.width,
      height: this.height,
      tiles: Array.from(this.tiles),
      rngState: this.rng.stateU32,
    };
  }

  toJson(): string {
    return JSON.stringify(this.serialize());
  }

  static fromJson(json: string): World {
    return World.deserialize(JSON.parse(json));
  }

  /** Aus beliebigem (untrusted) JSON wiederherstellen; wirft bei Defekten. */
  static deserialize(data: unknown): World {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Savegame: kein Objekt');
    }
    const d = data as Record<string, unknown>;
    if (d.saveVersion !== SIM_CONFIG.saveVersion) {
      throw new Error(
        `Savegame-Version ${String(d.saveVersion)} wird nicht unterstützt (erwartet ${SIM_CONFIG.saveVersion})`,
      );
    }
    const seed = asUint32(d.seed, 'seed');
    const width = asUint32(d.width, 'width');
    const height = asUint32(d.height, 'height');
    const tick = asUint32(d.tick, 'tick');
    if (width === 0 || height === 0) {
      throw new Error(`Savegame: ungültige Kartengrösse ${width}x${height}`);
    }
    if (!Array.isArray(d.tiles) || d.tiles.length !== width * height) {
      const len = Array.isArray(d.tiles) ? d.tiles.length : 'kein Array';
      throw new Error(`Savegame: tiles hat Länge ${String(len)}, erwartet ${width * height}`);
    }
    const tiles = new Uint8Array(width * height);
    for (let i = 0; i < tiles.length; i++) {
      const v = d.tiles[i];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= TILE_TYPES.length) {
        throw new Error(`Savegame: ungültiger Tile-Wert an Index ${i}: ${String(v)}`);
      }
      tiles[i] = v;
    }

    const world = new World(seed, width, height);
    world.tick = tick;
    world.tiles = tiles;
    world.rng = Rng.fromState(asUint32(d.rngState, 'rngState'));
    return world;
  }
}

/**
 * Tiefe Gleichheit zweier Welten (Tests, Savegame-Verifikation).
 * Vergleicht nur Sim-Zustand; `tileRev` ist Renderer-Bookkeeping und
 * wird bewusst nicht serialisiert, daher nicht verglichen.
 */
export function equalWorlds(a: World, b: World): boolean {
  if (
    a.seed !== b.seed || a.width !== b.width || a.height !== b.height ||
    a.tick !== b.tick || a.rngStateU32 !== b.rngStateU32
  ) {
    return false;
  }
  if (a.tiles.length !== b.tiles.length) return false;
  for (let i = 0; i < a.tiles.length; i++) {
    if (a.tiles[i] !== b.tiles[i]) return false;
  }
  return true;
}

function asUint32(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Savegame: Feld "${field}" ist kein uint32: ${String(value)}`);
  }
  return value;
}
