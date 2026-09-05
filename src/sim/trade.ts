/**
 * Handel (M6): aggregierte Güterflüsse zwischen Städten.
 *
 * Arbitrage (M6.2): Für jedes Städtepaar und Gut wird Handel determined aus
 * der Preisdifferenz — sie muss die Transportkosten (Reisezeit × Kostenfaktor)
 * plus Mindestmarge übersteigen. Richtung: vom billigen zum teuren Lager.
 *
 * Kapazität (M6.3): Die Korridorkapazität der Route (kleinste Straßenkapazität,
 * siehe employment.routeCapacity) deckelt die Summe aller Güter eines Paares
 * pro Tick; Güter werden nach Marge (Tie-Break Gut-ID) priorisiert — Verstopfung.
 *
 * Alles aggregiert (Mengen pro Paar/Gut/Tick), keine Einzelfahrzeuge.
 * Deterministisch: feste Reihenfolgen, kein Zufall.
 */
import { GOOD_COUNT, MARKET } from '../data/goods';
import { TRADE } from '../data/trade';
import type { World } from './world';
import { routeCapacity } from './employment';
export { TRADE };

export interface TradeRouteInfo {
  from: number;
  to: number;
  time: number;
  capacity: number;
}

export interface TradeState {
  /** Zuletzt aktive Routen (Debug/Overlay). Transient. */
  routes: TradeRouteInfo[];
  /** flows[from-1][to-1][good] = Menge im letzten Tick. Transient. */
  flows: number[][][];
  /** Kumulierte Exportmenge pro Stadt × Gut. Serialisiert. */
  exports: Float64Array[];
  /** Kumulierte Importmenge pro Stadt × Gut. Serialisiert. */
  imports: Float64Array[];
}

function emptyMatrix(): number[][][] {
  const m: number[][][] = [];
  return m;
}

export function createTradeState(): TradeState {
  return { routes: [], flows: emptyMatrix(), exports: [], imports: [] };
}

/** Sicherstellen, dass die Matrizen/Vektoren zur Stadtanzahl passen. */
export function ensureTradeSize(state: TradeState, cities: number): void {
  while (state.exports.length < cities) {
    state.exports.push(new Float64Array(GOOD_COUNT));
    state.imports.push(new Float64Array(GOOD_COUNT));
  }
  while (state.flows.length < cities) {
    const a: number[][] = [];
    for (let j = 0; j < cities; j++) a.push(new Array<number>(GOOD_COUNT).fill(0));
    state.flows.push(a);
  }
  // Bestehende Zeilen mitwachsen lassen (Städte können später gegründet werden)
  for (const row of state.flows) {
    while (row.length < cities) row.push(new Array<number>(GOOD_COUNT).fill(0));
  }
}

/** Zentrum-Tile einer Stadt. */
function centerIdx(world: World, cityId: number): number {
  return (
    (world.cities.x[cityId - 1] ?? 0) + (world.cities.y[cityId - 1] ?? 0) * world.width
  );
}

/**
 * Ein Handelstick: Arbitrage entscheidet, Korridore deckeln, Flüsse bewegen
 * Güter und die Bilanzen laufen mit. Deterministisch.
 */
export function runTradeTick(world: World): void {
  const state = world.trade;
  const n = world.cities.count;
  ensureTradeSize(state, n);
  state.routes = [];

  // 1) Routen pro UNGEORDETEM Paar (ein Budget pro Paar — sonst versenden
  //    beide Richtungen dieselbe profitable Richtung doppelt)
  for (let a = 1; a <= n; a++) {
    for (let b = a + 1; b <= n; b++) {
      const result = world.pathfinder.findPath(
        {
          width: world.width,
          height: world.height,
          tiles: world.tiles,
          water: world.layers.water,
          roads: world.roads,
          rev: world.roadRev, // Routen hängen nur von Straßen ab — Bauaktivität invalidiert nicht (M9.2)
        },
        centerIdx(world, a),
        centerIdx(world, b),
      );
      if (result === null || result.path.length === 0) continue;
      const capacity = routeCapacity(world, result.path);
      const time = result.timeTicks;
      state.routes.push({ from: a, to: b, time, capacity });

      // 2) Flüsse zurücksetzen (für dieses Paar)
      for (let g = 0; g < GOOD_COUNT; g++) {
        state.flows[a - 1]![b - 1]![g] = 0;
        state.flows[b - 1]![a - 1]![g] = 0;
      }

      // 3) Arbitrage: beide Richtungen konkurrieren um EIN Korridorbudget
      const transportCost = time * TRADE.transportCostPerTimeUnit;
      let budget = capacity;

      const candidates: Array<{ good: number; margin: number; from: number; to: number; max: number }> = [];
      for (let g = 0; g < GOOD_COUNT; g++) {
        const priceA = world.market.price(a, g);
        const priceB = world.market.price(b, g);
        const marginAB = priceB - priceA - transportCost;
        const marginBA = priceA - priceB - transportCost;

        if (marginAB >= TRADE.minMargin) {
          const free = Math.max(0, world.storage.amount(a, g) - TRADE.reserveStock);
          const absorb = Math.max(0, MARKET.targetStock - world.storage.amount(b, g));
          const max = Math.min(free, absorb);
          if (max > 0) candidates.push({ good: g, margin: marginAB, from: a, to: b, max });
        } else if (marginBA >= TRADE.minMargin) {
          const free = Math.max(0, world.storage.amount(b, g) - TRADE.reserveStock);
          const absorb = Math.max(0, MARKET.targetStock - world.storage.amount(a, g));
          const max = Math.min(free, absorb);
          if (max > 0) candidates.push({ good: g, margin: marginBA, from: b, to: a, max });
        }
      }
      candidates.sort((x, y) => y.margin - x.margin || x.good - y.good || x.from - y.from);

      for (const cand of candidates) {
        if (budget <= 0) break;
        const amount = Math.min(budget, cand.max);
        if (amount <= 0) continue;
        const taken = world.storage.take(cand.from, cand.good, amount);
        if (taken <= 0) continue;
        world.storage.add(cand.to, cand.good, taken);
        budget -= taken;
        state.flows[cand.from - 1]![cand.to - 1]![cand.good] =
          (state.flows[cand.from - 1]![cand.to - 1]![cand.good] ?? 0) + taken;
        state.exports[cand.from - 1]![cand.good] =
          (state.exports[cand.from - 1]![cand.good] ?? 0) + taken;
        state.imports[cand.to - 1]![cand.good] =
          (state.imports[cand.to - 1]![cand.good] ?? 0) + taken;
      }
    }
  }
}

/** Exportbilanz einer Stadt (Summe über Güter). */
export function exportBalance(world: World, cityId: number): number {
  const vec = world.trade.exports[cityId - 1];
  if (vec === undefined) return 0;
  let sum = 0;
  for (let g = 0; g < GOOD_COUNT; g++) sum += vec[g] ?? 0;
  return sum;
}

/** Importbilanz einer Stadt (Summe über Güter). */
export function importBalance(world: World, cityId: number): number {
  const vec = world.trade.imports[cityId - 1];
  if (vec === undefined) return 0;
  let sum = 0;
  for (let g = 0; g < GOOD_COUNT; g++) sum += vec[g] ?? 0;
  return sum;
}

