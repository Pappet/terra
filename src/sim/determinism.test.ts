/**
 * M0-Kernnachweis: Gleicher Seed + gleiche Aktionsliste = identischer
 * Weltzustand nach 1000 Ticks – einmal direkt getaktet, einmal über den
 * SimLoop mit manueller Uhr. Der Loop darf am Ergebnis nichts ändern.
 */
import { describe, expect, it } from 'vitest';
import { SimLoop } from './loop';
import type { GameAction } from './actions';
import { World, equalWorlds } from './world';

const SEED = 0xc0ffee;
const TICKS = 1000;

interface ScriptEntry {
  tick: number;
  action: GameAction;
}

/** Deterministisch erzeugte Aktionsliste (kein Math.random – auch hier nicht). */
function buildScript(offset: number): ScriptEntry[] {
  const entries: ScriptEntry[] = [];
  for (let i = 0; i < 25; i++) {
    entries.push({
      tick: (i * 37 + offset) % 995,
      action: {
        kind: 'paintTile',
        x: (i * 11 + 3) % 32,
        y: (i * 7 + 5) % 32,
        tile: (i % 4) + 1,
      },
    });
  }
  entries.push({ tick: 500, action: { kind: 'paintTile', x: 3, y: 3, tile: 4 } });
  entries.push({ tick: 501, action: { kind: 'paintTile', x: -5, y: 3, tile: 1 } });
  return entries.sort((a, b) => a.tick - b.tick);
}

function drainDue(script: ScriptEntry[], next: { i: number }, world: World): void {
  while (next.i < script.length && script[next.i]!.tick === world.tick) {
    world.enqueue(script[next.i]!.action);
    next.i++;
  }
}

function runDirect(script: ScriptEntry[]): World {
  const world = new World(SEED, 32, 32);
  const next = { i: 0 };
  for (let i = 0; i < TICKS; i++) {
    drainDue(script, next, world);
    world.update();
  }
  return world;
}

function runLooped(script: ScriptEntry[]): World {
  const world = new World(SEED, 32, 32);
  let clockMs = 0;
  const loop = new SimLoop(world, { now: () => clockMs, ticksPerSecond: 20 });
  loop.update(); // Warm-up (First-Frame-Guard)
  const next = { i: 0 };
  const frameMs = 50; // 50 ms pro Frame -> 1000 Frames -> 1000 Ticks
  for (let frame = 0; frame < 1000; frame++) {
    clockMs += frameMs;
    drainDue(script, next, world);
    loop.update();
  }
  expect(world.tick).toBe(TICKS);
  return world;
}

/** Zählt Tiles, die gegenüber der frisch generierten Welt abweichen (bemalt). */
function countPainted(world: World): number {
  const fresh = new World(SEED, 32, 32);
  let painted = 0;
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i] !== fresh.tiles[i]) painted++;
  }
  return painted;
}

describe('M0-Determinismus: 1000 Ticks', () => {
  it('gleicher Seed + gleiche Aktionsliste -> identischer Weltzustand (direkt vs. Loop)', () => {
    const script = buildScript(0);
    const direct = runDirect(script);
    const looped = runLooped(script);
    expect(direct.tick).toBe(TICKS);
    expect(equalWorlds(direct, looped)).toBe(true);
    expect(looped.toJson()).toBe(direct.toJson());
    // Der Test darf nicht trivial grün sein: Es muss tatsächlich gemalt worden sein.
    expect(countPainted(direct)).toBeGreaterThan(10);
  });

  it('Savegame-Roundtrip bleibt im deterministischen Lauf identisch', () => {
    const script = buildScript(0);
    const direct = runDirect(script);
    const reloaded = World.fromJson(direct.toJson());
    expect(equalWorlds(direct, reloaded)).toBe(true);
  });

  it('eine abweichende Aktionsliste führt zu einem anderen Weltzustand', () => {
    const a = runDirect(buildScript(0));
    const b = runDirect(buildScript(0));
    // gleiche Liste, aber andere Tile-Werte -> anderer Endzustand
    const variant = buildScript(0).map((e) =>
      e.action.kind === 'paintTile'
        ? { tick: e.tick, action: { kind: 'paintTile' as const, x: e.action.x, y: e.action.y, tile: (e.action.tile % 4) + 1 } }
        : e,
    );
    const c = runDirect(variant);
    expect(equalWorlds(a, b)).toBe(true);
    expect(equalWorlds(a, c)).toBe(false);
  });
});
