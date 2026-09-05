import { describe, expect, it } from 'vitest';
import { World } from './world';
import { recomputePollution, effectiveFertility, averagePollution } from './pollution';
import { POLLUTION } from '../data/pollution';
import { computeLandValue } from './landvalue';

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
 * M8.3 Verschmutzung: Industrie stempelt Falloff-Emissionen in das Layer,
 * effektive Fruchtbarkeit und Bodenwert reagieren darauf.
 */
describe('M8.3 Verschmutzung', () => {
  it('Industrie emittiert am Quell-Tile, Falloff fällt zum Radiusrand auf 0', () => {
    const w = new World(42, 128, 128);
    const idx = landRun(w, 8);
    w.addBuildingAt(1, idx % w.width, Math.floor(idx / w.width), 3, 0);
    recomputePollution(w);
    expect(w.pollution[idx]).toBe(POLLUTION.emissionPerBuilding);
    const far = idx + POLLUTION.radius + 1; // gleiche Zeile, außerhalb des Radius
    expect(w.pollution[far]).toBe(0);
    const edge = idx + POLLUTION.radius;
    expect(w.pollution[edge]).toBeGreaterThan(0);
    expect(w.pollution[edge]!).toBeLessThan(POLLUTION.emissionPerBuilding);
  });

  it('Verschmutzung entfernt einen Anteil der Fruchtbarkeit (Rückkopplung zum Markt)', () => {
    const w = new World(42, 128, 128);
    const idx = landRun(w, 8);
    (w.layers.fertility as Uint8Array)[idx] = 120; // kontrollierte Fruchtbarkeit
    const raw = 120 / 255;
    const clean = effectiveFertility(w, idx);
    expect(clean).toBeCloseTo(raw, 9);
    w.addBuildingAt(1, idx % w.width, Math.floor(idx / w.width), 3, 0);
    recomputePollution(w);
    const dirty = effectiveFertility(w, idx);
    expect(dirty).toBeLessThan(clean);
    expect(dirty).toBeCloseTo(raw * (1 - POLLUTION.fertilityLossFactor * (POLLUTION.emissionPerBuilding / 255)), 9);
  });

  it('Bodenwert sinkt unter Verschmutzung (Rückkopplung zur Zufriedenheit)', () => {
    const w = new World(42, 128, 128);
    const idx = landRun(w, 8);
    for (let i = 0; i < w.layers.fertility.length; i++) (w.layers.fertility as Uint8Array)[i] = 120;
    w.enqueue({ kind: 'foundCity', x: idx % w.width, y: Math.floor(idx / w.width), name: 'T' });
    w.update();
    const clean = computeLandValue(w, 1);
    w.addBuildingAt(1, (idx % w.width) + 1, Math.floor(idx / w.width), 3, 0);
    w.update(); // stempelt Verschmutzung neu
    const dirty = computeLandValue(w, 1);
    expect(dirty).toBeLessThan(clean);
    expect(dirty).toBeGreaterThanOrEqual(0);
    expect(averagePollution(w, 1)).toBeGreaterThan(0);
  });
});
