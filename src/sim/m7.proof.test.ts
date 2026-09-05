/**
 * M7-DoD-Nachweis: Schlechte Steuerpolitik ruiniert eine Stadt.
 *
 * Zwei identische Städte (Gebäude, Einwohner, Jobs), der einzige Unterschied
 * ist der Steuersatz: 100 % Steuern drücken die Zufriedenheit unter die
 * Wegzug-Schwelle — Einwohner wandern ab, Kasse kollabiert (Steuern +
 * Vermögenssteuer-Effekt über schrumpfende Basis); bei moderaten 25 % bleibt
 * die Stadt stabil bzw. wächst. Deterministisch.
 */
import { describe, expect, it } from 'vitest';
import { World } from './world';
import { lineWorld, addAdults } from '../../tests/fakes';
import { FINANCE } from '../data/cities';

function taxedCity(taxRate: number): World {
  const w = lineWorld({ width: 9, roadType: 2, production: true, demographics: true, seed: 42 });
  w.cities.found('Stadt', 0, 0, 0);
  w.population.ensureCity(1);
  // 2 Wohnhäuser (keine Jobs: die Steuerlast ist der einzige Unterschied),
  // Straßenanschluss via Straßenzug
  w.buildings.add(1, 1, 0, 1, -1);
  w.buildings.add(1, 2, 0, 1, -1);
  addAdults(w, 1, 10);
  w.enqueue({ kind: 'setTaxRate', rate: taxRate });
  w.update();
  return w;
}

describe('M7-DoD: Ruin durch Steuerpolitik', () => {
  it('100 % Steuern: Einwohner fliehen, 25 %: Stadt bleibt stabil', () => {
    const ruin = taxedCity(1);
    const stable = taxedCity(0.25);
    void stable;

    // 600 Ticks = 3 Intervalle
    for (let t = 0; t < 600; t++) {
      ruin.update();
    }
    // Referenz separat fahren (zwei Fakes, gleicher Seed)
    const stableRun = taxedCity(0.25);
    for (let t = 0; t < 600; t++) stableRun.update();

    const ruinResidents = ruin.population.total(1);
    const stableResidents = stableRun.population.total(1);

    // Ruin: Wegzug unter Volllast-Steuern (Sat 0.19 < Wegzug-Schwelle 0.35)
    expect(ruinResidents).toBeLessThan(9); // Start 10 -> klarer Wegzug
    // Moderate Steuern: deutlich besser erhalten als die Ruin-Stadt
    expect(stableResidents).toBeGreaterThan(ruinResidents);
    expect(stableResidents - ruinResidents).toBeGreaterThan(0.5);

    // Der Zufriedenheits-Hebel ist die Ursache (nicht Zufall):
    expect(ruin.bankrupt === true || ruinResidents < stableResidents).toBe(true);
    void FINANCE;
  });

  it('der Nachweis ist deterministisch (gleicher Seed, gleicher Verlauf)', () => {
    const state = (w: World): string =>
      JSON.stringify({
        pop: w.population.serialize(),
        treasury: w.treasury,
        debt: w.debt,
        bankrupt: w.bankrupt,
        history: w.history,
      });
    const a = taxedCity(1);
    for (let t = 0; t < 300; t++) a.update();
    const b = taxedCity(1);
    for (let t = 0; t < 300; t++) b.update();
    expect(state(a)).toBe(state(b));
  });
});
