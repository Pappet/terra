import { describe, expect, it } from 'vitest';
import { World } from './world';
import { FINANCE } from '../data/cities';
import { AGE_TICK_INTERVAL, cohortIndex } from './population';
import { computeSatisfaction } from './demographics';

/**
 * Isolierte Kredit-/Bankrott-Tests (Berater-Hinweis): keine Erwachsenen
 * (keine Steuern, keine Migration), keine Gebaeude/Strassen (kein Unterhalt),
 * Steuersatz 0. Damit ist treasury = f(Kredite) exakt.
 */
function loanCity(): World {
  const w = new World(42, 128, 128);
  let center = -1;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.layers.water[i] === 0) {
      center = i;
      break;
    }
  }
  w.enqueue({ kind: 'foundCity', x: center % w.width, y: Math.floor(center / w.width), name: 'T' });
  w.update();
  return w;
}

function runTicks(w: World, n: number): void {
  for (let t = 0; t < n; t++) w.update();
}

describe('M7.3 Kredite (isoliert: taxRate 0, keine Einwohner, kein Unterhalt)', () => {
  it('Kredit erhoeht Kasse und Schulden 1:1', () => {
    const w = loanCity();
    w.settleResidents(1, cohortIndex(1, 0, 0), 10); // Limit: 200
    runTicks(w, 1);
    w.enqueue({ kind: 'setTaxRate', rate: 0 }); // Steuern/Migration neutral halten
    runTicks(w, 1);
    w.enqueue({ kind: 'takeLoan', amount: 100 });
    runTicks(w, 1);
    expect(w.treasury).toBeCloseTo(600, 9);
    expect(w.debt).toBeCloseTo(100, 9);
  });

  it('Zins kapitalisiert pro Intervall: treasury -5, debt +5, Summe konstant', () => {
    const w = loanCity();
    w.settleResidents(1, cohortIndex(1, 0, 0), 10);
    w.enqueue({ kind: 'setTaxRate', rate: 0 });
    runTicks(w, 1);
    w.enqueue({ kind: 'takeLoan', amount: 100 });
    runTicks(w, 1);
    expect(w.treasury).toBeCloseTo(600, 9);

    runTicks(w, AGE_TICK_INTERVAL);
    expect(w.debt).toBeCloseTo(105, 6);
    expect(w.treasury).toBeCloseTo(595, 6);
    expect(w.treasury + w.debt).toBeCloseTo(700, 6);
  });

  it('Kreditlimit (maxDebtPerAdult x Erwachsene) wird erzwungen', () => {
    const w = loanCity();
    w.settleResidents(1, cohortIndex(1, 0, 0), 10);
    runTicks(w, 1);
    expect(w.maxDebt).toBe(200);
    w.enqueue({ kind: 'takeLoan', amount: 150 });
    runTicks(w, 1);
    expect(w.debt).toBeCloseTo(150, 9);
    w.enqueue({ kind: 'takeLoan', amount: 100 });
    runTicks(w, 1);
    expect(w.lastRejected).toMatch(/Kreditlimit/);
    expect(w.debt).toBeCloseTo(150, 9);
  });

  it('Tilgung: pay = min(amount, debt, treasury)', () => {
    const w = loanCity();
    w.settleResidents(1, cohortIndex(1, 0, 0), 10);
    runTicks(w, 1);
    w.enqueue({ kind: 'setTaxRate', rate: 0 });
    runTicks(w, 1);
    w.enqueue({ kind: 'takeLoan', amount: 100 });
    w.enqueue({ kind: 'repayLoan', amount: 40 });
    runTicks(w, 1);
    expect(w.debt).toBeCloseTo(60, 9);
    expect(w.treasury).toBeCloseTo(560, 9);
    w.enqueue({ kind: 'repayLoan', amount: 5000 });
    runTicks(w, 1);
    expect(w.debt).toBeCloseTo(0, 9);
    expect(w.treasury).toBeCloseTo(500, 9);
  });
});

describe('M7.4 Bankrott + Steuerlast', () => {
  it('Bankrott bei Kasse unter Grenze: Bau blockiert, Erholung hebt auf', () => {
    const w = loanCity();
    w.treasury = FINANCE.bankruptcyTreasuryLimit - 1;
    runTicks(w, 1);
    expect(w.bankrupt).toBe(true);
    w.enqueue({ kind: 'buildRoad', x: 5, y: 5, road: 2 });
    runTicks(w, 1);
    expect(w.lastRejected).toMatch(/Bankrott/);

    w.treasury = 50;
    runTicks(w, 1);
    expect(w.bankrupt).toBe(false);
  });

  it('Steuerlast senkt die Zufriedenheit (Richtung + Obergrenze taxBurden)', () => {
    const w = loanCity();
    w.settleResidents(1, cohortIndex(1, 0, 0), 10);
    runTicks(w, 1);
    w.enqueue({ kind: 'setTaxRate', rate: 0 });
    runTicks(w, 1);
    const satLow = computeSatisfaction(w, 1);
    w.enqueue({ kind: 'setTaxRate', rate: 1 });
    runTicks(w, 1);
    const satHigh = computeSatisfaction(w, 1);
    expect(satHigh).toBeLessThan(satLow);
    expect(satLow - satHigh).toBeGreaterThan(0);
    expect(satLow - satHigh).toBeLessThanOrEqual(FINANCE.taxBurdenOnSatisfaction);
  });
});
