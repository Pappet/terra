/**
 * M5-DoD-Nachweis: Ein Engpass in einer Vorstufe schlägt messbar auf die
 * nachgelagerte Produktion durch. Kette: Holzfäller (Holz) -> Sägewerk
 * (Bretter) -> Werkstatt (Werkzeug, braucht Bretter + Erz).
 *
 * Szenario auf deterministischer lineWorld: Alle drei Stufen produzieren;
 * dann fällt der Holzfäller aus (z.B. Brand/Verfall -> removeBuildingAt).
 * Folge: das Restholz wird aufgebraucht, die Bretterproduktion stoppt, und
 * die Werkstatt kaskadiert nach — obwohl Erz im Lager reicht.
 */
import { describe, expect, it } from 'vitest';
import { World } from './world';
import { lineWorld as makeLineWorld } from '../../tests/fakes';
import { cohortIndex } from './population';

function chainWorld(): World {
  const w = makeLineWorld({ width: 9, roadType: 2, production: true });
  w.cities.found('Kette', 0, 0, 0);
  w.population.ensureCity(1);
  w.storage.add(1, 3, 500);
  return w;
}

describe('M5-DoD: Engpass schlägt nachgelagert durch', () => {
  it('Holzfäller-Ausfall stoppt Sägewerk und kaskadiert in die Werkstatt', () => {
    const w = chainWorld();
    w.cities.found('Kette', 0, 0, 0);
    w.population.ensureCity(1);
    // Kette: Holzfäller(0) -> Sägewerk(4) -> Werkstatt(5), direkt nebeneinander
    w.buildings.add(1, 0, 0, 3, 0);
    w.buildings.add(1, 1, 0, 3, 4);
    w.buildings.add(1, 2, 0, 3, 5);
    // 25 Erwachsene: 15 Arbeiter (5+4+4 = 13 benötigt, alle Stufen volllastnah)
    w.population.add(1, cohortIndex(1, 0, 0), 25);
    // Startbestand: Holz begrenzt, Erz nie der Engpass
    w.storage.add(1, 1, 40);
    w.storage.add(1, 3, 500);
    w.update(); // Zuweisung

    // Phase 1: alle Stufen produzieren
    const boardsBefore = w.storage.amount(1, 4);
    const toolsBefore = w.storage.amount(1, 5);
    for (let t = 0; t < 6; t++) w.update();
    expect(w.storage.amount(1, 4)).toBeGreaterThan(boardsBefore);
    expect(w.storage.amount(1, 5)).toBeGreaterThan(toolsBefore);
    const rateBoardsBefore = (w.storage.amount(1, 4) - boardsBefore) / 6;
    const rateToolsBefore = (w.storage.amount(1, 5) - toolsBefore) / 6;

    // Engpass: der Holzfäller fällt aus (Brand/Verfall)
    w.removeBuildingAt(0);

    // Phase 2: Restholz (40 + Produktionstop) wird aufgebraucht, dann
    // brechen Sägewerk UND Werkstatt ein. Länger messen als der Vorrat reicht.
    let woodBelowDemand = false;
    for (let t = 0; t < 120; t++) {
      w.update();
      // Unterhalb des Sägewerk-Bedarfs (2/Tick) kann take() nie mehr liefern
      if (w.storage.amount(1, 1) < 2) woodBelowDemand = true;
    }
    expect(woodBelowDemand).toBe(true);

    const b0 = w.storage.amount(1, 4);
    const t0 = w.storage.amount(1, 5);
    for (let t = 0; t < 10; t++) w.update();
    const rateBoardsAfter = (w.storage.amount(1, 4) - b0) / 10;
    const rateToolsAfter = (w.storage.amount(1, 5) - t0) / 10;

    expect(rateBoardsAfter).toBeCloseTo(0, 6); // Sägewerk engpassgetrieben still
    expect(rateToolsAfter).toBeCloseTo(0, 6); // Werkstatt kaskadiert nach
    expect(rateBoardsAfter).toBeLessThan(rateBoardsBefore);
    expect(rateToolsAfter).toBeLessThan(rateToolsBefore);
  });

  it('der Nachweis ist deterministisch', () => {
    const run = (): World => {
      const w = chainWorld();
      w.cities.found('Kette', 0, 0, 0);
      w.population.ensureCity(1);
      w.buildings.add(1, 0, 0, 3, 0);
      w.buildings.add(1, 1, 0, 3, 4);
      w.buildings.add(1, 2, 0, 3, 5);
      w.population.add(1, cohortIndex(1, 0, 0), 25);
      w.storage.add(1, 1, 40);
      w.storage.add(1, 3, 500);
      w.update();
      w.removeBuildingAt(0);
      for (let t = 0; t < 100; t++) w.update();
      return w;
    };
    const a = run();
    const b = run();
    // Fake-Welt: Zustandsvergleich über die serialisierbaren SoA-Daten
    expect(JSON.stringify(b.storage.serialize())).toBe(JSON.stringify(a.storage.serialize()));
    expect(JSON.stringify(b.buildings.serialize())).toBe(JSON.stringify(a.buildings.serialize()));
  });
});
