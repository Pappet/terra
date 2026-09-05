/**
 * Versorgungsnetze (M8.4): Von jedem Stadtzentrum aus wird das Straßennetz
 * per BFS erschlossen; Zentrum, erschlossene Straßentiles und ihr 1-Halo
 * gelten als versorgt. Abgeleitetes Layer — nicht serialisiert (Laden
 * rechnet neu). Gebäude ohne Versorgung produzieren mit reduzierter Rate.
 */
import type { World } from './world';

/** Versorgungslayer aus Zentren + Straßengraph neu berechnen. */
export function recomputeSupply(world: World): void {
  const size = world.width * world.height;
  const supply = world.supply;
  supply.fill(0);
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    const cx = world.cities.x[cityId - 1] ?? 0;
    const cy = world.cities.y[cityId - 1] ?? 0;
    const start = cy * world.width + cx;
    if (visited[start] === 1) continue; // Zentrum im Netz einer Nachbartstadt
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const netStart = tail - 1;
    while (head < tail) {
      const idx = queue[head++] as number;
      const x = idx % world.width;
      for (const n of [x > 0 ? idx - 1 : -1, x < world.width - 1 ? idx + 1 : -1, idx - world.width, idx + world.width]) {
        if (n < 0 || n >= size || visited[n] === 1) continue;
        if ((world.roads[n] ?? 0) === 0) continue;
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    // Netz-Tiles (Zentrum + verbundene Straßen) und ihr 1-Halo versorgen.
    for (let q = netStart; q < tail; q++) {
      const idx = queue[q] as number;
      supply[idx] = 1;
      const x = idx % world.width;
      for (const n of [x > 0 ? idx - 1 : -1, x < world.width - 1 ? idx + 1 : -1, idx - world.width, idx + world.width]) {
        if (n >= 0 && n < size) supply[n] = 1;
      }
    }
  }
}

/** Ist das Tile ans Versorgungsnetz angebunden? (Fakes ohne Layer: ja) */
export function isSupplied(world: World, idx: number): boolean {
  const supply = (world as { supply?: Uint8Array }).supply;
  return supply === undefined ? true : (supply[idx] ?? 0) === 1;
}
