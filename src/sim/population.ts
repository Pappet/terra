/**
 * Bevölkerung als Kohorten (M4.1): pro Stadt ein Vektor über
 * Altersgruppe × Bildung × Einkommen. Werte sind Menschen als float
 * (aggregierte Dynamik, Anzeige rundet). DOM-frei, serialisierbar.
 *
 * Altersgruppen: 0 = 0-14 (Kinder), 1 = 15-39, 2 = 40-64, 3 = 65+
 * Bildung:       0 = keine, 1 = Grundbildung, 2 = Hochschulbildung
 * Einkommen:     0 = niedrig, 1 = mittel, 2 = hoch
 */
export const AGE_BRACKETS = 4;
export const EDUCATION_LEVELS = 3;
export const INCOME_LEVELS = 3;
export const COHORTS_PER_CITY = AGE_BRACKETS * EDUCATION_LEVELS * INCOME_LEVELS;

/** Kohorten-Schwelle für Alterung: alle N Ticks rückt eine Altersgruppe weiter. */
import { AGE_TICK_INTERVAL as _AGE_TICK_INTERVAL } from '../data/demographics';
export const AGE_TICK_INTERVAL: number = _AGE_TICK_INTERVAL;

export function cohortIndex(age: number, education: number, income: number): number {
  if (age < 0 || age >= AGE_BRACKETS) throw new Error(`cohortIndex: Altersgruppe ${age}`);
  if (education < 0 || education >= EDUCATION_LEVELS) throw new Error(`cohortIndex: Bildung ${education}`);
  if (income < 0 || income >= INCOME_LEVELS) throw new Error(`cohortIndex: Einkommen ${income}`);
  return (age * EDUCATION_LEVELS + education) * INCOME_LEVELS + income;
}

export class Population {
  /** Pro Stadt (Index Stadt-ID - 1) ein Kohortenvektor. */
  perCity: Float64Array[] = [];

  ensureCity(cityId: number): void {
    while (this.perCity.length < cityId) this.perCity.push(new Float64Array(COHORTS_PER_CITY));
  }

  /** Vektor einer Stadt (0-basierter Index), oder null bei unbekannter Stadt. */
  city(cityId: number): Float64Array | null {
    return this.perCity[cityId - 1] ?? null;
  }

  add(cityId: number, cohort: number, delta: number): void {
    this.ensureCity(cityId);
    const vec = this.perCity[cityId - 1] as Float64Array;
    vec[cohort] = Math.max(0, (vec[cohort] ?? 0) + delta);
  }

  total(cityId: number): number {
    const vec = this.city(cityId);
    if (vec === null) return 0;
    let sum = 0;
    for (let i = 0; i < vec.length; i++) sum += vec[i] ?? 0;
    return sum;
  }

  /** Erwerbsfähige (Altersgruppen 1 und 2). */
  workforce(cityId: number): number {
    const vec = this.city(cityId);
    if (vec === null) return 0;
    let sum = 0;
    for (let e = 0; e < EDUCATION_LEVELS; e++) {
      for (let inc = 0; inc < INCOME_LEVELS; inc++) {
        sum += vec[cohortIndex(1, e, inc)] ?? 0;
        sum += vec[cohortIndex(2, e, inc)] ?? 0;
      }
    }
    return sum;
  }

  serialize(): number[][] {
    return this.perCity.map((vec) => Array.from(vec));
  }

  static deserialize(data: unknown): Population {
    if (typeof data !== 'object' || data === null || !Array.isArray(data)) {
      throw new Error('Savegame: population fehlt oder ist kein Array');
    }
    const pop = new Population();
    for (const raw of data as unknown[]) {
      if (!Array.isArray(raw) || raw.length !== COHORTS_PER_CITY) {
        throw new Error(`Savegame: Kohortenvektor hat nicht Länge ${COHORTS_PER_CITY}`);
      }
      const vec = new Float64Array(COHORTS_PER_CITY);
      for (let i = 0; i < COHORTS_PER_CITY; i++) {
        const v = raw[i];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          throw new Error(`Savegame: Kohortenwert ${String(v)} ungültig`);
        }
        vec[i] = v;
      }
      pop.perCity.push(vec);
    }
    return pop;
  }
}
