import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';

function paintedWorld(): World {
  const w = new World(42, 8, 6);
  w.enqueue({ kind: 'paintTile', x: 1, y: 2, tile: 3 });
  w.enqueue({ kind: 'paintTile', x: 4, y: 5, tile: 4 });
  w.update();
  w.update();
  w.update();
  return w;
}

describe('World', () => {
  it('startet leer: alle Tiles 0, Tick 0', () => {
    const w = new World(7, 16, 16);
    expect(w.tick).toBe(0);
    expect(w.tiles.length).toBe(256);
    expect(w.tiles.every((t) => t === 0)).toBe(true);
  });

  it('Actions greifen zu Beginn des nächsten Ticks, nicht sofort', () => {
    const w = new World(1, 4, 4);
    w.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 2 });
    expect(w.tiles[0]).toBe(0);
    w.update();
    expect(w.tiles[0]).toBe(2);
    expect(w.tick).toBe(1);
  });

  it('mehrere Actions pro Tick, Reihenfolge bleibt erhalten (letzte gewinnt)', () => {
    const w = new World(1, 4, 4);
    w.enqueue({ kind: 'paintTile', x: 2, y: 1, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 2, y: 1, tile: 3 });
    w.update();
    expect(w.tiles[1 * 4 + 2]).toBe(3);
  });

  it('paintTile ausserhalb der Karte wird still ignoriert', () => {
    const w = new World(1, 4, 4);
    w.enqueue({ kind: 'paintTile', x: -1, y: 0, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 0, y: 4, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 4, y: 0, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 1.5, y: 0, tile: 1 });
    expect(() => w.update()).not.toThrow();
    expect(w.tiles.every((t) => t === 0)).toBe(true);
  });

  it('paintTile mit unbekanntem Tile-Typ wirft', () => {
    const w = new World(1, 4, 4);
    w.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 99 });
    expect(() => w.update()).toThrow(/Tile-Typ/);
  });

  it('tileRev zählt Änderungen, nicht Ticks', () => {
    const w = new World(1, 4, 4);
    w.update();
    w.update();
    expect(w.tileRev).toBe(0);
    w.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 1 });
    w.update();
    expect(w.tileRev).toBe(1);
    w.update();
    expect(w.tileRev).toBe(1);
  });
});

describe('Savegame-Roundtrip', () => {
  it('JSON -> Welt -> JSON ist identitätsgetreu', () => {
    const w = paintedWorld();
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.toJson()).toBe(w.toJson());
  });

  it('RNG-Zustand überlebt den Roundtrip', () => {
    const w = paintedWorld();
    const restored = World.fromJson(w.toJson());
    expect(restored.rngStateU32).toBe(w.rngStateU32);
  });

  it('deserialize verlangt die aktuelle Savegame-Version', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    data.saveVersion = 999;
    expect(() => World.deserialize(data)).toThrow(/Version/);
  });

  it('deserialize wirft bei falscher Tile-Anzahl', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    (data.tiles as number[]).pop();
    expect(() => World.deserialize(data)).toThrow(/tiles/);
  });

  it('deserialize wirft bei ungültigen Tile-Werten', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    (data.tiles as number[])[3] = 250;
    expect(() => World.deserialize(data)).toThrow(/Tile-Wert/);
  });

  it('deserialize wirft bei kaputten Skalarfeldern', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    data.tick = -5;
    expect(() => World.deserialize(data)).toThrow(/tick/);
  });

  it('equalWorlds erkennt Unterschiede', () => {
    const a = paintedWorld();
    const b = paintedWorld();
    expect(equalWorlds(a, b)).toBe(true);
    b.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 1 });
    b.update();
    expect(equalWorlds(a, b)).toBe(false);
  });
});
