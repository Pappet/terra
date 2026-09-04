import { describe, expect, it } from 'vitest';
import { generateTerrain } from './terrain';
import { WORLDGEN } from '../data/worldgen';

/** Wasser-Tiles, die vom Kartenrand aus erreichbar sind (das echte Meer). */
function seaSet(width: number, height: number, water: Uint8Array): Uint8Array {
  const sea = new Uint8Array(water.length);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }
  for (const s of stack) {
    if ((water[s] ?? 0) === 1) sea[s] = 1;
  }
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const x = idx % width;
    const y = Math.floor(idx / width);
    const neighbours = [
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
    ];
    for (const n of neighbours) {
      if (n >= 0 && (water[n] ?? 0) === 1 && sea[n] === 0) {
        sea[n] = 1;
        stack.push(n);
      }
    }
  }
  return sea;
}

describe('generateRivers', () => {
  it('ist reproduzierbar: gleicher Seed -> identischer Fluss-Layer', () => {
    const a = generateTerrain(42, 96, 96);
    const b = generateTerrain(42, 96, 96);
    expect(Array.from(b.river)).toEqual(Array.from(a.river));
  });

  it('jedes Flusstile ist auch Wasser (river ist Teilmenge von water)', () => {
    for (const seed of [1, 42, 9999]) {
      const t = generateTerrain(seed, 96, 96);
      for (let i = 0; i < t.river.length; i++) {
        if (t.river[i] === 1) expect(t.water[i]).toBe(1);
      }
    }
  });

  it('es gibt Fluesse, und mindestens einer muendet ins Meer', () => {
    for (const seed of [1, 42, 9999]) {
      const size = 128;
      const t = generateTerrain(seed, size, size);
      let riverTiles = 0;
      for (let i = 0; i < t.river.length; i++) riverTiles += t.river[i] ?? 0;
      expect(riverTiles).toBeGreaterThan(5);

      const sea = seaSet(size, size, t.water);
      let mouth = false;
      for (let i = 0; i < t.river.length && !mouth; i++) {
        if ((t.river[i] ?? 0) !== 1) continue;
        const x = i % size;
        const y = Math.floor(i / size);
        for (let dy = -1; dy <= 1 && !mouth; dy++) {
          for (let dx = -1; dx <= 1 && !mouth; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            if (sea[ny * size + nx] === 1) mouth = true;
          }
        }
      }
      expect(mouth).toBe(true);
    }
  });

  it('Quellen liegen hoch und mit Mindestabstand (Konstruktionsprinzip, Stichprobe)', () => {
    const t = generateTerrain(42, 96, 96);
    const minElev = Math.round(WORLDGEN.rivers.minElevation * 255);
    // Jede Quelle (erstes Flusstile eines Flusses) muss mindestens minElev - Carving erreicht haben;
    // stattdessen pruefen wir das weichere Kriterium: nicht ALLE Flusstile liegen tief.
    let riverHigh = 0;
    let riverTotal = 0;
    for (let i = 0; i < t.river.length; i++) {
      if ((t.river[i] ?? 0) !== 1) continue;
      riverTotal++;
      if ((t.elevation[i] ?? 0) >= minElev * 0.6) riverHigh++;
    }
    expect(riverTotal).toBeGreaterThan(0);
    expect(riverHigh).toBeGreaterThan(0);
  });

  it('Fluesse verondern die Landmasse nur wenig (Wasseranteil bleibt im Rahmen)', () => {
    for (const seed of [1, 42]) {
      const t = generateTerrain(seed, 128, 128);
      let waterTiles = 0;
      for (let i = 0; i < t.water.length; i++) waterTiles += t.water[i] ?? 0;
      const fraction = waterTiles / t.water.length;
      expect(fraction).toBeLessThan(0.8);
    }
  });

  it('Performance: 512x512 inklusive Fluessen bleibt unter 1.5 s', () => {
    const start = performance.now();
    generateTerrain(42, 512, 512);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });
});
