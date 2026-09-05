import { describe, expect, it } from 'vitest';
import { World } from './world';
import { runDemographicsTick, computeSatisfaction } from './demographics';
import { AGE_TICK_INTERVAL, cohortIndex } from './population';
import { computeLandValue } from './landvalue';
import { effectiveFertility, averagePollution } from './pollution';
import { RECIPE_SCHOOL } from '../data/goods';
import { Rng } from './rng';

/**
 * M8-DoD-Nachweis: Jedes M8-Subsystem hat mindestens eine getestete
 * Rückkopplung in ein anderes System:
 *  1. Bodenwert -> Zufriedenheit -> Migration (M8.1)
 *  2. Bildung (Schule) -> Kohortenverteilung (M8.2)
 *  3. Verschmutzung -> Fruchtbarkeit/Bodenwert -> Zufriedenheit (M8.3)
 */

/** Erstes Landtile mit Randabstand, ab dem n horizontale Tiles Land sind. */
function landRun(w: World, n: number): number {
  const m = 16;
  for (let y = m; y < w.height - m; y++) {
    for (let x = m; x < w.width - m - n; x++) {
      const idx = y * w.width + x;
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        if (w.layers.water[idx + k] !== 0) ok = false;
      }
      if (ok) return idx;
    }
  }
  throw new Error('kein passendes Land');
}

describe('M8-DoD: Rückkopplungen', () => {
  it('Bodenwert -> Zufriedenheit -> Zuzug: Stadt mit besserer Lage wächst', () => {
    // Zwei identische Welten; Welt B hat maximale Fruchtbarkeit (höherer Bodenwert).
    const run = (fertile: boolean): number => {
      const w = new World(42, 128, 128);
      const idx = landRun(w, 5);
      const cx = idx % w.width;
      const cy = Math.floor(idx / w.width);
      w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
      w.update();
      // Straßenzeile unterhalb, vier angeschlossene Gebäude: 3 Wohnen + 1 Gewerbe
      w.enqueue({ kind: 'buildRoad', x: cx + 1, y: cy + 1, road: 2 });
      w.enqueue({ kind: 'buildRoad', x: cx + 2, y: cy + 1, road: 2 });
      w.update();
      w.addBuildingAt(1, cx + 1, cy, 1);
      w.addBuildingAt(1, cx + 2, cy, 1);
      w.addBuildingAt(1, cx + 1, cy + 2, 1);
      w.addBuildingAt(1, cx + 2, cy + 2, 2); // Gewerbe: 4 Jobs -> Vollbeschäftigung
      w.settleResidents(1, cohortIndex(1, 0, 0), 8);
      if (fertile) {
        for (let i = 0; i < w.layers.fertility.length; i++) (w.layers.fertility as Uint8Array)[i] = 255;
      }
      w.update();
      for (let t = 0; t < AGE_TICK_INTERVAL * 4; t++) w.update();
      return w.population.total(1);
    };
    const plain = run(false);
    const fertile = run(true);
    expect(fertile).toBeGreaterThan(plain); // mehr Zuzug bei besserer Lage
  });

  it('Bildung -> Kohorten: Schulstadt hat höhere Bildungsquote', () => {
    const run = (schools: number): number => {
      const w = new World(42, 128, 128);
      const idx = landRun(w, 12);
      const cx = idx % w.width;
      const cy = Math.floor(idx / w.width);
      w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
      w.update();
      w.taxRate = 0; // keine Steuer-Malus -> keine Migration im Test
      for (let s = 0; s < schools; s++) {
        w.addBuildingAt(1, cx + 1 + s, cy, 2, RECIPE_SCHOOL);
      }
      for (let k = 0; k < 12; k++) w.addBuildingAt(1, cx + 1 + k, cy + 1, 1); // Migration neutral
      // Ungebildete Kinder in den 3 Einkommens-Buckets: 3 Zufallsentscheidungen
      for (let inc = 0; inc < 3; inc++) {
        w.population.add(1, cohortIndex(0, 0, inc), 40 / 3);
      }
      // Rng(4): erster Draw (0.924) failt bei p=0.9 -> ohne Schule bleibt ein
      // Bucket ungebildet, mit Schule werden alle gebildet.
      runDemographicsTick(w, new Rng(4), AGE_TICK_INTERVAL);
      const vec = w.population.city(1)!;
      let educated = 0;
      for (let inc = 0; inc < 3; inc++) {
        educated += (vec[cohortIndex(1, 1, inc)] ?? 0) + (vec[cohortIndex(1, 2, inc)] ?? 0);
      }
      return educated;
    };
    expect(run(0)).toBeLessThan(run(2));
  });

  it('Verschmutzung -> Fruchtbarkeit/Bodenwert -> Zufriedenheit', () => {
    const w = new World(42, 128, 128);
    const idx = landRun(w, 8);
    for (let i = 0; i < w.layers.fertility.length; i++) (w.layers.fertility as Uint8Array)[i] = 120;
    // Farm-Tile: Fruchtbarkeit knapp über der Rezept-Schwelle (0.35)
    (w.layers.fertility as Uint8Array)[idx] = 90; // 90/255 = 0.353
    expect(effectiveFertility(w, idx)).toBeGreaterThanOrEqual(0.35);
    const cx = idx % w.width;
    const cy = Math.floor(idx / w.width);
    w.enqueue({ kind: 'foundCity', x: cx + 4, y: cy, name: 'T' });
    w.update();
    w.settleResidents(1, cohortIndex(1, 0, 0), 8); // Zufriedenheit unter der Klemme 1
    w.update();
    const landBefore = computeLandValue(w, 1);
    w.addBuildingAt(1, cx + 1, cy, 3, 0); // Industrie (Quelle) neben dem Farm-Tile
    w.update();
    expect(effectiveFertility(w, idx)).toBeLessThan(0.35); // Farm-Basis entzogen
    expect(computeLandValue(w, 1)).toBeLessThan(landBefore); // Bodenwert fällt
    // Zufriedenheit: einzige Stellgröße ist die Verschmutzung (Layer leeren) —
    // sie wirkt direkt (Malus) und indirekt über den Bodenwert.
    const satDirty = computeSatisfaction(w, 1);
    const avg = averagePollution(w, 1);
    expect(avg).toBeGreaterThan(0);
    (w.pollution as Uint8Array).fill(0);
    expect(computeSatisfaction(w, 1)).toBeGreaterThan(satDirty);
  });
});
