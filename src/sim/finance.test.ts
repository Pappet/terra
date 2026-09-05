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
  // 5 Haeuser + 1 Gewerbe (Jobs halten die Leute), alle an Strassen
  const spots: Array<{ x: number; y: number }> = [];
  for (let dy = -3; dy <= 3 && spots.length < 6; dy++) {
    for (let dx = -3; dx <= 3 && spots.length < 6; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w.width - 1 || y >= w.height - 1) continue;
      const idx = y * w.width + x;
      const below = idx + w.width;
      if (w.layers.water[idx] === 0 && w.layers.water[below] === 0) spots.push({ x, y });
    }
  }
  for (const [n, s2] of spots.entries()) {
    const type = n === 5 ? 2 : 1;
    w.addBuildingAt(1, s2.x, s2.y, type, -1);
    w.enqueue({ kind: 'buildRoad', x: s2.x, y: s2.y + 1, road: 2 });
  }
  w.update();
  w.settleResidents(1, cohortIndex(1, 0, 0), adults);
  w.update(); // Zuweisung nachziehen
  return w;
}

describe('M5.4 Finanzen', () => {
  it('Steuern werden am Intervall nach Einwohnern und Einkommen kassiert', () => {
    const w = cityWithAdults(20);
    const before = w.treasury;
    // Genau bis zum naechsten Intervall ticken (abschliessender Tick = Vielfaches)
    let guard = 0;
    while (w.tick % AGE_TICK_INTERVAL !== 0 && guard < 500) {
      w.update();
      guard++;
    }
    expect(w.tick % AGE_TICK_INTERVAL).toBe(0);
    // Erwartung: 20 Erwachsene zahlen Steuern pro Kopf (minus Sterblichkeit
    // 0.002, plus minimale Geburten/Kapazitaet 0) zum aktuellen Steuersatz;
    // Unterhalt: Strassen + Gebaeude pro Tick.
    const taxes =
      20 * (1 - 0.002) * FINANCE.taxPerAdultPerInterval * FINANCE.incomeFactor[0] * w.taxRate;
    const upkeepTotal = (w.upkeepPerTick + 6 * FINANCE.buildingUpkeepPerTick) * guard;
    expect(w.treasury).toBeCloseTo(before + taxes - upkeepTotal, 1);
  });

  it('Gebaeude-Unterhalt wird pro Tick abgezogen (Strassen + Gebaeude)', () => {
    const w = cityWithAdults(0);
    const before = w.treasury;
    const upkeep = w.upkeepPerTick;
    w.update();
    expect(w.treasury).toBeCloseTo(before - upkeep - 6 * FINANCE.buildingUpkeepPerTick, 9);
  });

  it('Finanzen sind deterministisch', () => {
    const run = (): World => {
      const w = cityWithAdults(12);
      for (let t = 0; t < AGE_TICK_INTERVAL * 3; t++) w.update();
      return w;
    };
    expect(equalWorlds(run(), run())).toBe(true);
  });

  it('Kasse kann unter Druck geraten (Unterhalt ohne Einnahmen)', () => {
    const w = cityWithAdults(0);
    for (let d = 1; d <= 20; d++) {
      w.enqueue({ kind: 'buildRoad', x: d, y: Math.floor(w.cities.y[0] ?? 0), road: 3 });
    }
    w.update();
    const before = w.treasury;
    for (let t = 0; t < 100; t++) w.update();
    expect(w.treasury).toBeLessThan(before);
  });
});
