import { describe, expect, it } from 'vitest';
import {
  AGE_BRACKETS,
  COHORTS_PER_CITY,
  EDUCATION_LEVELS,
  INCOME_LEVELS,
  Population,
  cohortIndex,
} from './population';
import { World, equalWorlds } from './world';

describe('cohortIndex', () => {
  it('mappt (Alter, Bildung, Einkommen) eindeutig auf [0, 36)', () => {
    const seen = new Set<number>();
    for (let a = 0; a < AGE_BRACKETS; a++) {
      for (let e = 0; e < EDUCATION_LEVELS; e++) {
        for (let inc = 0; inc < INCOME_LEVELS; inc++) {
          const idx = cohortIndex(a, e, inc);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(COHORTS_PER_CITY);
          seen.add(idx);
        }
      }
    }
    expect(seen.size).toBe(COHORTS_PER_CITY);
  });

  it('wirft bei out-of-range', () => {
    expect(() => cohortIndex(4, 0, 0)).toThrow(/Altersgruppe/);
    expect(() => cohortIndex(0, 3, 0)).toThrow(/Bildung/);
    expect(() => cohortIndex(0, 0, 3)).toThrow(/Einkommen/);
  });
});

describe('Population', () => {
  it('add/total/workforce funktionieren; negative Bestände werden gekappt', () => {
    const pop = new Population();
    pop.ensureCity(1);
    pop.add(1, cohortIndex(1, 1, 0), 10);
    pop.add(1, cohortIndex(2, 1, 1), 5);
    pop.add(1, cohortIndex(0, 0, 0), 3);
    expect(pop.total(1)).toBe(18);
    expect(pop.workforce(1)).toBe(15); // Kinder zählen nicht

    pop.add(1, cohortIndex(1, 1, 0), -20);
    expect(pop.city(1)![cohortIndex(1, 1, 0)]).toBe(0);
  });

  it('unbekannte Stadt liefert 0', () => {
    const pop = new Population();
    expect(pop.total(5)).toBe(0);
    expect(pop.workforce(5)).toBe(0);
    expect(pop.city(5)).toBeNull();
  });

  it('Roundtrip über das Savegame', () => {
    const vec = new Array(COHORTS_PER_CITY).fill(0);
    vec[0] = 1;
    vec[1] = 2;
    vec[2] = 3;
    const restored = Population.deserialize([vec]);
    expect(restored.perCity.length).toBe(1);
    expect(restored.total(1)).toBe(6);
    expect(() => Population.deserialize([[1, 2]])).toThrow(/Länge/);
    expect(() => Population.deserialize([[...new Array(35).fill(0), -1]])).toThrow(/Kohortenwert/);
    expect(() => Population.deserialize('kaputt')).toThrow(/Array/);
  });
});

describe('World-Integration', () => {
  it('Gründung erzeugt Kohortenvektor; Roundtrip erhält Bevölkerung', () => {
    const w = new World(42, 128, 128);
    let spot = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        spot = i;
        break;
      }
    }
    w.enqueue({ kind: 'foundCity', x: spot % w.width, y: Math.floor(spot / w.width), name: 'Aurelia' });
    w.update();
    expect(w.population.total(1)).toBe(0);

    w.population.add(1, cohortIndex(1, 0, 0), 12);
    w.population.add(1, cohortIndex(3, 2, 2), 4);
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.population.total(1)).toBe(16);
    expect(restored.population.workforce(1)).toBe(12);
  });
});
