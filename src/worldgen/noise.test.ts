import { describe, expect, it } from 'vitest';
import { fbm2, hash2, valueNoise2 } from './noise';

describe('hash2', () => {
  it('ist deterministisch und liegt in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const v = hash2(12345, i * 7, i * -13);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(hash2(12345, i * 7, i * -13));
    }
  });

  it('verschiedene Seeds/Liegt verteilen unterschiedlich', () => {
    const a = hash2(1, 100, 100);
    const b = hash2(2, 100, 100);
    const c = hash2(1, 100, 101);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('valueNoise2', () => {
  it('ist deterministisch für denselben Seed', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const y = i * 1.19;
      expect(valueNoise2(42, x, y)).toBe(valueNoise2(42, x, y));
    }
  });

  it('liegt in [0, 1) und ist an Gitterpunkten glatt (kleine Schritte -> kleine Differenzen)', () => {
    let maxStep = 0;
    for (let i = 0; i < 2000; i++) {
      const x = i * 0.173;
      const y = i * 0.291;
      const v = valueNoise2(7, x, y);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const v2 = valueNoise2(7, x + 0.01, y + 0.01);
      maxStep = Math.max(maxStep, Math.abs(v2 - v));
    }
    expect(maxStep).toBeLessThan(0.05);
  });

  it('pinnt die Sequenz für Seed 42 (Algorithmus-Änderungen dürfen nicht unbemerkt bleiben)', () => {
    const frozen = [
      valueNoise2(42, 0.5, 0.5),
      valueNoise2(42, 1.5, 0.5),
      valueNoise2(42, 10.25, 3.75),
    ];
    // Einmal berechnete Werte hier einfrieren; der Test schützt künftige Refactorings.
    expect(frozen[0]).toBeCloseTo(0.2393564724479802, 12);
    expect(frozen[1]).toBeCloseTo(0.2392140210140496, 12);
    expect(frozen[2]).toBeCloseTo(0.9123058636468917, 12);
  });
});

describe('fbm2', () => {
  it('liegt in [0, 1) und ist deterministisch', () => {
    for (let i = 0; i < 1000; i++) {
      const x = i * 1.31;
      const y = i * 0.83;
      const v = fbm2(9, x, y, { octaves: 5, wavelength: 64 });
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(fbm2(9, x, y, { octaves: 5, wavelength: 64 }));
    }
  });

  it('Offsets trennen Felder auf demselben Seed', () => {
    const a = fbm2(9, 10, 10, { octaves: 4, wavelength: 32 });
    const b = fbm2(9, 10, 10, { octaves: 4, wavelength: 32 }, 1000, 1000);
    expect(a).not.toBe(b);
  });

  it('octaves=1 ist exakt valueNoise2 an der skalierten Stelle', () => {
    const W = 32;
    for (let i = 0; i < 100; i++) {
      const x = i * 1.37;
      const y = i * 0.71;
      expect(fbm2(9, x, y, { octaves: 1, wavelength: W })).toBe(
        valueNoise2(9, x / W, y / W),
      );
    }
  });

  it('octaves=2 ist die exakt normalisierte Summe beider Oktaven', () => {
    const W = 32;
    const K = 0x9e3779b9;
    for (let i = 0; i < 100; i++) {
      const x = i * 1.37;
      const y = i * 0.71;
      const expected =
        (valueNoise2(9, x / W, y / W) + 0.5 * valueNoise2(9 + K, (2 * x) / W, (2 * y) / W)) / 1.5;
      expect(fbm2(9, x, y, { octaves: 2, wavelength: W })).toBe(expected);
    }
  });
});
