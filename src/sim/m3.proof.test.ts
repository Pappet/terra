/**
 * M3-DoD-Nachweis: Eine gezonte, angeschlossene Stadt wächst über die Zeit
 * von selbst; eine nicht angeschlossene (mit Startbestand) schrumpft.
 * Alles deterministisch bei gleichem Seed.
 */
import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { CITIES } from '../data/cities';

function firstLand(w: World): { x: number; y: number } {
  for (let i = 0; i < w.layers.water.length; i++) {
    if (w.layers.water[i] === 0) return { x: i % w.width, y: Math.floor(i / w.width) };
  }
  throw new Error('kein Land');
}

describe('M3-DoD: Wachstum vs. Schrumpfen', () => {
  it('angeschlossene Stadt wächst, nicht angeschlossene schrumpft (gleiche Welt, 800 Ticks)', () => {
    const w = new World(42, 128, 128);
    const first = firstLand(w);
    const cx = first.x;
    const cy = first.y;

    // Stadt A: am ersten Landtile
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'Anschluss' });
    w.update();

    // Stadt B: weit weg, ohne jede Strasse (Distanz absteigend versuchen)
    let bSpot: { x: number; y: number } | null = null;
    for (const minDist of [CITIES.maxZoneDistance * 2, CITIES.maxZoneDistance + 4, CITIES.minFoundingDistance + 2]) {
      for (let i = 0; i < w.tiles.length && bSpot === null; i++) {
        if (w.layers.water[i] !== 0) continue;
        const x = i % w.width;
        const y = Math.floor(i / w.width);
        if (Math.hypot(x - cx, y - cy) >= minDist) {
          bSpot = { x, y };
        }
      }
      if (bSpot !== null) break;
    }
    expect(bSpot).not.toBeNull();
    w.enqueue({ kind: 'foundCity', x: bSpot!.x, y: bSpot!.y, name: 'Einsam' });
    w.update();

    // Stadt A: Strasse + zwei angeschlossene Wohnzonen
    const zonesA: Array<{ x: number; y: number }> = [];
    for (let dy = -3; dy <= 3 && zonesA.length < 2; dy++) {
      for (let dx = -3; dx <= 3 && zonesA.length < 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= w.width - 1 || y >= w.height - 1) continue;
        const idx = y * w.width + x;
        if (w.layers.water[idx] !== 0 || w.roads[idx] !== 0) continue;
        const below = idx + w.width;
        if (w.layers.water[below] !== 0 || w.roads[below] !== 0) continue;
        zonesA.push({ x, y });
      }
    }
    expect(zonesA.length).toBe(2);
    for (const z of zonesA) {
      w.enqueue({ kind: 'buildRoad', x: z.x, y: z.y + 1, road: 1 });
      w.enqueue({ kind: 'paintZone', x: z.x, y: z.y, zone: 1 });
    }
    w.update();

    // Stadt B: zwei Wohnzonen + Startbestand ohne Anschluss (schrumpfen soll sichtbar werden)
    const zonesB: Array<{ x: number; y: number }> = [];
    for (let dy = -2; dy <= 2 && zonesB.length < 2; dy++) {
      for (let dx = -2; dx <= 2 && zonesB.length < 2; dx++) {
        const x = bSpot!.x + dx;
        const y = bSpot!.y + dy;
        const idx = y * w.width + x;
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
        if (w.layers.water[idx] !== 0 || w.roads[idx] !== 0) continue;
        zonesB.push({ x, y });
      }
    }
    expect(zonesB.length).toBe(2);
    for (const z of zonesB) {
      w.enqueue({ kind: 'paintZone', x: z.x, y: z.y, zone: 1 });
    }
    w.update();
    for (const z of zonesB) {
      w.addBuildingAt(2, z.x, z.y, 1); // Startbestand, kein Anschluss -> verfällt
    }
    expect(w.buildings.count).toBe(2);

    // 800 Ticks laufen lassen
    for (let t = 0; t < 800; t++) w.update();

    // Stadt A gewachsen: Gebäude in Stadt 1 vorhanden, Einwohner > 0
    const statsA = (() => {
      let houses = 0;
      for (let i = 0; i < w.buildings.count; i++) {
        if (w.buildings.cityId[i] === 1 && (w.buildings.type[i] ?? 0) === 1) houses++;
      }
      return houses;
    })();
    expect(statsA).toBeGreaterThanOrEqual(2);

    // Stadt B geschrumpft: Startbestand vollständig verfallen, kein Neubau ohne Anschluss
    let buildingsB = 0;
    for (let i = 0; i < w.buildings.count; i++) {
      if (w.buildings.cityId[i] === 2) buildingsB++;
    }
    expect(buildingsB).toBe(0);

    // Nachweislich deterministisch: identischer Lauf führt zur identischen Welt
    const replay = World.fromJson(w.toJson());
    for (let t = 0; t < 50; t++) replay.update();
    for (let t = 0; t < 50; t++) w.update();
    expect(equalWorlds(w, replay)).toBe(true);
  });
});
