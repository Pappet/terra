import { describe, expect, it } from 'vitest';
import { clamp, computeDemand, computeStats } from './demand';
import { GROWTH } from '../data/cities';

describe('computeStats', () => {
  it('zählt nur Gebäude der Stadt mit ausreichender Substanz', () => {
    const buildings = {
      count: 5,
      cityId: [1, 1, 2, 1, 1],
      type: [1, 2, 3, 1, 3],
      condition: [1, 1, 1, 0.1, 1],
    };
    const stats = computeStats(1, buildings);
    expect(stats).toEqual({ houses: 1, shops: 1, factories: 1 }); // verfallenes R zählt nicht
  });
});

describe('computeDemand', () => {
  it('leere Stadt: Grundnachfrage nach Wohnen, keine nach C/I', () => {
    const d = computeDemand({ houses: 0, shops: 0, factories: 0 });
    expect(d.residential).toBeCloseTo(GROWTH.baseResidentialDemand, 9);
    expect(d.commercial).toBe(0);
    expect(d.industrial).toBe(0);
  });

  it('Arbeitsplatzüberschuss erhöht die Wohnnachfrage', () => {
    const base = computeDemand({ houses: 0, shops: 0, factories: 0 });
    // 2 Industriegebäude = 8 Jobs, keine Häuser -> starker Zuzugsdruck
    const withJobs = computeDemand({ houses: 0, shops: 0, factories: 2 });
    expect(withJobs.residential).toBeGreaterThan(base.residential);
  });

  it('Einwohner erzeugen Nachfrage nach Gewerbe und Industrie', () => {
    const houses = 10;
    const d = computeDemand({ houses, shops: 0, factories: 0 });
    const residents = houses * GROWTH.residentsPerHouse;
    expect(d.commercial).toBeCloseTo(1, 9); // keine Shops -> volle Nachfrage
    expect(d.industrial).toBeCloseTo(1, 9);
    // Im Gleichgewicht: Nachfrage ~ 0
    const balanced = computeDemand({
      houses,
      shops: Math.round(residents * GROWTH.targetShopsPerResident),
      factories: Math.round(residents * GROWTH.targetFactoriesPerResident),
    });
    expect(balanced.commercial).toBeLessThan(0.2);
    expect(balanced.industrial).toBeLessThan(0.2);
  });

  it('clamp hält Werte in [min, max]', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});
