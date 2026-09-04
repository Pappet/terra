/**
 * Wachstumssystem (M3.4): pro Tick Verfall ohne Strassenanschluss und Bau
 * auf gezonten Tiles nach Nachfrage (M3.3). Deterministisch: feste
 * Iterationsreihenfolge, Zufall ausschliesslich über den Welt-RNG.
 *
 * "Lage" bedeutet in M3 Strassenanschluss (4er-Nachbarschaft); Distanz- und
 * Bodenwert-Effekte kommen mit M8 dazu.
 */
import { GROWTH } from '../data/cities';
import type { Rng } from './rng';
import { computeDemand, computeStats } from './demand';
import type { World } from './world';

/** Hat das Tile einen Strassenanschluss in der 4er-Nachbarschaft? */
export function hasRoadAccess(world: World, idx: number): boolean {
  const width = world.width;
  const x = idx % width;
  const roads = world.roads;
  const up = idx - width;
  const down = idx + width;
  const left = x > 0 ? idx - 1 : -1;
  const right = x < width - 1 ? idx + 1 : -1;
  for (const n of [up, down, left, right]) {
    if (n >= 0 && n < roads.length && (roads[n] ?? 0) !== 0) return true;
  }
  return false;
}

/** Ein Wachstums-Tick: Verfall, dann Neubau nach Nachfrage. */
export function runGrowthTick(world: World, rng: Rng): void {
  // 1) Verfall: Gebäude ohne Anschluss verlieren Substanz, bis sie fallen.
  for (let i = world.buildings.count - 1; i >= 0; i--) {
    const x = world.buildings.x[i] as number;
    const y = world.buildings.y[i] as number;
    const idx = y * world.width + x;
    if (hasRoadAccess(world, idx)) continue;
    const condition = (world.buildings.condition[i] ?? 0) - GROWTH.decayPerTickWithoutRoad;
    if (condition <= GROWTH.decayConditionThreshold) {
      world.removeBuildingAt(i); // bietet gezontes Tile wieder an, falls Zone besteht
    } else {
      world.buildings.condition[i] = condition;
    }
  }

  // 2) Neubau: pro Stadt nach Nachfrage auf gezonten, angeschlossenen Tiles.
  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    const stats = computeStats(cityId, world.buildings);
    const demand = computeDemand(stats);
    const demandForZone = (zone: number): number =>
      zone === 1 ? demand.residential : zone === 2 ? demand.commercial : demand.industrial;

    const tiles = world.cityZoneTiles[cityId - 1];
    if (tiles === undefined) continue;
    let builds = 0;
    let i = 0;
    while (i < tiles.length && builds < GROWTH.maxConstructionsPerCityPerTick) {
      const idx = tiles[i] as number;
      const zone = world.zoneType[idx] ?? 0;
      const demandValue = demandForZone(zone);
      if (demandValue > 0 && rng.chance(GROWTH.constructionChance * demandValue)) {
        if (!hasRoadAccess(world, idx)) {
          i++;
          continue;
        }
        const x = idx % world.width;
        const y = Math.floor(idx / world.width);
        world.addBuildingAt(cityId, x, y, zone); // entfernt das Tile aus der Liste
        builds++;
        // kein i++: das nächste Kandidat-Tile rückt auf Position i
      } else {
        i++;
      }
    }
  }
}
