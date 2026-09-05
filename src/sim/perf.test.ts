import { describe, expect, it } from 'vitest';
import { World } from './world';
import { cohortIndex } from './population';

/**
 * M9.2 Perf-Gate mit echter Last (ersetzt den M5.5-Test mit 10×5 Gebäuden):
 * 512er-Karte, 40 Städte mit Zonengitter und Straßengrid (alles in EINEM
 * Action-Batch, damit roadRev nur einmal invalidiert), gewachsen per Simulation
 * auf mindestens 2000 Gebäude und 20000 Einwohner. Erst dann werden 500 Ticks
 * gemessen — gesamt und pro Subsystem (Budget 16 ms/Tick).
 */

const TARGET_BUILDINGS = 2000;
const TARGET_RESIDENTS = 20000;
const CITY_COUNT = 40;
const REGION = 480; // Siedlungsregion (Kacheln) — ganze Karte
const MEASURE_TICKS = 500;
const BUDGET_MS = 16;
const WARMUP_TICKS = 20_000;

/** Erstes Landtile mit Randabstand, das im n×n-Quadrat genügend Land hat. */
function landBlock(w: World, centers: number[], n: number): number | null {
  const m = 16;
  for (let y = m; y < Math.min(w.height - m - n, m + REGION); y++) {
    for (let x = m; x < Math.min(w.width - m - n, m + REGION); x++) {
      const idx = y * w.width + x;
      let ok = true;
      let water = 0;
      for (const c of centers) {
        if (Math.max(Math.abs((c % w.width) - x), Math.abs(Math.floor(c / w.width) - y)) < n) ok = false;
      }
      for (let dy = 0; dy < n && ok; dy++) {
        for (let dx = 0; dx < n && ok; dx++) {
          if (w.layers.water[idx + dy * w.width + dx] !== 0) water++;
          if (water > (n * n) / 10) ok = false; // bis 10 % Wasser tolerieren
        }
      }
      if (ok) return idx;
    }
  }
  return null;
}

function totalResidents(w: World): number {
  let res = 0;
  for (let c = 1; c <= w.cities.count; c++) res += w.population.total(c);
  return res;
}

/** Erstes freie, gezonte, straßennah gelegene Tile der Stadt (zeilenweise ab Zentrum). */
function freeZoneTileNear(w: World, cityId: number, idx: number): number | null {
  const cx = idx % w.width;
  const cy = Math.floor(idx / w.width);
  for (let dy = 1; dy <= 13; dy++) {
    for (let dx = 1; dx <= 13; dx++) {
      const tile = (cy + dy) * w.width + cx + dx;
      if (w.zoneCity[tile] !== cityId) continue;
      if (w.zoneType[tile] === 0) continue;
      if (w.buildingIndex[tile] !== 0) continue;
      return tile;
    }
  }
  return null;
}

function buildScenario(): World {
  const w = new World(42, 512, 512);
  w.taxRate = 0.2;
  w.treasury = 100_000_000; // Perf-Szenario: kein Bankrott
  const r = 13;
  const centers: number[] = [];
  for (let c = 1; c <= CITY_COUNT; c++) {
    const idx = landBlock(w, centers, 28);
    if (idx === null) break;
    centers.push(idx);
    const cx = idx % w.width;
    const cy = Math.floor(idx / w.width);
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: `Perf ${c}` });
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
        if (dy % 4 === 0 || dx % 4 === 0) {
          w.enqueue({ kind: 'buildRoad', x, y, road: 2 });
        } else {
          // Wenig Industrie (Arbeitsplätze), viel Wohnen (Kapazität)
          const zone = dx >= 1 && dx <= 6 && dy >= 1 && dy <= 6 ? 3 : Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 2 : 1;
          w.enqueue({ kind: 'paintZone', x, y, zone });
        }
      }
    }
  }
  w.update(); // Ein Batch: ein roadRev++, eine Zuweisungsrechnung

  // Startbestand je Stadt: 4 Häuser, 1 Markt, 2 Industrie + Grundbevölkerung
  for (let c = 1; c <= w.cities.count; c++) {
    const idx = centers[c - 1]!;
    const starts: Array<[number, number]> = [[1, -1], [1, -1], [1, -1], [1, -1], [2, 6], [3, 0], [3, 3]];
    for (const [type, recipe] of starts) {
      const tile = freeZoneTileNear(w, c, idx);
      if (tile === null) break;
      w.addBuildingAt(c, tile % w.width, Math.floor(tile / w.width), type, recipe);
    }
    w.settleResidents(c, cohortIndex(1, 0, 0), 400);
  }
  w.update();
  return w;
}

describe('M9.2 Perf-Gate (echte Last)', () => {
  it(
    'wächst auf >= 2000 Gebäude und >= 20000 Einwohner, 500 Ticks unter 16 ms/Tick',
    () => {
      const w = buildScenario();
      expect(w.cities.count).toBeGreaterThanOrEqual(20); // genug Städte für die Zielgrösse

      // Wachstumsphase: Gebäude wachsen per Simulation (Nachfrage + Straßenanschluss)
      const tGrow0 = performance.now();
      let warmup = 0;
      while (warmup < WARMUP_TICKS) {
        w.update();
        warmup++;
        if (w.buildings.count >= TARGET_BUILDINGS && totalResidents(w) >= TARGET_RESIDENTS) break;
      }
      const growMs = performance.now() - tGrow0;
      const residents = totalResidents(w);
      console.log(
        `[perf] Wachstumsphase: 700 Ticks in ${growMs.toFixed(0)} ms -> Gebäude ${w.buildings.count}, Einwohner ${Math.round(residents)}`,
      );
      expect(w.buildings.count).toBeGreaterThanOrEqual(TARGET_BUILDINGS);
      expect(residents).toBeGreaterThanOrEqual(TARGET_RESIDENTS);

      // Messphase: 500 Ticks gesamt + pro Subsystem
      w.startProfiling();
      let maxTickMs = 0;
      const t0 = performance.now();
      for (let t = 0; t < MEASURE_TICKS; t++) {
        const tStart = performance.now();
        w.update();
        maxTickMs = Math.max(maxTickMs, performance.now() - tStart);
      }
      const totalMs = performance.now() - t0;
      const perTick = totalMs / MEASURE_TICKS;
      const subsystems = w.stopProfiling();
      const subsystemLine = Object.entries(subsystems)
        .map(([k, v]) => `${k} ${(v / MEASURE_TICKS).toFixed(3)}ms`)
        .join(', ');
      console.log(
        `[perf] ${MEASURE_TICKS} Ticks bei ${w.buildings.count} Gebäuden / ${Math.round(residents)} Einwohnern: ` +
          `${perTick.toFixed(3)} ms/Tick avg, ${maxTickMs.toFixed(3)} ms max (Budget ${BUDGET_MS})`,
      );
      console.log(`[perf] Subsysteme/Tick: ${subsystemLine}`);
      expect(perTick).toBeLessThan(BUDGET_MS);
      expect(maxTickMs).toBeLessThan(BUDGET_MS);
    },
    300_000,
  );
});
