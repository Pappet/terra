/**
 * Produktion (M5.2): Rezeptauswahl bei Fertigstellung (D006) und
 * Produktionstick — Gebäude wandeln Inputs unter Einsatz von Arbeitskraft
 * in Outputs. Hart engpassgetrieben: Fehlt ein Input, fällt der Output
 * komplett aus (das ist der messbare M5.6-Mechanismus).
 *
 * Arbeitskraft: die beschäftigten Arbeiter der Stadt (Assignment M4.3) werden
 * in fester Gebäude-Reihenfolge zugeteilt; Produktionsrate = Anteil der
 * besetzten Arbeitskraft. Deterministisch, kein Zufall.
 */
import { RECIPES, RECIPE_BY_ID, type Recipe, type RecipeRequirement } from '../data/goods';
import { FINANCE } from '../data/cities';
import { NETWORKS } from '../data/networks';
import { effectiveFertility } from './pollution';
import { isSupplied } from './networks';
import type { TickFlows } from './market';
import type { World } from './world';

/** Prüft eine Umgebungsbedingung (D006) am Gebäude-Tile. */
export function requirementMet(world: World, idx: number, req: RecipeRequirement): boolean {
  if (req.kind === 'fertility') {
    // M8.3: Verschmutzung senkt die effektive Fruchtbarkeit
    return effectiveFertility(world, idx) >= (req.min ?? 0);
  }
  const width = world.width;
  const x = idx % width;
  const y = Math.floor(idx / width);
  for (let dy = -req.radius; dy <= req.radius; dy++) {
    for (let dx = -req.radius; dx <= req.radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= world.height) continue;
      const n = ny * width + nx;
      if (req.kind === 'deposit' && ((world.layers.deposits[n] ?? 0) & (req.bits ?? 0)) !== 0) return true;
      if (req.kind === 'forest' && (world.layers.forest[n] ?? 0) === 1) return true;
    }
  }
  return false;
}

/**
 * Rezeptauswahl (D006): gültige Rezepte nach Umgebung, dann Kettenausgleich
 * (wenigste Produzenten in der Stadt, Tie-Break niedrigste ID). Liefert null,
 * wenn nichts gültig ist (Gebäude bleibt rezeptlos).
 */
export function chooseRecipe(world: World, cityId: number, idx: number, buildingType: number): Recipe | null {
  let best: Recipe | null = null;
  let bestCount = Infinity;
  for (const recipe of RECIPES) {
    if (recipe.buildingType !== buildingType) continue;
    if (recipe.requires !== null && !requirementMet(world, idx, recipe.requires)) continue;
    let count = 0;
    for (let i = 0; i < world.buildings.count; i++) {
      if (world.buildings.cityId[i] === cityId && (world.buildings.recipe[i] ?? -1) === recipe.id) count++;
    }
    if (count < bestCount) {
      bestCount = count;
      best = recipe;
    }
  }
  return best;
}

/** Ein Produktionstick; liefert die Güterflüsse pro Stadt für den Markt. */
export function runProductionTick(world: World): Map<number, TickFlows> {
  const flows = new Map<number, TickFlows>();
  // Gebäudeunterhalt (M5.4): laufende Kosten neben dem Strassennetz
  world.treasury -= world.buildings.count * FINANCE.buildingUpkeepPerTick;
  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    let workers = world.commute?.employed[cityId - 1] ?? 0;
    if (workers <= 0) continue;
    flows.set(cityId, { produced: new Float64Array(0), consumed: new Float64Array(0) });
    const flow = flows.get(cityId)!;
    flow.produced = new Float64Array(6);
    flow.consumed = new Float64Array(6);
    for (let i = 0; i < world.buildings.count && workers > 0; i++) {
      if (world.buildings.cityId[i] !== cityId) continue;
      const recipe = RECIPE_BY_ID.get(world.buildings.recipe[i] ?? -1);
      if (recipe === undefined) continue;
      const allotted = Math.min(workers, recipe.workers);
      workers -= allotted;
      // M8.4: Gebäude ohne Netzanschluss produzieren mit reduzierter Rate
      const bx = world.buildings.x[i] as number;
      const by = world.buildings.y[i] as number;
      const supplyFactor = isSupplied(world, by * world.width + bx) ? 1 : NETWORKS.unsuppliedRateFactor;
      const rate = (allotted / recipe.workers) * supplyFactor;

      // Engpass: jeder fehlende Input stoppt die Produktion komplett
      let inputsOk = true;
      for (const input of recipe.input) {
        if (world.storage.amount(cityId, input.good) < input.amount * rate) {
          inputsOk = false;
          break;
        }
      }
      if (!inputsOk) continue;
      for (const input of recipe.input) {
        const amount = input.amount * rate;
        world.storage.add(cityId, input.good, -amount);
        flow.consumed[input.good] = (flow.consumed[input.good] ?? 0) + amount;
      }
      if (recipe.output.amount > 0) {
        const amount = recipe.output.amount * rate;
        world.storage.add(cityId, recipe.output.good, amount);
        flow.produced[recipe.output.good] = (flow.produced[recipe.output.good] ?? 0) + amount;
      }
    }
  }
  return flows;
}
