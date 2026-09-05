/**
 * M4-DoD-Nachweis: Zwei nahe Städte teilen sich einen Arbeitsmarkt —
 * Pendler beider Städte füllen die Jobs der mittleren Stadt, das Aufkommen
 * steht als Zuweisung (Overlay-Datenquelle) bereit und reagiert auf
 * Strassenausbau (Korridorkapazität). Deterministisch.
 */
import { describe, expect, it } from 'vitest';
import { World } from './world';
import { lineWorld as makeLineWorld } from '../../tests/fakes';
import { cohortIndex } from './population';
import { assignWorkers } from './employment';

function lineWorld(roadType: number): World {
  return makeLineWorld({ width: 11, roadType });
}

function addAdults(w: World, cityId: number, count: number): void {
  w.population.ensureCity(cityId);
  w.population.add(cityId, cohortIndex(1, 0, 0), count);
}

describe('M4-DoD: geteilter Arbeitsmarkt', () => {
  it('zwei Städte pendeln in die dritte; Ausbau erhöht das Pendleraufkommen', () => {
    const run = (roadType: number): { flows: number[][]; openJobs: number[] } => {
      const w = lineWorld(roadType);
      w.cities.found('A', 0, 0, 0);
      w.cities.found('B', 5, 0, 0);
      w.cities.found('C', 9, 0, 0);
      for (let c = 1; c <= 3; c++) w.population.ensureCity(c);
      // 10 Gewerbegebäude in B = 40 Jobs
      for (let b = 0; b < 10; b++) w.buildings.add(2, 5, 0, 2, -1);
      // Arbeiter wohnen in A und C, nicht in B
      addAdults(w, 1, 30); // 18 Erwerbstätige
      addAdults(w, 3, 30); // 18 Erwerbstätige

      const result = assignWorkers(w);
      return { flows: result.flows, openJobs: result.openJobs };
    };

    // Enger Korridor (Pfad, Kapazität 10): jeder Fluss deckelt bei 10
    const dirt = run(1);
    expect(dirt.flows[0]![1]).toBe(10);
    expect(dirt.flows[2]![1]).toBe(10);
    expect(dirt.openJobs[1]).toBe(20); // 40 Jobs - 20 Pendler

    // Ausbau (Chaussee, Kapazität 120): Aufkommen steigt auf workerlimitiert 18
    const paved = run(3);
    expect(paved.flows[0]![1]).toBe(18);
    expect(paved.flows[2]![1]).toBe(18);
    expect(paved.openJobs[1]).toBe(4);
    // Geteilter Arbeitsmarkt: BEIDE Städte speisen B
    expect(paved.flows[0]![1]).toBeGreaterThan(0);
    expect(paved.flows[2]![1]).toBeGreaterThan(0);
  });

  it('Zuweisung reagiert auf Strassenausbau: Korridorkapazität hebt den Fluss', () => {
    // Die Aktions->Dirty->Zuweisung-Verkabelung ist in employment.test
    // ('update-getrieben') abgedeckt; hier die Reaktionskette inhaltlich:
    const w = lineWorld(1);
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 5, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    for (let b = 0; b < 10; b++) w.buildings.add(2, 5, 0, 2, -1);
    addAdults(w, 1, 60); // 36 Erwerbstätige

    const before = assignWorkers(w);
    expect(before.flows[0]![1]).toBe(10); // Pfad-Kapazität 10 deckelt

    // Strasse ausbauen (Rev-Sprung wie nach einem Bau-Tick)
    for (let i = 0; i < w.width; i++) w.roads[i] = 3;
    const after = assignWorkers({ ...w, tileRev: w.tileRev + 1 } as World);
    expect(after.flows[0]![1]).toBe(36); // jetzt workerlimitiert
  });
});
