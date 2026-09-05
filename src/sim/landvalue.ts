/**
 * Bodenwert (M8.1): pro Stadt ein Index 0..1 aus der mittleren Fruchtbarkeit
 * der gezonten Tiles und Fluss-/Küstenbonus. Rückkopplung: Zufriedenheit
 * (demographics.computeSatisfaction) und damit Zuzug/Wegzug reagieren darauf.
 */
import { CITIES } from '../data/cities';
import type { World } from './world';

export function computeLandValue(world: World, cityId: number): number {
  const cx = world.cities.x[cityId - 1] ?? 0;
  const cy = world.cities.y[cityId - 1] ?? 0;
  const r = CITIES.maxZoneDistance;
  let sum = 0;
  let n = 0;
  let waterBonus = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
      const idx = y * world.width + x;
      sum += (world.layers.fertility[idx] ?? 0) / 255;
      n++;
      if ((world.layers.water[idx] ?? 0) === 1) waterBonus = Math.max(waterBonus, 0.2);
      if ((world.layers.river[idx] ?? 0) === 1) waterBonus = Math.max(waterBonus, 0.3);
    }
  }
  if (n === 0) return 0.5;
  return Math.min(1, sum / n + waterBonus);
}
