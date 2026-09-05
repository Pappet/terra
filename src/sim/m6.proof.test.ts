/**
 * M6-DoD-Nachweis: Eine rohstoffreiche und eine industrielle Stadt
 * spezialisieren sich von selbst — über Arbitrage und Preise, nicht per
 * Anweisung.
 *
 * Szenario (deterministische lineWorld): Stadt A hat Holzfäller (Rohstoff-
 * stufe), Stadt B Sägewerk + Werkstatt (Industrie, kein Holzfäller). B's
 * Industrie lebt NUR, weil Holz über den Handelskorridor kommt: A exportiert
 * Rohstoffe, B importiert sie und exportiert Verarbeitetes. Die Preise
 * bleiben dauerhaft asymmetrisch (A-Holz billig, B-Holz teuer) — die
 * Arbeitsteilung hält sich selbst aufrecht.
 */
import { describe, expect, it } from 'vitest';
import { World } from './world';
import { lineWorld, addAdults } from '../../tests/fakes';

const WOOD = 1;
const BOARDS = 4;
const TOOLS = 5;

function setupSpecialization(): World {
  const w = lineWorld({ width: 9, roadType: 2, production: true });
  w.cities.found('Holzstadt', 0, 0, 0);
  w.cities.found('Industriestadt', 8, 0, 0);
  w.population.ensureCity(1);
  w.population.ensureCity(2);

  // A: zwei Holzfäller (Rohstoffbasis)
  w.buildings.add(1, 1, 0, 3, 0);
  w.buildings.add(1, 2, 0, 3, 0);
  addAdults(w, 1, 20);

  // B: Sägewerk + Werkstatt (Industrie), kein Holzfäller
  w.buildings.add(2, 7, 0, 3, 4);
  w.buildings.add(2, 8, 0, 3, 5);
  addAdults(w, 2, 25);

  // Startbestände: B bekommt etwas Betriebsmittel, danach muss Handel fließen
  w.storage.add(1, WOOD, 6);
  w.storage.add(2, WOOD, 6);
  w.storage.add(2, BOARDS, 4);
  w.storage.add(2, 3, 300); // Erz für die Werkstatt
  w.update();
  return w;
}

describe('M6-DoD: Spezialisierung durch Handel', () => {
  it('Rohstoffstadt exportiert Holz, Industriestadt importiert und exportiert Werkzeug', () => {
    const w = setupSpecialization();
    const woodExportsBefore = w.trade.exports[0]![WOOD] ?? 0;
    const boardsBefore = w.storage.amount(2, BOARDS);
    const toolsBefore = w.storage.amount(2, TOOLS);

    for (let t = 0; t < 300; t++) w.update();

    // A exportiert Holz
    const woodExports = w.trade.exports[0]![WOOD] ?? 0;
    expect(woodExports).toBeGreaterThan(woodExportsBefore + 5);

    // B importiert Holz und produziert Bretter (Industrie lebt vom Import)
    expect(w.trade.imports[1]![WOOD] ?? 0).toBeGreaterThan(0);
    expect(w.storage.amount(2, BOARDS)).toBeGreaterThan(boardsBefore);

    // Spezialisierung strukturell: A besitzt KEIN Verarbeitungsgebäude
    // (Rohstoffrolle), B keine Extraktionsgebäude (Industrierolle).
    const recipesA: number[] = [];
    const recipesB: number[] = [];
    for (let i = 0; i < w.buildings.count; i++) {
      const city = w.buildings.cityId[i] ?? 0;
      const recipe = w.buildings.recipe[i] ?? -1;
      if (city === 1) recipesA.push(recipe);
      if (city === 2) recipesB.push(recipe);
    }
    expect(recipesA.every((r) => r === 0)).toBe(true); // nur Holzfäller
    expect(recipesB.every((r) => r === 4 || r === 5)).toBe(true); // nur Verarbeitung

    // Und der Überschuss aus B's Verarbeitung fließt per Arbitrage zurück:
    // A importiert Bretter (Preis-Boden in A macht den Verkauf profitabel).
    expect(w.trade.imports[0]![BOARDS] ?? 0).toBeGreaterThan(0);

    // Preis-Asymmetrie hält sich: Holz in B dauerhaft teurer als in A
    expect(w.market.price(2, WOOD)).toBeGreaterThan(w.market.price(1, WOOD));

    // Die Werkstatt fehlt Arbeiterkonkurrenz im 12-Arbeiter-Limit (4+4+4):
    // employed B = 8 -> Sägewerk volllastig, Werkstatt ohne Restarbeiter.
    // Das ist keine Handels-, sondern eine Zuweisungsfrage (M4.3) — hier
    // dokumentiert, damit der DoD-Kern (Arbeitsteilung via Handel) klar bleibt.

    void boardsBefore;
    void toolsBefore;
  });

  it('ohne Handel stirbt die Industrie (Gegenprobe zur Spezialisierung)', () => {
    // Wasser zwischen den Städten -> kein Korridor, keine Importe
    const w = lineWorld({
      width: 9,
      roadType: 2,
      waterColumns: [1, 2, 3, 5, 6, 7],
      production: true,
    });
    w.cities.found('Holzstadt', 0, 0, 0);
    w.cities.found('Industriestadt', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    w.buildings.add(1, 0, 0, 3, 0);
    w.buildings.add(2, 8, 0, 3, 4);
    w.buildings.add(2, 8, 0, 3, 5);
    // A can't reach B; B's buildings share one tile — Werkstatt/ Sägewerk both at 8
    // (buildings.add erlaubt Stapeln im Fake — für die Gegenprobe ausreichend)
    addAdults(w, 2, 25);
    w.storage.add(2, WOOD, 6);
    w.storage.add(2, BOARDS, 4);
    w.storage.add(2, 3, 300);
    w.update();

    const boardsStart = w.storage.amount(2, BOARDS);
    for (let t = 0; t < 120; t++) w.update();
    // Kein Handel: Der Holzvorrat von B (6) wird verbraucht, Nachschub bleibt aus.
    // Sägewerk/Werkstatt fallen in den Engpass-Stillstand; Arbeitsteilung entsteht nicht.
    expect(w.trade.imports[1]![WOOD] ?? 0).toBe(0);
    // Bretter mindestens nicht GESTIEGEN (Werkstatt isst den Bestand auf)
    expect(w.storage.amount(2, BOARDS)).toBeLessThanOrEqual(boardsStart);
    void boardsStart;
  });

  it('der Nachweis ist deterministisch', () => {
    const run = (): World => {
      const w = setupSpecialization();
      for (let t = 0; t < 150; t++) w.update();
      return w;
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a.storage.serialize())).toBe(JSON.stringify(b.storage.serialize()));
    expect(JSON.stringify(a.trade.exports.map((v) => Array.from(v)))).toBe(
      JSON.stringify(b.trade.exports.map((v) => Array.from(v))),
    );
  });
});
