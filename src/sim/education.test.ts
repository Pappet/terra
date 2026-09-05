import { describe, expect, it } from 'vitest';
import { World } from './world';
import { runDemographicsTick } from './demographics';
import { AGE_TICK_INTERVAL, cohortIndex } from './population';
import { RECIPE_SCHOOL } from '../data/goods';
import { DEMOGRAPHICS } from '../data/demographics';
import { Rng } from './rng';

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

function cityWorld(): World {
  const w = new World(42, 128, 128);
  const idx = landRun(w, 5);
  w.enqueue({ kind: 'foundCity', x: idx % w.width, y: Math.floor(idx / w.width), name: 'T' });
  w.update();
  expect(w.cities.count).toBe(1);
  return w;
}

function educatedAdults(w: World): number {
  const vec = w.population.city(1)!;
  let edu = 0;
  for (let inc = 0; inc < 3; inc++) {
    edu += (vec[cohortIndex(1, 1, inc)] ?? 0) + (vec[cohortIndex(1, 2, inc)] ?? 0);
  }
  return edu;
}

/** Setzt ungebildete Kinder in den 3 Einkommens-Buckets ein: 3 unabhängige
 *  Zufallsentscheidungen (Kohorten sind aggregierte Buckets). */
function addChildren(w: World, perBucket: number): void {
  for (let inc = 0; inc < 3; inc++) {
    w.population.add(1, cohortIndex(0, 0, inc), perBucket);
  }
}

/** 10 Häuser: genug Wohnkapazität, damit Migration (M8.1-Kopplung) neutral bleibt. */
function addHouses(w: World): void {
  const cx = w.cities.x[0]!;
  const cy = w.cities.y[0]!;
  for (let k = 0; k < 10; k++) w.addBuildingAt(1, cx + 1 + k, cy + 1, 1);
}

/**
 * M8.2 Bildung: Schulgebäude (C, Rezept RECIPE_SCHOOL) erhöhen die
 * Bildungschancen der Kohorten in runDemographicsTick.
 */
describe('M8.2 Bildung', () => {
  it('Schule bildet mehr Kinder zu Erwachsenen mit Grundbildung aus (deterministisch)', () => {
    const run = (withSchool: boolean): number => {
      const w = cityWorld();
      w.taxRate = 0; // kein Steuer-Malus, keine Migration
      addChildren(w, 40 / 3);
      addHouses(w);
      if (withSchool) {
        const cx = w.cities.x[0]!;
        const cy = w.cities.y[0]!;
        w.addBuildingAt(1, cx + 1, cy, 2, RECIPE_SCHOOL);
      }
      // Rng(4): erster Draw (0.924) failt bei p=0.9 -> ohne Schule bleibt ein
      // Bucket ungebildet, mit Schule (Chance 1.0) werden alle gebildet.
      runDemographicsTick(w, new Rng(4), AGE_TICK_INTERVAL);
      return educatedAdults(w);
    };
    const without = run(false);
    const withSchool = run(true);
    // Mit Schule Chance 1.0: alle Überlebenden der Kinder-Kohorten gebildet
    expect(withSchool).toBeCloseTo(40 * (1 - DEMOGRAPHICS.mortalityPerInterval[0]!), 6);
    expect(withSchool).toBeGreaterThan(without);
    // deterministisch: gleicher Lauf, gleiches Ergebnis
    expect(run(true)).toBe(withSchool);
  });

  it('Bildungseffekt ist über maxSchoolsCounted gedeckelt', () => {
    const w = cityWorld();
    w.taxRate = 0;
    addChildren(w, 40 / 3);
    addHouses(w);
    const cx = w.cities.x[0]!;
    const cy = w.cities.y[0]!;
    w.addBuildingAt(1, cx + 1, cy, 2, RECIPE_SCHOOL);
    w.addBuildingAt(1, cx + 2, cy, 2, RECIPE_SCHOOL);
    w.addBuildingAt(1, cx + 3, cy, 2, RECIPE_SCHOOL); // über dem Cap
    runDemographicsTick(w, new Rng(4), AGE_TICK_INTERVAL);
    expect(educatedAdults(w)).toBeCloseTo(40 * (1 - DEMOGRAPHICS.mortalityPerInterval[0]!), 6);
  });
});
