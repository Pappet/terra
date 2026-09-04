import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { GOODS, MARKET } from '../data/goods';
import { cohortIndex } from './population';

function cityWithMarketChain(): World {
  const w = new World(42, 128, 128);
  let center = -1;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.layers.water[i] === 0) {
      center = i;
      break;
    }
  }
  const cx = center % w.width;
  const cy = Math.floor(center / w.width);
  w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
  w.update();
  // Farm (Nahrung) + Markt (konsumiert Nahrung), beide mit Rezept
  w.addBuildingAt(1, cx + 1, cy, 3, 3);
  w.addBuildingAt(1, cx + 2, cy, 2, 6);
  w.settleResidents(1, cohortIndex(1, 0, 0), 12);
  w.update();
  return w;
}

describe('M5.3 Lokale Preise', () => {
  it('Startpreise = Basispreise', () => {
    const w = new World(42, 128, 128);
    w.update();
    for (const good of GOODS) {
      expect(w.market.price(1, good.id)).toBeCloseTo(good.basePrice, 9);
    }
  });

  it('Nachfrageüberschuss treibt den Preis über den Basispreis', () => {
    const w = cityWithMarketChain();
    // Markt verbraucht 2/Tick, Farm produziert 2.5/Tick -> nicht sofort; mehr Märkte:
    w.addBuildingAt(1, w.cities.x[0]! + 3, w.cities.y[0]!, 2, 6);
    w.update();
    for (let t = 0; t < 300; t++) w.update();
    const foodPrice = w.market.price(1, 0);
    const foodBase = GOODS[0]!.basePrice;
    // Produktion 2.5 vs. Verbrauch 4 + Grundnachfrage 1.5 -> Druck > 1
    expect(foodPrice).toBeGreaterThan(foodBase);
    expect(foodPrice).toBeLessThanOrEqual(foodBase * MARKET.maxPriceFactor + 1e-9);
  });

  it('Angebotsüberschuss senkt den Preis unter den Basispreis', () => {
    const w = new World(42, 128, 128);
    let center = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        center = i;
        break;
      }
    }
    const cx = center % w.width;
    const cy = Math.floor(center / w.width);
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
    w.update();
    // 3 Holzfäller (6 Holz/Tick), kein Verbraucher von Holz
    for (let b = 0; b < 3; b++) w.addBuildingAt(1, cx + 1 + b, cy, 3, 0);
    w.settleResidents(1, cohortIndex(1, 0, 0), 12);
    w.update();
    for (let t = 0; t < 400; t++) w.update();
    const woodPrice = w.market.price(1, 1);
    expect(woodPrice).toBeLessThan(GOODS[1]!.basePrice);
    expect(woodPrice).toBeGreaterThanOrEqual(GOODS[1]!.basePrice * MARKET.minPriceFactor - 1e-9);
  });

  it('Preise bleiben in den Klemmen [minFactor, maxFactor] × Basispreis', () => {
    const w = cityWithMarketChain();
    for (let t = 0; t < 600; t++) w.update();
    for (const good of GOODS) {
      const p = w.market.price(1, good.id);
      expect(p).toBeGreaterThanOrEqual(good.basePrice * MARKET.minPriceFactor - 1e-9);
      expect(p).toBeLessThanOrEqual(good.basePrice * MARKET.maxPriceFactor + 1e-9);
    }
  });

  it('Roundtrip über das Savegame (v8) inklusive Marktzustand', () => {
    const w = cityWithMarketChain();
    for (let t = 0; t < 250; t++) w.update();
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.market.price(1, 0)).toBe(w.market.price(1, 0));
  });

  it('Markt ist deterministisch', () => {
    const run = (): World => {
      const w = cityWithMarketChain();
      for (let t = 0; t < 120; t++) w.update();
      return w;
    };
    expect(run().toJson()).toBe(run().toJson());
  });
});
