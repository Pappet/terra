/**
 * Nachfragmodell (M3.3): reine Funktion von Gebäudebeständen zu Nachfrage-
 * werten pro Zonentyp (0..1). Vollbelegung: residents = Häuser × Bewohner;
 * M4 ersetzt die Vollbelegung durch echte Kohorten.
 */
import { GROWTH } from '../data/cities';

export interface CityStats {
  houses: number;
  shops: number;
  factories: number;
}

export interface Demand {
  residential: number;
  commercial: number;
  industrial: number;
}

export function computeStats(cityId: number, buildings: { count: number; cityId: number[]; type: number[]; condition: number[] }): CityStats {
  let houses = 0;
  let shops = 0;
  let factories = 0;
  for (let i = 0; i < buildings.count; i++) {
    if (buildings.cityId[i] !== cityId) continue;
    if ((buildings.condition[i] ?? 0) <= GROWTH.decayConditionThreshold) continue;
    const type = buildings.type[i] ?? 0;
    if (type === 1) houses++;
    else if (type === 2) shops++;
    else if (type === 3) factories++;
  }
  return { houses, shops, factories };
}

export function computeDemand(stats: CityStats): Demand {
  const residents = stats.houses * GROWTH.residentsPerHouse;
  const jobs = (stats.shops + stats.factories) * GROWTH.jobsPerBuilding;

  // Wohnen: Grunddruck + Arbeitsplatzüberschuss zieht Zuzug.
  const jobSurplus = Math.max(0, jobs - residents * GROWTH.targetJobsPerResident);
  const residential = clamp(
    GROWTH.baseResidentialDemand + jobSurplus / Math.max(1, stats.houses + 1),
    0,
    1,
  );

  // Gewerbe/Industrie: Einwohner erzeugen Nachfrage nach Arbeitsplätzen.
  const wantedShops = residents * GROWTH.targetShopsPerResident;
  const commercial = clamp(
    (wantedShops - stats.shops) / Math.max(1, wantedShops),
    0,
    1,
  );
  const wantedFactories = residents * GROWTH.targetFactoriesPerResident;
  const industrial = clamp(
    (wantedFactories - stats.factories) / Math.max(1, wantedFactories),
    0,
    1,
  );

  return { residential, commercial, industrial };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
