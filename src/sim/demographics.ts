/**
 * Bevölkerungsdynamik (M4.2) und Migration (M4.5). Alterung (Kohorten rücken
 * alle AGE_TICK_INTERVAL Ticks weiter), Geburten (kapazitätsbegrenzt durch
 * Wohnhäuser), Sterbefälle je Altersgruppe; Zufriedenheit aus Arbeits-
 * versorgung, Pendelzeit und Wohnraum steuert Zuzug und Wegzug.
 * Deterministisch über den Welt-RNG.
 */
import { DEMOGRAPHICS, MIGRATION } from '../data/demographics';
import { FINANCE, GROWTH } from '../data/cities';
import {
  AGE_BRACKETS,
  AGE_TICK_INTERVAL,
  EDUCATION_LEVELS,
  INCOME_LEVELS,
  cohortIndex,
} from './population';
import { averageCommuteTime } from './employment';
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

/** Kreditlimit: maxDebtPerAdult × Erwachsene über alle Städte. */
export function computeMaxDebt(world: World): number {
  let adults = 0;
  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    const vec = world.population.city(cityId);
    if (vec === null) continue;
    for (let e = 0; e < EDUCATION_LEVELS; e++) {
      for (let inc = 0; inc < INCOME_LEVELS; inc++) {
        adults += (vec[cohortIndex(1, e, inc)] ?? 0) + (vec[cohortIndex(2, e, inc)] ?? 0);
      }
    }
  }
  return adults * FINANCE.maxDebtPerAdult;
}

/** Wohnkapazität einer Stadt (Häuser × Bewohner pro Haus). */
export function housingCapacity(world: World, cityId: number): number {
  return housesOf(world, cityId) * GROWTH.residentsPerHouse;
}

/**
 * Demografie-Tick (M4.2); wirkt nur alle AGE_TICK_INTERVAL Ticks und liefert
 * dann true (u.a. Invalidierung der Arbeitsplatz-Zuweisung).
 */
export function runDemographicsTick(world: World, rng: Rng, tick: number): boolean {
  if (tick % AGE_TICK_INTERVAL !== 0) return false;

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
    const capacity = housingCapacity(world, cityId);
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

  // 2b) Kredite (M7.3): Zins auf Restschuld (Bankrott-Prüfung läuft in world.update)
  world.maxDebt = computeMaxDebt(world);
  if (world.debt > 0) {
    const interest = world.debt * FINANCE.loanInterestPerInterval;
    world.treasury -= interest;
    world.debt += interest; // Zins wird kapitalisiert (Tilgung per repayLoan)
  }

  // 3) Steuern (M5.4): Einnahmen nach Einwohnern und Einkommensgruppe
  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    const vec = world.population.city(cityId);
    if (vec === null) continue;
    let taxes = 0;
    for (let e = 0; e < EDUCATION_LEVELS; e++) {
      for (let inc = 0; inc < INCOME_LEVELS; inc++) {
        const adults =
          (vec[cohortIndex(1, e, inc)] ?? 0) + (vec[cohortIndex(2, e, inc)] ?? 0);
        taxes += adults * FINANCE.taxPerAdultPerInterval * (FINANCE.incomeFactor[inc] ?? 1) * world.taxRate;
      }
    }
    world.treasury += taxes;
  }

  // 4) Migration (M4.5) läuft im selben Intervall
  runMigration(world, rng);
  return true;
}

/**
 * Zufriedenheit einer Stadt (0..1) aus Arbeitsversorgung, Pendelzeit und
 * Wohnraum (M4.5). Liest die aktuelle Pendler-Zuweisung.
 */
export function computeSatisfaction(world: World, cityId: number): number {
  const residents = world.population.total(cityId);
  const vec = world.population.city(cityId);
  let adults = 0;
  if (vec !== null) {
    for (let e = 0; e < EDUCATION_LEVELS; e++) {
      for (let inc = 0; inc < INCOME_LEVELS; inc++) {
        adults += (vec[cohortIndex(1, e, inc)] ?? 0) + (vec[cohortIndex(2, e, inc)] ?? 0);
      }
    }
  }
  const employed = world.commute?.employed[cityId - 1] ?? 0;
  // Beschäftigungsanteil der Erwachsenen; ohne Erwachsene neutral 1.
  const employmentRatio = adults <= 0 ? 1 : Math.min(1, employed / adults);
  const commuteScore = 1 - Math.min(1, averageCommuteTime(world, cityId) / MIGRATION.commuteToleranceTicks);
  const capacity = housingCapacity(world, cityId);
  const housingScore = residents <= 0 ? 1 : Math.min(1, capacity / Math.max(1, residents));

  const taxBurden = world.taxRate * FINANCE.taxBurdenOnSatisfaction;
  return Math.min(
    1,
    Math.max(
      0,
      MIGRATION.weightEmployment * employmentRatio +
        MIGRATION.weightCommute * commuteScore +
        MIGRATION.weightHousing * housingScore -
        taxBurden,
    ),
  );
}

/**
 * Migration (M4.5): Zuzug bei Zufriedenheit über der Schwelle (in freie
 * Wohnkapazität), Wegzug darunter. Deterministisch über den Welt-RNG.
 */
export function runMigration(world: World, rng: Rng): void {
  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    const satisfaction = computeSatisfaction(world, cityId);
    const residents = world.population.total(cityId);
    const capacity = housingCapacity(world, cityId);

    if (satisfaction >= MIGRATION.immigrationThreshold) {
      const free = Math.max(0, capacity - residents);
      const newcomers =
        free * MIGRATION.immigrationRate * ((satisfaction - MIGRATION.immigrationThreshold) / (1 - MIGRATION.immigrationThreshold));
      if (newcomers > 0) {
        const edu = rng.chance(MIGRATION.immigrantEducationChance) ? 1 : 0;
        world.settleResidents(cityId, cohortIndex(1, edu, 0), newcomers);
      }
    } else if (satisfaction < MIGRATION.departureThreshold && residents > 0) {
      const leavers =
        residents * MIGRATION.departureRate * ((MIGRATION.departureThreshold - satisfaction) / MIGRATION.departureThreshold);
      const vec = world.population.city(cityId);
      if (vec !== null) {
        for (let i = 0; i < vec.length; i++) {
          const count = vec[i] ?? 0;
          if (count > 0) world.settleResidents(cityId, i, -count * (leavers / residents));
        }
      }
    }
  }
}
