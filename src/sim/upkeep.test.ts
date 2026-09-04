import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { ROAD_TYPES } from '../data/roads';

function findLandTiles(w: World, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.layers.water.length && out.length < count; i++) {
    if (w.layers.water[i] === 0 && w.roads[i] === 0) out.push(i);
  }
  return out;
}

function toXY(w: World, idx: number): { x: number; y: number } {
  return { x: idx % w.width, y: Math.floor(idx / w.width) };
}

describe('M2.5 Unterhaltskosten', () => {
  it('neue Welt hat keine Unterhaltskosten', () => {
    const w = new World(42, 128, 128);
    expect(w.upkeepPerTick).toBe(0);
  });

  it('Strassen erzeugen Unterhalt, Abriss senkt ihn', () => {
    const w = new World(42, 128, 128);
    const tiles = findLandTiles(w, 3);
    for (const [n, idx] of tiles.entries()) {
      const { x, y } = toXY(w, idx);
      const road = ROAD_TYPES[n]!;
      w.enqueue({ kind: 'buildRoad', x, y, road: road.id });
      w.update();
    }
    const expected = ROAD_TYPES.reduce((acc, r) => acc + r.upkeepPerTick, 0);
    expect(w.upkeepPerTick).toBeCloseTo(expected, 9);

    const first = toXY(w, tiles[0]!);
    w.enqueue({ kind: 'demolishRoad', x: first.x, y: first.y });
    w.update();
    expect(w.upkeepPerTick).toBeCloseTo(expected - ROAD_TYPES[0]!.upkeepPerTick, 9);
  });

  it('Unterhalt wird pro Tick von der Kasse abgezogen', () => {
    const w = new World(42, 128, 128);
    const [idx] = findLandTiles(w, 1);
    const { x, y } = toXY(w, idx!);
    const road = ROAD_TYPES[0]!;
    w.enqueue({ kind: 'buildRoad', x, y, road: road.id });
    w.update();
    const afterBuild = w.treasury;

    for (let t = 0; t < 10; t++) w.update();
    expect(w.treasury).toBeCloseTo(afterBuild - 10 * road.upkeepPerTick, 9);
  });

  it('Unterhalt ändert nichts an der Determinismus-Garantie', () => {
    const build = (): World => {
      const w = new World(9, 128, 128);
      const tiles = findLandTiles(w, 5);
      for (const [n, idx] of tiles.entries()) {
        const { x, y } = toXY(w, idx);
        w.enqueue({ kind: 'buildRoad', x, y, road: (n % 3) + 1 });
      }
      w.update();
      for (let t = 0; t < 50; t++) w.update();
      return w;
    };
    const a = build();
    const b = build();
    expect(equalWorlds(a, b)).toBe(true);
    expect(b.treasury).toBeCloseTo(a.treasury, 12);
  });

  it('Unterhalt überlebt den Savegame-Roundtrip (via Kassenstand)', () => {
    const w = new World(42, 128, 128);
    const tiles = findLandTiles(w, 2);
    for (const idx of tiles) {
      const { x, y } = toXY(w, idx);
      w.enqueue({ kind: 'buildRoad', x, y, road: 2 });
    }
    w.update();
    const before = w.treasury;
    const restored = World.fromJson(w.toJson());
    for (let t = 0; t < 5; t++) restored.update();
    // Kasse fällt im geladenen Savegame mit demselben Unterhalt weiter
    expect(restored.treasury).toBeCloseTo(before - 5 * 2 * ROAD_TYPES[1]!.upkeepPerTick, 9);
  });
});
