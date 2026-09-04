/**
 * Bevölkerungsdynamik (M4.2): Alterung (Kohorten rücken alle
 * AGE_TICK_INTERVAL Ticks weiter), Geburten (kapazitätsbegrenzt durch
 * Wohnhäuser) und Sterbefälle je Altersgruppe. Deterministisch über RNG.
 *
 * Bildung wandert mit: Kinder werden mit Wahrscheinlichkeit
 * childEducationChance Grundgebildete; junge Erwachsene erhalten mit
 * higherEducationChance Hochschulbildung beim Wechsel in Gruppe 2.
 */
import { DEMOGRAPHICS } from '../data/demographics';
import { GROWTH } from '../data/cities';
import {
  AGE_BRACKETS,
  AGE_TICK_INTERVAL,
  EDUCATION_LEVELS,
  INCOME_LEVELS,
  cohortIndex,
} from './population';
import type { Rng } from './rng';
import type { World } from './world';

function housesOf(world: World, cityId: number): number {
  let houses = 0;
  for (let i = 0; i < world.buildings.count; i++) {
    if (world.buildings.cityId[i] !== cityId) continue;
    if ((world.buildings.type[i] ?? 0) !== 1) continue;
    if ((world.buildings.condition[i] ?? 0) <= GROWTH.decayConditionThreshold) continue;
    houses++;
  }
  return houses;
}

function sumAdults(vec: Float64Array): number {
  let sum = 0;
  for (let e = 0; e < EDUCATION_LEVELS; e++) {
    for (let inc = 0; inc < INCOME_LEVELS; inc++) {
      sum += (vec[cohortIndex(1, e, inc)] ?? 0) + (vec[cohortIndex(2, e, inc)] ?? 0);
    }
  }
  return sum;
}

/** Ein Demografie-Tick (von World.update aufgerufen; wirkt nur im Intervall). */
export function runDemographicsTick(world: World, rng: Rng, tick: number): void {
  if (tick % AGE_TICK_INTERVAL !== 0) return;

  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    const vec = world.population.city(cityId);
    if (vec === null) continue;
    const next = new Float64Array(vec.length);

    // 1) Alterung mit Bildungswanderung und Sterbefällen
    for (let e = 0; e < EDUCATION_LEVELS; e++) {
      for (let inc = 0; inc < INCOME_LEVELS; inc++) {
        for (let age = 0; age < AGE_BRACKETS; age++) {
          const count = vec[cohortIndex(age, e, inc)] ?? 0;
          if (count <= 0) continue;
          const mortality = DEMOGRAPHICS.mortalityPerInterval[age] ?? 0;
          const survivors = count * (1 - mortality);
          if (age === AGE_BRACKETS - 1) {
            // Älteste Gruppe bleibt stehen und dünnt aus
            const target = cohortIndex(age, e, inc);
            next[target] = (next[target] ?? 0) + survivors;
            continue;
          }
          let newEdu = e;
          if (age === 0) {
            newEdu = rng.chance(DEMOGRAPHICS.childEducationChance) ? Math.max(1, e) : e;
          } else if (age === 1) {
            if (rng.chance(DEMOGRAPHICS.higherEducationChance)) newEdu = Math.min(EDUCATION_LEVELS - 1, e + 1);
          }
          const target = cohortIndex(age + 1, newEdu, inc);
          next[target] = (next[target] ?? 0) + survivors;
        }
      }
    }

    // 2) Geburten: proportional zu Erwachsenen, begrenzt durch Wohnkapazität
    const adultTotal = sumAdults(next);
    const capacity = housesOf(world, cityId) * GROWTH.residentsPerHouse;
    let total = 0;
    for (let i = 0; i < next.length; i++) total += next[i] ?? 0;
    const births = Math.min(adultTotal * DEMOGRAPHICS.birthRatePerInterval, Math.max(0, capacity - total));
    if (births > 0 && adultTotal > 0) {
      // Verteilung auf Bildungsgruppen nach Elternanteil; Einkommen nach Bildung
      for (let e = 0; e < EDUCATION_LEVELS; e++) {
        let parents = 0;
        for (let inc = 0; inc < INCOME_LEVELS; inc++) {
          parents += (next[cohortIndex(1, e, inc)] ?? 0) + (next[cohortIndex(2, e, inc)] ?? 0);
        }
        const part = births * (parents / adultTotal);
        if (part > 0) {
          const inc = e === 0 ? 0 : 1;
          next[cohortIndex(0, e, inc)] = (next[cohortIndex(0, e, inc)] ?? 0) + part;
        }
      }
    }
    world.population.perCity[cityId - 1] = next;
  }
}

/** Hilfsfunktion für Tests/UI: Wohnkapazität einer Stadt. */
export function housingCapacity(world: World, cityId: number): number {
  return housesOf(world, cityId) * GROWTH.residentsPerHouse;
}
