import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { ROAD_BY_ID, ROAD_TYPES } from '../data/roads';

function worldWithLand(): { w: World; landIdx: number } {
  const w = new World(42, 128, 128);
  for (let i = 0; i < w.layers.water.length; i++) {
    if (w.layers.water[i] === 0) return { w, landIdx: i };
  }
  throw new Error('Testwelt ohne Land');
}

function waterIdxOf(w: World): number {
  for (let i = 0; i < w.layers.water.length; i++) {
    if (w.layers.water[i] === 1) return i;
  }
  throw new Error('Testwelt ohne Wasser');
}

describe('Strassen (M2.1)', () => {
  it('Bau auf Land kostet und setzt den Strassentyp', () => {
    const { w, landIdx } = worldWithLand();
    const road = ROAD_TYPES[0]!;
    const before = w.treasury;
    w.enqueue({ kind: 'buildRoad', x: landIdx % w.width, y: Math.floor(landIdx / w.width), road: road.id });
    w.update();
    expect(w.roads[landIdx]).toBe(road.id);
    expect(w.treasury).toBeCloseTo(before - road.buildCost, 9);
    expect(w.lastRejected).toBeNull();
  });

  it('Bau auf Wasser wird abgelehnt (letzter Grund sichtbar, keine Kosten)', () => {
    const w = new World(42, 128, 128);
    const waterIdx = waterIdxOf(w);
    const before = w.treasury;
    w.enqueue({ kind: 'buildRoad', x: waterIdx % w.width, y: Math.floor(waterIdx / w.width), road: 1 });
    w.update();
    expect(w.roads[waterIdx]).toBe(0);
    expect(w.treasury).toBe(before);
    expect(w.lastRejected).toMatch(/Wasser/);
  });

  it('zu wenig Kasse: Bau wird abgelehnt', () => {
    const { w, landIdx } = worldWithLand();
    w.treasury = 1;
    w.enqueue({ kind: 'buildRoad', x: landIdx % w.width, y: Math.floor(landIdx / w.width), road: 3 });
    w.update();
    expect(w.roads[landIdx]).toBe(0);
    expect(w.lastRejected).toMatch(/Kasse/);
  });

  it('Ausbau gleicher Stelle auf anderen Typ kostet erneut; gleiches Typ kostet nichts', () => {
    const { w, landIdx } = worldWithLand();
    const x = landIdx % w.width;
    const y = Math.floor(landIdx / w.width);
    const path = ROAD_TYPES[0]!;
    const road = ROAD_TYPES[1]!;
    w.enqueue({ kind: 'buildRoad', x, y, road: path.id });
    w.update();
    const afterPath = w.treasury;
    w.enqueue({ kind: 'buildRoad', x, y, road: path.id });
    w.update();
    expect(w.treasury).toBe(afterPath); // bereits so -> keine Kosten
    w.enqueue({ kind: 'buildRoad', x, y, road: road.id });
    w.update();
    expect(w.roads[landIdx]).toBe(road.id);
    expect(w.treasury).toBeCloseTo(afterPath - road.buildCost, 9);
  });

  it('Abriss entfernt die Strasse ohne Erstattung', () => {
    const { w, landIdx } = worldWithLand();
    const x = landIdx % w.width;
    const y = Math.floor(landIdx / w.width);
    w.enqueue({ kind: 'buildRoad', x, y, road: 1 });
    w.update();
    const afterBuild = w.treasury;
    w.enqueue({ kind: 'demolishRoad', x, y });
    w.update();
    expect(w.roads[landIdx]).toBe(0);
    expect(w.treasury).toBe(afterBuild);
  });

  it('alle Strassentypen sind baubar und im Savegame stabil', () => {
    const w = new World(42, 128, 128);
    let placed = 0;
    let searchFrom = 0;
    for (const road of ROAD_TYPES) {
      for (let i = searchFrom; i < w.layers.water.length; i++) {
        if (w.layers.water[i] === 0 && w.roads[i] === 0) {
          w.enqueue({ kind: 'buildRoad', x: i % w.width, y: Math.floor(i / w.width), road: road.id });
          placed++;
          searchFrom = i + 1;
          break;
        }
      }
    }
    expect(placed).toBe(ROAD_TYPES.length);
    w.update();
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    for (const road of ROAD_TYPES) {
      expect(restored.roads.includes(road.id)).toBe(true);
    }
    expect(restored.roads.length).toBe(w.roads.length);
    expect(ROAD_BY_ID.size).toBe(ROAD_TYPES.length);
  });

  it('Determinismus: gleiche Bau-Liste -> identische Welt inkl. Kasse', () => {
    const build = (): World => {
      const w = new World(9, 128, 128);
      let placed = 0;
      for (let i = 0; i < w.layers.water.length && placed < 30; i += 3) {
        if (w.layers.water[i] === 0) {
          w.enqueue({ kind: 'buildRoad', x: i % w.width, y: Math.floor(i / w.width), road: (placed % 3) + 1 });
          placed++;
        }
        if (placed % 5 === 0) w.update();
      }
      for (let t = 0; t < 10; t++) w.update();
      return w;
    };
    expect(build().toJson()).toBe(build().toJson());
  });
});
