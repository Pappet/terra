import { describe, expect, it } from 'vitest';
import { generateTerrain } from './terrain';
import { WORLDGEN } from '../data/worldgen';

function waterFraction(seed: number, w = 128, h = 128): number {
  const t = generateTerrain(seed, w, h);
  let n = 0;
  for (let i = 0; i < t.water.length; i++) n += t.water[i] ?? 0;
  return n / t.water.length;
}

describe('generateTerrain', () => {
  it('ist reproduzierbar: gleicher Seed -> identische Layer', () => {
    const a = generateTerrain(42, 64, 64);
    const b = generateTerrain(42, 64, 64);
    expect(Array.from(b.elevation)).toEqual(Array.from(a.elevation));
    expect(Array.from(b.water)).toEqual(Array.from(a.water));
  });

  it('unterschiedliche Seeds ergeben unterschiedliche Karten', () => {
    const a = generateTerrain(1, 64, 64);
    const b = generateTerrain(2, 64, 64);
    let diffs = 0;
    for (let i = 0; i < a.elevation.length; i++) {
      if (a.elevation[i] !== b.elevation[i]) diffs++;
    }
    expect(diffs).toBeGreaterThan(a.elevation.length * 0.3);
  });

  it('Kartenrand ist immer Ozean (Falloff-Garantie)', () => {
    for (const seed of [1, 42, 777, 0xc0ffee]) {
      const t = generateTerrain(seed, 96, 96);
      const last = 95;
      for (let i = 0; i <= last; i++) {
        expect(t.water[i]).toBe(1); // oben
        expect(t.water[last * 96 + i]).toBe(1); // unten
        expect(t.water[i * 96]).toBe(1); // links
        expect(t.water[i * 96 + last]).toBe(1); // rechts
      }
    }
  });

  it('Wasseranteil liegt in einem brauchbaren Bereich', () => {
    for (const seed of [1, 2, 3, 42, 9999]) {
      const f = waterFraction(seed);
      expect(f).toBeGreaterThan(0.15);
      expect(f).toBeLessThan(0.8);
    }
  });

  it('die grösste zusammenhängende Landmasse ist gross genug für mehrere Städte', () => {
    for (const seed of [1, 2, 3, 42]) {
      const t = generateTerrain(seed, 128, 128);
      const visited = new Uint8Array(t.water.length);
      let largest = 0;
      const stack: number[] = [];
      for (let start = 0; start < t.water.length; start++) {
        if (t.water[start] !== 0 || visited[start] !== 0) continue;
        let size = 0;
        stack.push(start);
        visited[start] = 1;
        while (stack.length > 0) {
          const idx = stack.pop() as number;
          size++;
          const x = idx % 128;
          const y = Math.floor(idx / 128);
          const neighbours = [
            x > 0 ? idx - 1 : -1,
            x < 127 ? idx + 1 : -1,
            y > 0 ? idx - 128 : -1,
            y < 127 ? idx + 128 : -1,
          ];
          for (const n of neighbours) {
            if (n >= 0 && t.water[n] === 0 && visited[n] === 0) {
              visited[n] = 1;
              stack.push(n);
            }
          }
        }
        largest = Math.max(largest, size);
      }
      expect(largest).toBeGreaterThan(128 * 128 * 0.12);
    }
  });

  it('Höhenwerte liegen in [0, 255] und korrelieren mit der Wasserlinie', () => {
    const t = generateTerrain(42, 64, 64);
    for (let i = 0; i < t.elevation.length; i++) {
      const e = t.elevation[i] as number;
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(255);
      const isWater = e / 255 < WORLDGEN.seaLevel ? 1 : 0;
      expect(t.water[i]).toBe(isWater);
    }
  });

  it('Performance: 512x512 bleibt klar unter einer Sekunde (Weltgen ist Einmalkosten)', () => {
    const start = performance.now();
    const t = generateTerrain(42, 512, 512);
    const elapsed = performance.now() - start;
    expect(t.elevation.length).toBe(512 * 512);
    expect(elapsed).toBeLessThan(1000);
  });
});
