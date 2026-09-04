import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { GROWTH } from '../data/cities';

/**
 * Deterministisches Setup: Stadt + Strasse + gezontes Tile mit Anschluss.
 * Liefert die Indizes von (zonenTile, strassenTile).
 */
function setupConnectedCity(seed: number, zone: number): { w: World; zoneIdx: number; roadIdx: number } {
  const w = new World(seed, 128, 128);
  // Stadt am ersten Landtile gründen
  let center = -1;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.layers.water[i] === 0) {
      center = i;
      break;
    }
  }
  const cx = center % w.width;
  const cy = Math.floor(center / w.width);
  w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'Test' });
  w.update();

  // Landtile nahe Zentrum suchen, dessen nördlicher/südlicher Nachbar ebenfalls Land ist
  let zoneIdx = -1;
  let roadIdx = -1;
  for (let dy = -4; dy <= 4 && zoneIdx < 0; dy++) {
    for (let dx = -4; dx <= 4 && zoneIdx < 0; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w.width - 1 || y >= w.height - 1) continue;
      const idx = y * w.width + x;
      const below = idx + w.width;
      if (w.layers.water[idx] === 0 && w.layers.water[below] === 0 && w.roads[idx] === 0 && w.roads[below] === 0) {
        zoneIdx = idx;
        roadIdx = below;
      }
    }
  }
  expect(zoneIdx).toBeGreaterThanOrEqual(0);
  w.enqueue({ kind: 'buildRoad', x: roadIdx % w.width, y: Math.floor(roadIdx / w.width), road: 1 });
  w.enqueue({ kind: 'paintZone', x: zoneIdx % w.width, y: Math.floor(zoneIdx / w.width), zone });
  w.update();
  return { w, zoneIdx, roadIdx };
}

