import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { CITIES, ZONE_TYPES } from '../data/cities';

function foundTwo(w: World): number {
  let placed = 0;
  for (let i = 0; i < w.tiles.length && placed < 1; i++) {
    if (w.layers.water[i] === 0) {
      w.enqueue({ kind: 'foundCity', x: i % w.width, y: Math.floor(i / w.width), name: 'Aurelia' });
      w.update();
      placed++;
    }
  }
  return w.cities.count;
}

function landNearCenter(w: World, within: number): { x: number; y: number } {
  const cx = w.cities.x[0] as number;
  const cy = w.cities.y[0] as number;
  for (let dy = -within; dy <= within; dy++) {
    for (let dx = -within; dx <= within; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
      const idx = y * w.width + x;
      if (w.layers.water[idx] === 0 && w.roads[idx] === 0) return { x, y };
    }
  }
  throw new Error('kein zonierbares Land nahe dem Zentrum');
}

describe('M3.2 Zonen', () => {
  it('Zone nahe der Stadt wird gesetzt und der Stadt zugeordnet', () => {
    const w = new World(42, 128, 128);
    expect(foundTwo(w)).toBe(1);
    const spot = landNearCenter(w, CITIES.maxZoneDistance);
    w.enqueue({ kind: 'paintZone', x: spot.x, y: spot.y, zone: ZONE_TYPES.residential });
    w.update();
    const idx = spot.y * w.width + spot.x;
    expect(w.zoneType[idx]).toBe(ZONE_TYPES.residential);
    expect(w.zoneCity[idx]).toBe(1);
  });

  it('Zone ausserhalb des Stadtgebiets wird abgelehnt', () => {
    const w = new World(42, 128, 128);
    expect(foundTwo(w)).toBe(1);
    const cx = w.cities.x[0] as number;
    const cy = w.cities.y[0] as number;
    // Punkt weit weg suchen
    let far: { x: number; y: number } | null = null;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] !== 0) continue;
      const x = i % w.width;
      const y = Math.floor(i / w.width);
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > CITIES.maxZoneDistance + 5) {
        far = { x, y };
        break;
      }
    }
    expect(far).not.toBeNull();
    w.enqueue({ kind: 'paintZone', x: far!.x, y: far!.y, zone: ZONE_TYPES.industrial });
    w.update();
    expect(w.lastRejected).toMatch(/Stadtgebiet/);
    const idx = far!.y * w.width + far!.x;
    expect(w.zoneType[idx]).toBe(0);
  });

  it('Zone auf Wasser wird abgelehnt', () => {
    const w = new World(42, 128, 128);
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 1) {
        w.enqueue({ kind: 'paintZone', x: i % w.width, y: Math.floor(i / w.width), zone: 1 });
        w.update();
        break;
      }
    }
    expect(w.lastRejected).toMatch(/Wasser/);
  });

  it('Zone aufheben (0) funktioniert', () => {
    const w = new World(42, 128, 128);
    foundTwo(w);
    const spot = landNearCenter(w, CITIES.maxZoneDistance);
    w.enqueue({ kind: 'paintZone', x: spot.x, y: spot.y, zone: 2 });
    w.update();
    w.enqueue({ kind: 'paintZone', x: spot.x, y: spot.y, zone: 0 });
    w.update();
    const idx = spot.y * w.width + spot.x;
    expect(w.zoneType[idx]).toBe(0);
    expect(w.zoneCity[idx]).toBe(0);
  });

  it('Gebäude-Registrierung pflegt den Tile-Index inkl. Swap-Removal', () => {
    const w = new World(42, 128, 128);
    foundTwo(w);
    // Drei eindeutige, freie Landtiles nahe dem Zentrum sammeln
    const cx = w.cities.x[0] as number;
    const cy = w.cities.y[0] as number;
    const spots: Array<{ x: number; y: number }> = [];
    for (let dy = -CITIES.maxZoneDistance; dy <= CITIES.maxZoneDistance && spots.length < 3; dy++) {
      for (let dx = -CITIES.maxZoneDistance; dx <= CITIES.maxZoneDistance && spots.length < 3; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
        const idx = y * w.width + x;
        if (w.layers.water[idx] !== 0 || w.roads[idx] !== 0) continue;
        if (spots.some((s) => s.x === x && s.y === y)) continue;
        spots.push({ x, y });
      }
    }
    expect(spots.length).toBe(3);
    const ids = spots.map((s) => w.addBuildingAt(1, s.x, s.y, ZONE_TYPES.residential));
    expect(ids).toEqual([1, 2, 3]);
    for (const [n, s] of spots.entries()) {
      expect(w.buildingIndex[s.y * w.width + s.x]).toBe(n + 1);
    }
    // Zweites Gebäude entfernen -> drittes rückt auf ID 2, Index folgt
    w.removeBuildingAt(1);
    expect(w.buildings.count).toBe(2);
    expect(w.buildingIndex[spots[2]!.y * w.width + spots[2]!.x]).toBe(2);
    expect(w.buildingIndex[spots[0]!.y * w.width + spots[0]!.x]).toBe(1);
    expect(w.buildingIndex[spots[1]!.y * w.width + spots[1]!.x]).toBe(0);
  });

  it('Zonen + Gebäude überleben den Savegame-Roundtrip', () => {
    const w = new World(42, 128, 128);
    foundTwo(w);
    const spot = landNearCenter(w, CITIES.maxZoneDistance);
    w.enqueue({ kind: 'paintZone', x: spot.x, y: spot.y, zone: ZONE_TYPES.commercial });
    w.update();
    w.addBuildingAt(1, spot.x, spot.y, ZONE_TYPES.commercial);
    w.update(); // abgeleitete Zuweisung (commute) nachziehen
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.buildings.count).toBe(1);
    expect(restored.buildingIndex[spot.y * w.width + spot.x]).toBe(1);
    expect(restored.zoneType[spot.y * w.width + spot.x]).toBe(ZONE_TYPES.commercial);
  });

  it('unknown Zone wirft; Determinismus bleibt gewahrt', () => {
    const w = new World(42, 128, 128);
    foundTwo(w);
    const spot = landNearCenter(w, CITIES.maxZoneDistance);
    w.enqueue({ kind: 'paintZone', x: spot.x, y: spot.y, zone: 9 });
    expect(() => w.update()).toThrow(/Zone/);

    const build = (): World => {
      const w2 = new World(9, 128, 128);
      foundTwo(w2);
      const s = landNearCenter(w2, CITIES.maxZoneDistance);
      w2.enqueue({ kind: 'paintZone', x: s.x, y: s.y, zone: 3 });
      w2.update();
      return w2;
    };
    expect(build().toJson()).toBe(build().toJson());
  });
});
