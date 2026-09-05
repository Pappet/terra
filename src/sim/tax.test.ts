import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { FINANCE } from '../data/cities';
import { AGE_TICK_INTERVAL, cohortIndex } from './population';

function cityWithAdults(adults: number): World {
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
  const spots: Array<{ x: number; y: number }> = [];
  for (let dy = -3; dy <= 3 && spots.length < 2; dy++) {
    for (let dx = -3; dx <= 3 && spots.length < 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w.width - 1 || y >= w.height - 1) continue;
      const idx = y * w.width + x;
      if (w.layers.water[idx] === 0) spots.push({ x, y });
    }
  }
  for (const s of spots) {
    w.addBuildingAt(1, s.x, s.y, 1, -1);
    w.enqueue({ kind: 'buildRoad', x: s.x, y: s.y + 1, road: 2 });
  }
  w.update();
  w.settleResidents(1, cohortIndex(1, 0, 0), adults);
  w.update(); // Zuweisung nachziehen
  return w;
}

describe('M7.1 Steuersatz', () => {
  it('Standard-Steuersatz ist 1', () => {
    const w = cityWithAdults(5);
    expect(w.taxRate).toBe(1);
  });

  it('Steuersatz 0: keine Steuereinnahmen', () => {
    const w = cityWithAdults(20);
    w.enqueue({ kind: 'setTaxRate', rate: 0 });
    w.update();
    expect(w.taxRate).toBe(0);
    const before = w.treasury;
    const upkeep = w.upkeepPerTick + 2 * FINANCE.buildingUpkeepPerTick;
    const ticks = AGE_TICK_INTERVAL - (w.tick % AGE_TICK_INTERVAL);
    for (let t = 0; t < ticks; t++) w.update();
    // Nur Unterhalt (Straßen + Gebäude) wurde abgezogen — keine Steuern
    expect(w.treasury).toBeCloseTo(before - upkeep * ticks, 1);
  });

  it('Steuersatz 0.5: halbe Einnahmen gegenüber Satz 1', () => {
    const runWith = (rate: number): number => {
      const w = cityWithAdults(20);
      w.enqueue({ kind: 'setTaxRate', rate });
      const before = w.treasury;
      const ticks = AGE_TICK_INTERVAL - (w.tick % AGE_TICK_INTERVAL);
      const upkeep = w.upkeepPerTick + 2 * FINANCE.buildingUpkeepPerTick;
      for (let t = 0; t < ticks; t++) w.update();
      return w.treasury - before + upkeep * ticks; // Brutto-Einnahmen
    };
    const full = runWith(1);
    const half = runWith(0.5);
    expect(half).toBeCloseTo(full / 2, 6);
  });

  it('ungültige Sätze werden abgelehnt (lastRejected, Rate unverändert)', () => {
    const w = cityWithAdults(5);
    w.enqueue({ kind: 'setTaxRate', rate: 1.5 });
    w.update();
    expect(w.taxRate).toBe(1);
    expect(w.lastRejected).toMatch(/Steuersatz/);
    w.enqueue({ kind: 'setTaxRate', rate: -0.1 });
    w.update();
    expect(w.taxRate).toBe(1);
  });

  it('Steuersatz überlebt das Savegame (v10) und ist Teil des Determinismus', () => {
    const w = cityWithAdults(5);
    w.enqueue({ kind: 'setTaxRate', rate: 0.75 });
    w.update();
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.taxRate).toBe(0.75);

    const a = cityWithAdults(5);
    a.enqueue({ kind: 'setTaxRate', rate: 0.5 });
    const b = cityWithAdults(5);
    b.enqueue({ kind: 'setTaxRate', rate: 0.5 });
    for (let t = 0; t < 30; t++) {
      a.update();
      b.update();
    }
    expect(b.toJson()).toBe(a.toJson());
  });
});
