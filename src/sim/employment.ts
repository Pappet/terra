/**
 * Arbeitsplatz-Zuweisung (M4.3/M4.4): Erwerbsfähige werden gierig nach
 * Reisezeit den Städten mit freien Jobs zugeordnet – eigene Stadt zuerst,
 * Pendeln über Stadtgrenzen ausdrücklich erlaubt. Reisezeiten laufen
 * städtepaarweise über den A*-Cache (Zentrum zu Zentrum): Die Zuweisung ist
 * aggregiert (Mengen pro Städtepaar), nicht als Einzelfahrzeuge.
 *
 * Determinismus: feste Iterationsreihenfolge (Stadt-IDs aufsteigend,
 * Kandidaten nach (Reisezeit, Stadt-ID) sortiert), Zufall kommt hier nicht vor.
 */
import { GROWTH } from '../data/cities';
import { MOVEMENT, ROAD_BY_ID } from '../data/roads';
import { PathFinder } from './pathfinding';
import type { World } from './world';

import { EMPLOYMENT as _EMPLOYMENT } from '../data/employment';
export const EMPLOYMENT = _EMPLOYMENT;

export interface EmploymentState {
  /** flows[homeCity-1][jobCity-1] = Pendlerzahl. */
  flows: number[][];
  /** Beschäftigte pro Stadt (Wohnort). */
  employed: number[];
  /** Arbeitslose pro Stadt (Wohnort). */
  unemployed: number[];
  /** Offene Jobs pro Stadt (Arbeitsort). */
  openJobs: number[];
}

/** Freie Jobs einer Stadt (C+I-Gebäude mit Substanz). */
export function jobsOf(world: World, cityId: number): number {
  let jobs = 0;
  for (let i = 0; i < world.buildings.count; i++) {
    if (world.buildings.cityId[i] !== cityId) continue;
    const type = world.buildings.type[i] ?? 0;
    if (type !== 2 && type !== 3) continue;
    if ((world.buildings.condition[i] ?? 0) <= GROWTH.decayConditionThreshold) continue;
    jobs += GROWTH.jobsPerBuilding;
  }
  return jobs;
}

interface Route {
  cityId: number;
  time: number;
  /** Kleinste Kapazität entlang der Route (Stau-Deckel). */
  capacity: number;
}

function travelRoutesFrom(world: World, homeCity: number, pf: PathFinder): Route[] {
  const out: Route[] = [];
  const homeIdx = (world.cities.x[homeCity - 1] ?? 0) + (world.cities.y[homeCity - 1] ?? 0) * world.width;
  for (let c = 1; c <= world.cities.count; c++) {
    const jobIdx = (world.cities.x[c - 1] ?? 0) + (world.cities.y[c - 1] ?? 0) * world.width;
    if (homeCity === c) {
      out.push({ cityId: c, time: 0, capacity: Infinity });
      continue;
    }
    const result = pf.findPath(
      {
        width: world.width,
        height: world.height,
        tiles: world.tiles,
        water: world.layers.water,
        roads: world.roads,
        rev: world.roadRev, // eigener Cache-Raum (isolierte PathFinder-Instanz, M9.2)
      },
      homeIdx,
      jobIdx,
    );
    if (result === null || result.path.length === 0) continue; // nicht erreichbar
    out.push({ cityId: c, time: result.timeTicks, capacity: routeCapacity(world, result.path) });
  }
  out.sort((a, b) => a.time - b.time || a.cityId - b.cityId);
  return out;
}

/**
 * Routen-Cache (M9.2): Reisezeiten hängen nur von Straßen und Städtezentren ab.
 * Der Cache wird pro World über (roadRev, Stadtanzahl) invalidiert und nutzt
 * eine EIGENE PathFinder-Instanz — damit die roadRev-Keys nicht mit den
 * tileRev-Keys des geteilten Pfadfinders (Handel/Route-Anzeige) kollidieren.
 * Ergebnis identisch zur Direktberechnung, aber ohne n² findPath-Aufrufe pro Tick.
 */
interface RouteCacheEntry {
  key: string;
  routes: Route[][];
  pf: PathFinder;
}
const routeCache = new WeakMap<World, RouteCacheEntry>();

function routesFor(world: World): Route[][] {
  const key = `${world.roadRev}:${world.cities.count}`;
  const entry = routeCache.get(world);
  if (entry !== undefined && entry.key === key) return entry.routes;
  const pf = new PathFinder();
  const routes: Route[][] = [];
  for (let home = 1; home <= world.cities.count; home++) routes.push(travelRoutesFrom(world, home, pf));
  const fresh = { key, routes, pf };
  routeCache.set(world, fresh);
  return fresh.routes;
}

/** Kleinste Korridorkapazität entlang eines Pfades (Stau-Deckel). */
export function routeCapacity(world: World, path: readonly number[]): number {
  let min = Infinity;
  for (const idx of path) {
    const road = ROAD_BY_ID.get(world.roads[idx] ?? 0);
    const cap = road === undefined ? MOVEMENT.offroadCapacity : road.capacity;
    min = Math.min(min, cap);
  }
  return min;
}

/** Gewichtete mittlere Pendelzeit der Einwohner einer Stadt (0 ohne Pendler). */
export function averageCommuteTime(world: World, homeCity: number): number {
  const flows = world.commute?.flows[homeCity - 1];
  if (flows === undefined) return 0;
  const routes = new Map<number, number>();
  for (const route of routesFor(world)[homeCity - 1] ?? []) {
    routes.set(route.cityId, route.time);
  }
  let weighted = 0;
  let total = 0;
  for (let c = 1; c <= world.cities.count; c++) {
    const flow = flows[c - 1] ?? 0;
    if (flow <= 0) continue;
    weighted += flow * (routes.get(c) ?? 0);
    total += flow;
  }
  return total === 0 ? 0 : weighted / total;
}

/** Komplette Zuweisung neu rechnen (Determinismus: rein aus Weltzustand). */
export function assignWorkers(world: World): EmploymentState {
  const n = world.cities.count;
  const flows: number[][] = [];
  for (let i = 0; i < n; i++) flows.push(new Array<number>(n).fill(0));
  const openJobs: number[] = [];
  const employed: number[] = new Array<number>(n).fill(0);
  const unemployed: number[] = new Array<number>(n).fill(0);
  for (let c = 1; c <= n; c++) openJobs.push(jobsOf(world, c));
  const allRoutes = routesFor(world);

  for (let home = 1; home <= n; home++) {
    const workforce = world.population.workforce(home) * EMPLOYMENT.participationRate;
    let remaining = workforce;
    for (const route of allRoutes[home - 1] ?? []) {
      if (remaining <= 0) break;
      const jobCity = route.cityId;
      const available = openJobs[jobCity - 1] ?? 0;
      if (available <= 0) continue;
      // Stau/Kapazität (M4.4): ein Städtepaar trägt höchstens die
      // Korridorkapazität der Route; Überlauf geht weiter / bleibt arbeitslos.
      const take = Math.min(available, remaining, route.capacity);
      if (take <= 0) continue;
      flows[home - 1]![jobCity - 1] = (flows[home - 1]![jobCity - 1] ?? 0) + take;
      openJobs[jobCity - 1] = available - take;
      remaining -= take;
    }
    employed[home - 1] = workforce - remaining;
    unemployed[home - 1] = remaining;
  }

  return { flows, employed, unemployed, openJobs };
}
