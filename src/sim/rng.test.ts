import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng (mulberry32)', () => {
  it('erzeugt für denselben Seed dieselbe Sequenz', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqB).toEqual(seqA);
  });

  it('erzeugt für verschiedene Seeds verschiedene Sequenzen', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqB).not.toEqual(seqA);
  });

  it('Pin-Test: Sequenz für Seed 42 ist eingefroren (Algorithmus-Änderungen dürfen nicht unbemerkt bleiben)', () => {
    const rng = new Rng(42);
    const frozen = [
      0.6011037519201636,
      0.44829055899754167,
      0.8524657934904099,
      0.6697340414393693,
      0.17481389874592423,
    ];
    for (const expected of frozen) {
      expect(rng.next()).toBe(expected);
    }
  });

  it('next() liefert Werte in [0, 1)', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 2000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() liefert Werte in [min, max)', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(-3.5, 7.5);
      expect(v).toBeGreaterThanOrEqual(-3.5);
      expect(v).toBeLessThan(7.5);
    }
  });

  it('int() liefert Integer in [min, max] inklusiv und erreicht beide Grenzen', () => {
    const rng = new Rng(555);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(2, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]));
  });

  it('int() wirft, wenn max < min', () => {
    const rng = new Rng(1);
    expect(() => rng.int(5, 2)).toThrow(/max.*min/);
  });

  it('chance() respektiert p=0 und p=1', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('pick() liefert ein Element und wirft bei leerem Array', () => {
    const rng = new Rng(8);
    const items = ['a', 'b', 'c'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(rng.pick(items));
    expect([...seen].every((x) => items.includes(x as 'a' | 'b' | 'c'))).toBe(true);
    expect(seen.size).toBe(3);
    expect(() => rng.pick([])).toThrow(/leer/);
  });

  it('Zustands-Export/-Import setzt die Sequenz exakt fort (Savegame-Fähigkeit)', () => {
    const a = new Rng(777);
    for (let i = 0; i < 100; i++) a.next();
    const saved = a.stateU32;
    const expected = [a.next(), a.next(), a.next(), a.next()];

    const restored = Rng.fromState(saved);
    const continued = [restored.next(), restored.next(), restored.next(), restored.next()];
    expect(continued).toEqual(expected);
  });

  it('Seed 0 ist ein gültiger Seed', () => {
    const rng = new Rng(0);
    const v = rng.next();
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
