/**
 * Lokaler Markt (M5.3): Preise pro Stadt und Gut aus Angebot und Nachfrage.
 *
 * Angebot = Produktionsrate (EMA) + Lagerbestand (skaliert auf targetStock);
 * Nachfrage = Verbrauchsrate (EMA) + Grundnachfrage des Gutes. Der Preis
 * nähert sich deterministisch einem Zielwert aus basePrice × Druckfaktor an,
 * gedämpft und geklemmt (min/maxFactor).
 *
 * Die Güterflüsse liefert der Produktionstick (produced/consumed pro Tick,
 * dort zurückgesetzt); der Markt läuft in World.update nach der Produktion.
 */
import { GOOD_COUNT, GOODS, MARKET } from '../data/goods';
import type { World } from './world';

export class Market {
  /** Preise pro Stadt (Index Stadt-ID - 1) × Gut. */
  prices: Float64Array[] = [];
  /** EMA der Produktions-/Verbrauchsraten pro Stadt × Gut. */
  produced: Float64Array[] = [];
  consumed: Float64Array[] = [];

  ensureCity(cityId: number): void {
    while (this.prices.length < cityId) {
      const prices = new Float64Array(GOOD_COUNT);
      const produced = new Float64Array(GOOD_COUNT);
      const consumed = new Float64Array(GOOD_COUNT);
      for (let g = 0; g < GOOD_COUNT; g++) {
        prices[g] = GOODS[g]?.basePrice ?? 1;
      }
      this.prices.push(prices);
      this.produced.push(produced);
      this.consumed.push(consumed);
    }
  }

  city(cityId: number): { prices: Float64Array; produced: Float64Array; consumed: Float64Array } | null {
    const i = cityId - 1;
    if (this.prices[i] === undefined) return null;
    return { prices: this.prices[i]!, produced: this.produced[i]!, consumed: this.consumed[i]! };
  }

  price(cityId: number, good: number): number {
    return this.prices[cityId - 1]?.[good] ?? GOODS[good]?.basePrice ?? 1;
  }

  serialize(): { prices: number[][]; produced: number[][]; consumed: number[][] } {
    return {
      prices: this.prices.map((v) => Array.from(v)),
      produced: this.produced.map((v) => Array.from(v)),
      consumed: this.consumed.map((v) => Array.from(v)),
    };
  }

  static deserialize(data: unknown): Market {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Savegame: market fehlt');
    }
    const d = data as Record<string, unknown>;
    const market = new Market();
    const keys = ['prices', 'produced', 'consumed'] as const;
    const targets: Record<string, Float64Array[]> = {
      prices: market.prices,
      produced: market.produced,
      consumed: market.consumed,
    };
    for (const key of keys) {
      const arr = d[key];
      if (!Array.isArray(arr)) {
        throw new Error(`Savegame: market.${key} fehlt`);
      }
      for (const raw of arr as unknown[]) {
        if (!Array.isArray(raw) || raw.length !== GOOD_COUNT) {
          throw new Error(`Savegame: market.${key} Vektor hat nicht Länge ${GOOD_COUNT}`);
        }
        const vec = new Float64Array(GOOD_COUNT);
        for (let g = 0; g < GOOD_COUNT; g++) {
          const v = raw[g];
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            throw new Error(`Savegame: market.${key}[${String(g)}] ungültig`);
          }
          vec[g] = v;
        }
        targets[key]!.push(vec);
      }
    }
    if (market.prices.length !== market.produced.length || market.prices.length !== market.consumed.length) {
      throw new Error('Savegame: market-Vektoren haben unterschiedliche Stadtanzahlen');
    }
    return market;
  }
}

/** Güterflüsse eines Ticks (von runProductionTick befüllt, danach konsumiert). */
export interface TickFlows {
  produced: Float64Array;
  consumed: Float64Array;
}

/** Markt-Nachlauf: EMA aktualisieren und Preise Richtung Zielwert bewegen. */
export function updateMarket(
  world: World,
  flows: Map<number, TickFlows>,
): void {
  for (let cityId = 1; cityId <= world.cities.count; cityId++) {
    const market = world.market.city(cityId);
    if (market === null) continue;
    const flow = flows.get(cityId);
    for (let g = 0; g < GOOD_COUNT; g++) {
      const good = GOODS[g];
      if (good === undefined) continue;

      // EMA über die Tick-Flüsse
      const producedEma = market.produced[g] ?? 0;
      const consumedEma = market.consumed[g] ?? 0;
      market.produced[g] = producedEma + ((flow?.produced[g] ?? 0) - producedEma) * MARKET.emaFactor;
      market.consumed[g] = consumedEma + ((flow?.consumed[g] ?? 0) - consumedEma) * MARKET.emaFactor;

      const supply = (market.produced[g] ?? 0) + world.storage.amount(cityId, g) / MARKET.targetStock;
      const demand = (market.consumed[g] ?? 0) + good.baselineDemand;
      const pressure = demand / Math.max(0.01, supply);

      const target = good.basePrice * Math.min(MARKET.maxPriceFactor, Math.max(MARKET.minPriceFactor, pressure));
      market.prices[g] = (market.prices[g] ?? good.basePrice) + (target - (market.prices[g] ?? good.basePrice)) * MARKET.priceAdjustment;
    }
  }
}
