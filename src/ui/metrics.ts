/**
 * Abgeleitete Kennzahlen für die Oberfläche (M10.0). Bündelt die Lesezugriffe
 * auf die Sim an einer Stelle, damit Topbar und Inspektor dieselben Zahlen
 * zeigen. Kein Schreibzugriff, keine Zwischenspeicherung.
 */
import { FINANCE, GROWTH } from '../data/cities';
import { computeDemand, computeStats, type Demand } from '../sim/demand';
import { computeSatisfaction, computeTaxIncome, housingCapacity } from '../sim/demographics';
import { jobsOf } from '../sim/employment';
import { AGE_TICK_INTERVAL } from '../sim/population';
import type { World } from '../sim/world';

export interface RegionMetrics {
  readonly cities: number;
  readonly residents: number;
  readonly capacity: number;
  readonly jobs: number;
  readonly buildings: number;
  readonly satisfaction: number;
  readonly taxIncome: number;
  readonly roadUpkeep: number;
  readonly buildingUpkeep: number;
  readonly netPerTick: number;
}

export function regionMetrics(world: World): RegionMetrics {
  let residents = 0;
  let capacity = 0;
  let jobs = 0;
  let satisfactionSum = 0;
  for (let c = 1; c <= world.cities.count; c++) {
    residents += world.population.total(c);
    capacity += housingCapacity(world, c);
    jobs += jobsOf(world, c);
    satisfactionSum += computeSatisfaction(world, c);
  }
  const roadUpkeep = world.upkeepPerTick;
  const buildingUpkeep = world.buildings.count * FINANCE.buildingUpkeepPerTick;
  const taxIncome = computeTaxIncome(world);
  return {
    cities: world.cities.count,
    residents,
    capacity,
    jobs,
    buildings: world.buildings.count,
    satisfaction: world.cities.count > 0 ? satisfactionSum / world.cities.count : 0,
    taxIncome,
    roadUpkeep,
    buildingUpkeep,
    netPerTick: taxIncome / AGE_TICK_INTERVAL - roadUpkeep - buildingUpkeep,
  };
}

export interface CityMetrics {
  readonly id: number;
  readonly name: string;
  readonly residents: number;
  readonly capacity: number;
  readonly jobs: number;
  readonly satisfaction: number;
  readonly demand: Demand;
  readonly houses: number;
  readonly shops: number;
  readonly factories: number;
  readonly employed: number;
  readonly unemployed: number;
  readonly openJobs: number;
}

export function cityMetrics(world: World, cityId: number): CityMetrics {
  const stats = computeStats(cityId, world.buildings);
  const commute = world.commute;
  return {
    id: cityId,
    name: world.cities.names[cityId - 1] ?? `Stadt ${cityId}`,
    residents: world.population.total(cityId),
    capacity: stats.houses * GROWTH.residentsPerHouse,
    jobs: jobsOf(world, cityId),
    satisfaction: computeSatisfaction(world, cityId),
    demand: computeDemand(stats),
    houses: stats.houses,
    shops: stats.shops,
    factories: stats.factories,
    employed: commute?.employed[cityId - 1] ?? 0,
    unemployed: commute?.unemployed[cityId - 1] ?? 0,
    openJobs: commute?.openJobs[cityId - 1] ?? 0,
  };
}
