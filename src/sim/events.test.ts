import { describe, expect, it } from 'vitest';
import { World } from './world';
import { runEventTick } from './events';
import { EVENTS } from '../data/events';
import { cohortIndex } from './population';
import type { Rng } from './rng';

/**
 * M8.5 Ereignisse: Brand (Substanzverlust am Gebäude) und Missernte
 * (Nahrungs-Lagerschlag), deterministisch über den Welt-RNG.
 */

/** Stub-Rng mit vorgegebenen Werten (structurell kompatibel zu Rng). */
function stubRng(values: number[]): Rng {
  let i = 0;
  const nextValue = (): number => values[i++ % values.length]!;
  return {
    next: nextValue,
    chance: (p: number) => nextValue() < p,
    int: (min: number, max: number) => min + Math.floor(nextValue() * (max - min + 1)),
    pick: <T,>(items: readonly T[]) => items[Math.floor(nextValue() * items.length)]!,
    range: (min: number, max: number) => min + nextValue() * (max - min),
    stateU32: 0,
  } as unknown as Rng;
}

/** Erstes Landtile mit Randabstand, ab dem n horizontale Tiles Land sind. */
function landRun(w: World, n: number): number {
  const m = 16;
  for (let y = m; y < w.height - m; y++) {
    for (let x = m; x < w.width - m - n; x++) {
      const idx = y * w.width + x;
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        if (w.layers.water[idx + k] !== 0) ok = false;
      }
      if (ok) return idx;
    }
  }
  throw new Error('kein passendes Land');
}

function cityWorld(): World {
  const w = new World(42, 128, 128);
  const idx = landRun(w, 5);
  w.enqueue({ kind: 'foundCity', x: idx % w.width, y: Math.floor(idx / w.width), name: 'T' });
  w.update();
  expect(w.cities.count).toBe(1);
  w.addBuildingAt(1, (idx % w.width) + 1, Math.floor(idx / w.width), 1);
  w.storage.add(1, 0, 10); // Nahrung für die Missernte
  return w;
}

describe('M8.5 Ereignisse', () => {
  it('Missernte vernichtet den konfigurierten Anteil des Nahrungslagers', () => {
    const w = cityWorld();
    // Werte: Ereignis tritt ein (0.05 < 0.12), Stadt 1, kein Brand (0.9 >= 0.5)
    runEventTick(w, stubRng([0.05, 0, 0.9]));
    expect(w.storage.amount(1, 0)).toBeCloseTo(10 * (1 - EVENTS.harvestLossShare), 9);
  });

  it('Brand vermindert die Gebäudesubstanz um fireConditionLoss', () => {
    const w = cityWorld();
    // Werte: Ereignis tritt ein, Stadt 1, Brand (0.1 < 0.5), Treffer Gebäude 0
    runEventTick(w, stubRng([0.05, 0, 0.1, 0]));
    expect(w.buildings.condition[0]).toBeCloseTo(1 - EVENTS.fireConditionLoss, 9);
  });

  it('ohne Ereignis-Wurf bleibt der Zustand unverändert', () => {
    const w = cityWorld();
    runEventTick(w, stubRng([0.9])); // 0.9 >= 0.12 -> kein Ereignis
    expect(w.storage.amount(1, 0)).toBe(10);
    expect(w.buildings.condition[0]).toBe(1);
  });

  it('Ereignisse sind deterministisch (gleicher Seed -> gleicher Zustand)', () => {
    const run = (): World => {
      const w = cityWorld();
      w.settleResidents(1, cohortIndex(1, 0, 0), 10);
      for (let t = 0; t < 600; t++) w.update(); // 3 Intervalle inkl. Ereigniswürfe
      return w;
    };
    expect(run().toJson()).toBe(run().toJson());
  });
});
