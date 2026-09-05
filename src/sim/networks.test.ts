import { describe, expect, it } from 'vitest';
import { World } from './world';
import { recomputeSupply, isSupplied } from './networks';
import { runProductionTick } from './production';
import { NETWORKS } from '../data/networks';
import type { EmploymentState } from './employment';

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

/**
 * M8.4 Versorgungsnetze: Zentrum + Straßennetz (BFS) + 1-Halo versorgt;
 * Gebäude ohne Anschluss produzieren mit reduzierter Rate.
 */
describe('M8.4 Versorgungsnetze', () => {
  it('Zentrum-Nachbar ist versorgt, entlegenes Gebäude ohne Straßenverbindung nicht', () => {
    const w = new World(42, 128, 128);
    const idx = landRun(w, 5);
    const cx = idx % w.width;
    const cy = Math.floor(idx / w.width);
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
    w.update();
    recomputeSupply(w);
    expect(isSupplied(w, idx + 1)).toBe(true); // Zentrum-Nachbar (1-Halo)
    expect(isSupplied(w, idx + 3)).toBe(false); // ohne Verbindung
    // Straße an das Zentrum anschließen -> Halo reicht bis idx+3
    w.enqueue({ kind: 'buildRoad', x: cx + 1, y: cy, road: 2 });
    w.enqueue({ kind: 'buildRoad', x: cx + 2, y: cy, road: 2 });
    w.enqueue({ kind: 'buildRoad', x: cx + 3, y: cy, road: 2 });
    w.update();
    expect(isSupplied(w, idx + 3)).toBe(true);
    // Unterbrechung: Straßenabriss trennt das Netz wieder
    w.enqueue({ kind: 'demolishRoad', x: cx + 1, y: cy });
    w.update();
    expect(isSupplied(w, idx + 3)).toBe(false);
  });

  it('Gebäude ohne Netzanschluss produzieren mit NETWORKS.unsuppliedRateFactor', () => {
    // Isoliert: Beschäftigung manuell auf 4 gesetzt, damit ausschließlich der
    // Versorgungsfaktor wirkt (Korridorkapazität ist hier nicht im Spiel).
    const setFakeCommute = (world: World): void => {
      (world as { commute: EmploymentState }).commute = {
        employed: [4],
        unemployed: [0],
        openJobs: [0],
        flows: [],
      } as EmploymentState;
    };
    const setup = (): World => {
      const w = new World(42, 128, 128);
      const idx = landRun(w, 4);
      const cx = idx % w.width;
      const cy = Math.floor(idx / w.width);
      w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
      w.update();
      w.addBuildingAt(1, cx + 2, cy, 3, 0); // Holzfäller (2 Holz/Tick bei Rate 1)
      return w;
    };
    const unsupplied = setup();
    setFakeCommute(unsupplied);
    const before = unsupplied.storage.amount(1, 1);
    runProductionTick(unsupplied);
    expect(unsupplied.storage.amount(1, 1) - before).toBeCloseTo(2 * NETWORKS.unsuppliedRateFactor, 9);

    const supplied = setup();
    const cxs = supplied.cities.x[0]!;
    const cys = supplied.cities.y[0]!;
    supplied.enqueue({ kind: 'buildRoad', x: cxs + 1, y: cys, road: 2 });
    supplied.enqueue({ kind: 'buildRoad', x: cxs + 2, y: cys, road: 2 });
    supplied.update(); // rechnet Versorgung neu
    setFakeCommute(supplied); // nach update(): sonst überschreibt assignWorkers
    const beforeSupplied = supplied.storage.amount(1, 1);
    runProductionTick(supplied);
    expect(supplied.storage.amount(1, 1) - beforeSupplied).toBeCloseTo(2, 9);
  });
});
