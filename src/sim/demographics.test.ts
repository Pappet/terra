import { describe, expect, it } from 'vitest';
import { World } from './world';
import { GROWTH } from '../data/cities';
import { AGE_TICK_INTERVAL, cohortIndex } from './population';
import { housingCapacity, runDemographicsTick } from './demographics';
import { Rng } from './rng';

function cityWithHouse(): World {
  const w = new World(42, 128, 128);
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
  // Wohnhaus direkt registrieren (Kapazität 4)
  w.addBuildingAt(1, cx + 1, cy, 1);
  return w;
}

describe('M4.2 Demografie', () => {
  it('Alterung: Kohorten rücken nach AGE_TICK_INTERVAL Ticks weiter', () => {
    const w = cityWithHouse();
    w.population.add(1, cohortIndex(1, 1, 0), 10);
    const before = w.population.total(1);
    runDemographicsTick(w, new Rng(1), AGE_TICK_INTERVAL);
    // Gruppe 1 -> 2 (mit Sterblichkeit), Bildung wandert mit Wahrscheinlichkeit
    const vec = w.population.city(1)!;
    const inGroup1 = vec[cohortIndex(1, 1, 0)] as number;
    expect(inGroup1).toBe(0);
    const moved = (vec[cohortIndex(2, 1, 0)] as number) + (vec[cohortIndex(2, 2, 0)] as number);
    const expectedSurvivors = 10 * (1 - 0.002); // Sterblichkeit Gruppe 1
    expect(moved).toBeCloseTo(expectedSurvivors, 9);
    // Gesamt (inkl. Geburten) >= vorherige Überlebenden
    expect(w.population.total(1)).toBeGreaterThanOrEqual(expectedSurvivors);
    void before;
  });

  it('Geburten sind durch die Wohnkapazität begrenzt', () => {
    const w = cityWithHouse();
    expect(housingCapacity(w, 1)).toBe(GROWTH.residentsPerHouse);
    // 4 Erwachsene füllen das Haus komplett; mehr geht nicht
    w.population.add(1, cohortIndex(1, 0, 0), 4);
    for (let t = 0; t < AGE_TICK_INTERVAL * 3; t++) w.update();
    expect(w.population.total(1)).toBeLessThanOrEqual(GROWTH.residentsPerHouse);
  });

  it('ohne Häuser gibt es keine Geburten (Bestand stirbt langsam aus)', () => {
    const w = cityWithHouse();
    w.removeBuildingAt(0); // Haus weg -> Kapazität 0
    w.population.add(1, cohortIndex(1, 0, 0), 10);
    for (let t = 0; t < AGE_TICK_INTERVAL * 20; t++) w.update();
    expect(w.population.total(1)).toBeLessThan(10); // Sterblichkeit wirkt, Geburten nicht
  });

  it('sterbliche älteste Gruppe dünnt aus', () => {
    const w = cityWithHouse();
    w.population.add(1, cohortIndex(3, 0, 0), 100);
    for (let t = 0; t < AGE_TICK_INTERVAL * 5; t++) w.update();
    const vec = w.population.city(1)!;
    // 5 Intervalle à 6 % Sterblichkeit
    expect(vec[cohortIndex(3, 0, 0)]).toBeCloseTo(100 * Math.pow(0.94, 5), 6);
    expect(vec[cohortIndex(3, 0, 0)]).toBeLessThan(100);
  });

  it('Demografie ist deterministisch', () => {
    const run = (): World => {
      const w = cityWithHouse();
      w.population.add(1, cohortIndex(1, 0, 0), 4);
      for (let t = 0; t < AGE_TICK_INTERVAL * 6; t++) w.update();
      return w;
    };
    expect(run().toJson()).toBe(run().toJson());
  });
});