describe('M3.4 Wachstum/Verfall', () => {
  it('angeschlossenes Wohngebiet baut Häuser; Stadt wächst von selbst', () => {
    const { w, zoneIdx } = setupConnectedCity(42, 1);
    const x = zoneIdx % w.width;
    const y = Math.floor(zoneIdx / w.width);
    for (let t = 0; t < 300 && w.buildings.count === 0; t++) w.update();
    expect(w.buildings.count).toBeGreaterThan(0);
    expect(w.buildings.cityId[0]).toBe(1);
    expect(w.buildings.type[0]).toBe(1);
    // Das Gebäude steht auf dem gezonten Tile
    expect(w.buildingIndex[zoneIdx]).toBe(1);
    void x;
    void y;
  });

  it('ohne Strassenanschluss wird nicht gebaut', () => {
    const w = new World(42, 128, 128);
    // Stadt + Zone ohne jede Strasse
    let center = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        center = i;
        break;
      }
    }
    const cx = center % w.width;
    const cy = Math.floor(center / w.width);
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'Einsam' });
    w.update();
    w.enqueue({ kind: 'paintZone', x: cx + 2, y: cy, zone: 1 });
    w.update();
    for (let t = 0; t < 400; t++) w.update();
    expect(w.buildings.count).toBe(0);
  });

  it('Gebäude ohne Anschluss verfallen und verschwinden; Zone wird wieder Bauland', () => {
    const { w, zoneIdx } = setupConnectedCity(42, 1);
    // Isolierte Zone: Landtile nahe Zentrum ohne Strassennachbar
    const cx = w.cities.x[0] as number;
    const cy = w.cities.y[0] as number;
    let isolated = -1;
    for (let dy = -4; dy <= 4 && isolated < 0; dy++) {
      for (let dx = -4; dx <= 4 && isolated < 0; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const idx = y * w.width + x;
        if (x < 1 || y < 1 || x >= w.width - 1 || y >= w.height - 1) continue;
        if (w.layers.water[idx] !== 0 || w.roads[idx] !== 0 || w.zoneType[idx] !== 0) continue;
        const neighbours = [idx - 1, idx + 1, idx - w.width, idx + w.width];
        if (neighbours.some((n) => n >= 0 && (w.roads[n] ?? 0) !== 0)) continue;
        isolated = idx;
      }
    }
    expect(isolated).toBeGreaterThanOrEqual(0);
    w.enqueue({ kind: 'paintZone', x: isolated % w.width, y: Math.floor(isolated / w.width), zone: 1 });
    w.update();
    void zoneIdx;
    w.addBuildingAt(1, isolated % w.width, Math.floor(isolated / w.width), 1);
    expect(w.buildings.count).toBe(1);
    for (let t = 0; t < 100; t++) w.update();
    // Das isolierte Gebäude ist verfallen (andere können via Anschluss existieren)
    expect(w.buildingIndex[isolated]).toBe(0);
    // Zone besteht: Tile ist wieder Bauland (erneut bebaubar)
    expect(w.zoneType[isolated]).toBe(1);
    expect(() => w.addBuildingAt(1, isolated % w.width, Math.floor(isolated / w.width), 1)).not.toThrow();
    expect(w.cityZoneTiles[0]).not.toContain(isolated);
  });

  it('Nachfragekette: Häuser ziehen Gewerbe/Industrie nach (wenn gezont)', () => {
    // Zwei R-Zonen + eine I-Zone, alle angeschlossen
    const { w, zoneIdx, roadIdx } = setupConnectedCity(42, 1);
    // Weitere Tiles neben der Strasse zonen (R und I)
    const cx = w.cities.x[0] as number;
    const cy = w.cities.y[0] as number;
    const roadX = roadIdx % w.width;
    const roadY = Math.floor(roadIdx / w.width);
    let zoned = 0;
    for (let dy = -3; dy <= 3 && zoned < 2; dy++) {
      for (let dx = -3; dx <= 3 && zoned < 2; dx++) {
        const x = roadX + dx;
        const y = roadY + dy;
        const idx = y * w.width + x;
        if (idx === zoneIdx) continue;
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
        if (w.layers.water[idx] !== 0 || w.roads[idx] !== 0 || w.zoneType[idx] !== 0) continue;
        if (Math.hypot(x - cx, y - cy) > 14) continue;
        // Anschluss? Nachbar ist die Strasse nur für Tiles neben roadIdx:
        const neighbours = [idx - 1, idx + 1, idx - w.width, idx + w.width];
        if (!neighbours.some((n) => n >= 0 && (w.roads[n] ?? 0) !== 0)) continue;
        w.enqueue({ kind: 'paintZone', x, y, zone: zoned === 0 ? 1 : 3 });
        zoned++;
      }
    }
    expect(zoned).toBe(2);
    for (let t = 0; t < 1200; t++) w.update();

    const types = new Set<number>();
    for (let i = 0; i < w.buildings.count; i++) types.add(w.buildings.type[i] ?? 0);
    expect(types.has(1)).toBe(true); // Wohnen entstanden
    expect(types.has(3)).toBe(true); // Industrie folgte auf Einwohner
    expect(w.buildings.count).toBeGreaterThanOrEqual(3);
  });

  it('Wachstum ist deterministisch', () => {
    const run = (): World => {
      const { w } = setupConnectedCity(7, 1);
      // 3 R-Zonen rund um die Strasse zusätzlich
      for (let t = 0; t < 500; t++) w.update();
      return w;
    };
    const a = run();
    const b = run();
    expect(equalWorlds(a, b)).toBe(true);
  });

  it('maxConstructionsPerCityPerTick wird respektiert', () => {
    const { w } = setupConnectedCity(42, 1);
    // Viele angeschlossene R-Zonen
    const roadIdx = w.cityZoneTiles.length; // Platzhalter-Vermeidung: Strasse suchen
    void roadIdx;
    let roadTile = -1;
    for (let i = 0; i < w.roads.length; i++) {
      if ((w.roads[i] ?? 0) !== 0) {
        roadTile = i;
        break;
      }
    }
    const rx = roadTile % w.width;
    const ry = Math.floor(roadTile / w.width);
    let zoned = 0;
    for (let dy = -2; dy <= 2 && zoned < 6; dy++) {
      for (let dx = -2; dx <= 2 && zoned < 6; dx++) {
        const x = rx + dx;
        const y = ry + dy;
        const idx = y * w.width + x;
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
        if (w.layers.water[idx] !== 0 || w.roads[idx] !== 0 || w.zoneType[idx] !== 0) continue;
        w.enqueue({ kind: 'paintZone', x, y, zone: 1 });
        zoned++;
      }
    }
    w.update();
    const before = w.buildings.count;
    w.update(); // genau ein Wachstums-Tick
    expect(w.buildings.count - before).toBeLessThanOrEqual(GROWTH.maxConstructionsPerCityPerTick);
  });
});
