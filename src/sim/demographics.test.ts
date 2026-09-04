import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { GROWTH } from '../data/cities';
import { AGE_TICK_INTERVAL, cohortIndex } from './population';
import { computeSatisfaction, housingCapacity, runDemographicsTick } from './demographics';
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
  // Wohnhaus MIT Strassenanschluss (sonst verfaellt es korrekt)
  w.addBuildingAt(1, cx + 1, cy, 1);
  for (const dx of [1, 2, 3]) {
    w.enqueue({ kind: 'buildRoad', x: cx + dx, y: cy + 1, road: 2 });
  }
  w.enqueue({ kind: 'buildRoad', x: cx + 2, y: cy, road: 2 });
  w.update();
  return w;
}

/** Sucht ein freies Landtile mit (Option) angrenzendem Strassentile. */
function findSpot(w: World, needRoadAccess: boolean): { x: number; y: number } {
  for (let idx = 0; idx < w.tiles.length; idx++) {
    if (w.layers.water[idx] !== 0) continue;
    if (w.roads[idx] !== 0) continue;
    if (w.buildingIndex[idx] !== 0) continue;
    if (w.zoneType[idx] !== 0) continue;
    if (needRoadAccess) {
      const x = idx % w.width;
      const y = Math.floor(idx / w.width);
      const neighbours = [idx - 1, idx + 1, idx - w.width, idx + w.width].filter(
        (n) => n >= 0 && n < w.tiles.length,
      );
      if (!neighbours.some((n) => (w.roads[n] ?? 0) !== 0)) continue;
      return { x, y };
    }
    return { x: idx % w.width, y: Math.floor(idx / w.width) };
  }
  throw new Error('kein passendes Tile');
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

  it('Save/Replay mitten im Lauf ist identisch zum durchgehenden Lauf (RNG-Zustand)', () => {
    // Durchgehender Lauf
    const live = cityWithHouse();
    live.population.add(1, cohortIndex(1, 0, 0), 4);
    for (let t = 0; t < 150; t++) live.update(); // vor dem Demografie-Intervall bei 200

    // Abgebrochener Lauf: speichern, später weiterführen
    const saved = World.fromJson(live.toJson());
    expect(saved.tick).toBe(152);
    // Beide laufen über das Intervall (Tick 200) und darüber hinaus
    for (let t = 0; t < 150; t++) live.update();
    for (let t = 0; t < 150; t++) saved.update();
    expect(saved.tick).toBe(302);
    expect(live.tick).toBe(302);
    // Identische Bevölkerung inkl. Geburten-/Sterbefall-RNG-Verbrauch beim Intervall-Tick
    expect(equalWorlds(live, saved)).toBe(true);
  });

  it('Zufriedenheit: Jobs und Wohnraum heben sie, Überbevölkerung senkt sie', () => {
    const w = cityWithHouse();
    w.population.ensureCity(1);
    w.settleResidents(1, cohortIndex(1, 0, 0), 4);
    w.update(); // Zuweisung
    // 1 Haus (Kapazität 4), 4 Erwachsene, keine Jobs -> mässig
    const withoutJobs = computeSatisfaction(w, 1);
    w.addBuildingAt(1, w.cities.x[0]! + 4, w.cities.y[0]! + 1, 2); // Gewerbe -> 4 Jobs (an Strasse)
    w.update();
    const withJobs = computeSatisfaction(w, 1);
    expect(withJobs).toBeGreaterThan(withoutJobs);
    // Überbevölkerung: 40 Erwachsene auf 1 Haus
    w.settleResidents(1, cohortIndex(2, 0, 0), 36);
    w.update();
    const overcrowded = computeSatisfaction(w, 1);
    expect(overcrowded).toBeLessThan(withJobs);
  });

  it('Zuzug: zufriedene Stadt mit freier Kapazität wächst', () => {
    const w = cityWithHouse();
    // Zweites Haus -> Kapazität 8, nur 4 Einwohner (an Strasse)
    const houseSpot = findSpot(w, true);
    w.addBuildingAt(1, houseSpot.x, houseSpot.y, 1);
    w.settleResidents(1, cohortIndex(1, 0, 0), 4);
    const jobSpot = findSpot(w, true);
    w.addBuildingAt(1, jobSpot.x, jobSpot.y, 2); // Jobs
    w.update();
    const before = w.population.total(1);
    const grew = (() => {
      for (let t = 0; t < AGE_TICK_INTERVAL * 4; t++) {
        w.update();
        if (w.population.total(1) > before) return true;
      }
      return false;
    })();
    expect(grew).toBe(true);
    expect(w.population.total(1)).toBeLessThanOrEqual(housingCapacity(w, 1));
  });

  it('Wegzug: unzufriedene Stadt schrumpft', () => {
    const w = cityWithHouse();
    // 40 Erwachsene, 1 Haus (Kapazität 4), keine Jobs -> Zufriedenheit unter Wegzug-Schwelle
    // (Haus hat Anschluss, aber Überbevölkerung + Arbeitslosigkeit bleiben)
    w.settleResidents(1, cohortIndex(1, 0, 0), 40);
    w.update();
    const before = w.population.total(1);
    const shrank = (() => {
      for (let t = 0; t < AGE_TICK_INTERVAL * 6; t++) {
        w.update();
        if (w.population.total(1) < before) return true;
      }
      return false;
    })();
    expect(shrank).toBe(true);
  });

  it('Migration ist deterministisch', () => {
    const run = (): World => {
      const w = cityWithHouse();
      const houseSpot = findSpot(w, true);
      w.addBuildingAt(1, houseSpot.x, houseSpot.y, 1);
      const jobSpot = findSpot(w, true);
      w.addBuildingAt(1, jobSpot.x, jobSpot.y, 2);
      w.settleResidents(1, cohortIndex(1, 0, 0), 4);
      for (let t = 0; t < AGE_TICK_INTERVAL * 5; t++) w.update();
      return w;
    };
    expect(run().toJson()).toBe(run().toJson());
  });
});
