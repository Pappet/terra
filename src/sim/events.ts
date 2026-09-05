/**
 * Ereignisse (M8.5): deterministisch über den Welt-RNG, geprüft je
 * Demografie-Intervall (world.update). Brand trifft ein zufälliges Gebäude
 * einer zufälligen Stadt (Substanzverlust), Missernte vernichtet einen
 * Anteil des Nahrungslagers einer zufälligen Stadt.
 */
import { EVENTS } from '../data/events';
import type { Rng } from './rng';
import type { World } from './world';

/** Gut-ID Nahrung (data/goods.ts). */
const GOOD_FOOD = 0;

/** Höchstens ein Ereignis pro Intervall; nichts zurückgeben (Wirkt direkt). */
export function runEventTick(world: World, rng: Rng): void {
  const cityCount = world.cities.count;
  if (cityCount === 0) return;
  if (!rng.chance(EVENTS.chancePerInterval)) return;
  const cityId = rng.int(1, cityCount);
  if (rng.chance(0.5)) {
    // Brand: ein zufälliges Gebäude der Stadt verliert Substanz
    const indices: number[] = [];
    for (let i = 0; i < world.buildings.count; i++) {
      if (world.buildings.cityId[i] === cityId) indices.push(i);
    }
    if (indices.length === 0) return;
    const target = rng.pick(indices);
    world.buildings.condition[target] = Math.max(
      0,
      (world.buildings.condition[target] ?? 0) - EVENTS.fireConditionLoss,
    );
  } else {
    // Missernte: Anteil des Nahrungslagers der Stadt verdorben
    const amount = world.storage.amount(cityId, GOOD_FOOD);
    if (amount > 0) world.storage.add(cityId, GOOD_FOOD, -amount * EVENTS.harvestLossShare);
  }
}
