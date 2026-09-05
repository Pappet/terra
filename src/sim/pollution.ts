/**
 * Verschmutzung (M8.3): Industriegebäude emittieren; das Layer wird aus den
 * Quellen neu gestempelt (Falloff, additiv, geklemmt), sobald sich der
 * Gebäudebestand ändert. Abgeleitetes Layer — nicht serialisiert.
 *
 * Rückkopplungen: Verschmutzung senkt die effektive Fruchtbarkeit (Farmen,
 * Bodenwert) und die Zufriedenheit (Abwanderungsdruck).
 */
import { CITIES } from '../data/cities';
import { POLLUTION } from '../data/pollution';
import type { World } from './world';

/** Verschmutzungslayer aus dem aktuellen Industriebestand neu stempeln. */
export function recomputePollution(world: World): void {
  const layer = world.pollution;
  layer.fill(0);
  const r = POLLUTION.radius;
  for (let i = 0; i < world.buildings.count; i++) {
    if ((world.buildings.type[i] ?? 0) !== 3) continue;
    const bx = world.buildings.x[i] as number;
    const by = world.buildings.y[i] as number;
    for (let dy = -r; dy <= r; dy++) {
      const y = by + dy;
      if (y < 0 || y >= world.height) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = bx + dx;
        if (x < 0 || x >= world.width) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const falloff = 1 - dist / (r + 1);
        const idx = y * world.width + x;
        layer[idx] = Math.min(255, (layer[idx] ?? 0) + POLLUTION.emissionPerBuilding * falloff);
      }
    }
  }
}

/**
 * Effektive Fruchtbarkeit eines Tiles (0..1): Weltgen-Fruchtbarkeit minus
 * Verschmutzungsverlust. Diese Funktion ist DIE Lese-API für Markt (Farm-
 * Rezept) und Bodenwert.
 */
export function effectiveFertility(world: World, idx: number): number {
  const fertility = (world.layers?.fertility?.[idx] ?? 0) / 255;
  const pollution = (world.pollution?.[idx] ?? 0) / 255;
  return fertility * (1 - POLLUTION.fertilityLossFactor * pollution);
}

/** Mittlere Verschmutzung (0..1) im Stadtgebiet (maxZoneDistance-Quadrat). */
export function averagePollution(world: World, cityId: number): number {
  const layer = (world as { pollution?: Uint8Array }).pollution;
  if (layer === undefined) return 0; // Fakes ohne Layer
  const cx = world.cities.x[cityId - 1] ?? 0;
  const cy = world.cities.y[cityId - 1] ?? 0;
  const r = CITIES.maxZoneDistance;
  let sum = 0;
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= world.height) continue;
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= world.width) continue;
      sum += (layer[y * world.width + x] ?? 0) / 255;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}
