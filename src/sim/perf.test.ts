import { describe, expect, it } from 'vitest';
import { World } from './world';
import { cohortIndex } from './population';
import { CITIES } from '../data/cities';

/**
 * M5.5 Performance-Review: 512er-Karte, 10 Städte mit Gebäuden, Straßen,
 * Bevölkerung und aktiver Produktion. Budget: 16 ms pro Sim-Tick.
 */
describe('M5.5 Performance', () => {
  it('100 Ticks mit 10 Städten bleiben klar unter 16 ms/Tick', () => {
    const w = new World(42, 512, 512);

    // 10 Stadtstandorte: Landtiles mit 12+ Tiles Abstand zueinander (gierig)
    const spots: Array<{ x: number; y: number }> = [];
    for (let idx = 0; idx < w.tiles.length && spots.length < 10; idx++) {
      if (w.layers.water[idx] !== 0) continue;
      const x = idx % w.width;
      const y = Math.floor(idx / w.width);
      let far = true;
      for (const s of spots) {
        if (Math.hypot(s.x - x, s.y - y) < CITIES.maxZoneDistance) {
          far = false;
          break;
        }
      }
      if (far) spots.push({ x, y });
    }
    expect(spots.length).toBe(10);

    // Pro Stadt: Gründung, Straßenkreuz, 5 Gebäude (an Straßen), 60 Einwohner
    for (const [c, s] of spots.entries()) {
      const cityId = c + 1;
      w.enqueue({ kind: 'foundCity', x: s.x, y: s.y, name: `Stadt ${cityId}` });
      w.update();
      // Straßenkreuz um das Zentrum (gibt Anschluss für Nachbar-Tiles)
      for (const [dx, dy] of [[1, 0], [2, 0], [0, 1], [0, 2], [1, 1]] as const) {
        const x = s.x + dx;
        const y = s.y + dy;
        if (x < w.width && y < w.height && w.layers.water[y * w.width + x] === 0) {
          w.enqueue({ kind: 'buildRoad', x, y, road: 2 });
        }
      }
      w.update();
      // Gebäude mit Anschluss: rechts/unterhalb der Straßen (Land vorausgesetzt)
      let built = 0;
      for (const [dx, dy] of [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]] as const) {
        if (built >= 5) break;
        const x = s.x + dx;
        const y = s.y + dy;
        if (x >= w.width || y >= w.height) continue;
        const idx = y * w.width + x;
        if (w.layers.water[idx] !== 0 || w.roads[idx] !== 0 || w.buildingIndex[idx] !== 0) continue;
        // Anschluss? 4er-Nachbarschaft mit Straße
        const neighbours = [idx - 1, idx + 1, idx - w.width, idx + w.width].filter(
          (n) => n >= 0 && n < w.tiles.length,
        );
        if (!neighbours.some((n) => (w.roads[n] ?? 0) !== 0)) continue;
        const type = built < 3 ? 1 : 3; // 3 Wohnen + 2 Industrie
        const recipe = built < 3 ? -1 : 0; // Industrie: Holzfäller (falls Wald) — sonst egal fürs Budget
        w.addBuildingAt(cityId, x, y, type, recipe);
        built++;
      }
      w.settleResidents(cityId, cohortIndex(1, 0, 0), 60);
      w.update();
    }

    // 250 Ticks inkl. mindestens einem Demografie-/Migrations-/Zuweisungs-Intervall:
    // Durchschnitt UND teuerster Einzeltick messen (Intervall-Tick ist der Peak).
    const ticks = 250;
    let maxTickMs = 0;
    const t0 = performance.now();
    for (let t = 0; t < ticks; t++) {
      const tStart = performance.now();
      w.update();
      maxTickMs = Math.max(maxTickMs, performance.now() - tStart);
    }
    const perTickMs = (performance.now() - t0) / ticks;
    console.log(
      `[perf] ${ticks} Ticks: ${perTickMs.toFixed(3)} ms/Tick avg, ${maxTickMs.toFixed(3)} ms max (Budget 16), Gebäude ${w.buildings.count}`,
    );
    expect(perTickMs).toBeLessThan(16);
    expect(maxTickMs).toBeLessThan(16);
  }, 60_000);
});
