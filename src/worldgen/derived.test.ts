import { describe, expect, it } from 'vitest';
import { distanceField, generateDerived } from './derived';
import { generateTerrain } from './terrain';

function meanOf(values: Uint8Array, predicate: (i: number) => boolean): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    if (predicate(i)) {
      sum += values[i] ?? 0;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

describe('distanceField', () => {
  it('liefert 0 auf Seeds und gekappte Chebyshev-Distanz sonst', () => {
    const seeds = new Uint8Array(25);
    seeds[12] = 1; // Mitte eines 5x5
    const d = distanceField(5, 5, seeds, 4);
    expect(d[12]).toBe(0);
    expect(d[7]).toBe(1); // direkt drüber
    expect(d[0]).toBe(2); // Ecke: Chebyshev((2,2)->(0,0)) = 2
    expect(d[6]).toBe(1);
  });

  it('kappt bei radius', () => {
    const seeds = new Uint8Array(100);
    seeds[0] = 1;
    const d = distanceField(10, 10, seeds, 2);
    expect(d[22]).toBe(2); // weit weg -> gekappt
    expect(d[2]).toBe(2); // (0,2): Distanz 2
    expect(d[1]).toBe(1);
  });
});

describe('generateDerived', () => {
  it('ist reproduzierbar', () => {
    const t = generateTerrain(42, 64, 64);
    const a = generateDerived(42, t);
    const b = generateDerived(42, t);
    expect(Array.from(b.fertility)).toEqual(Array.from(a.fertility));
    expect(Array.from(b.forest)).toEqual(Array.from(a.forest));
  });

  it('Werte liegen in [0, 255]; Wasser ist unfruchtbar und waldlos', () => {
    const t = generateTerrain(42, 64, 64);
    const d = generateDerived(42, t);
    for (let i = 0; i < d.fertility.length; i++) {
      const f = d.fertility[i] ?? 0;
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(255);
      if ((t.water[i] ?? 0) === 1) {
        expect(f).toBe(0);
        expect(d.forest[i]).toBe(0);
      }
    }
  });

  it('Wald steht nur auf Land', () => {
    for (const seed of [1, 42, 9999]) {
      const t = generateTerrain(seed, 96, 96);
      const d = generateDerived(seed, t);
      for (let i = 0; i < d.forest.length; i++) {
        if ((d.forest[i] ?? 0) === 1) {
          expect(t.water[i]).toBe(0);
        }
      }
    }
  });

  it('hohe Lagen sind karger als tiefe (Perzentil-Vergleich, robust je Seed)', () => {
    const t = generateTerrain(42, 128, 128);
    const d = generateDerived(42, t);
    // Land-Tiles nach Höhe sortieren; oberstes Zehntel vs. unterstes Drittel
    const land: number[] = [];
    for (let i = 0; i < t.elevation.length; i++) {
      if ((t.water[i] ?? 0) === 0) land.push(i);
    }
    land.sort((a, b) => (t.elevation[a] ?? 0) - (t.elevation[b] ?? 0));
    const n = land.length;
    const top = land.slice(Math.floor(n * 0.9));
    const bottom = land.slice(0, Math.floor(n * 0.33));
    const mean = (idxs: number[]): number => {
      let s = 0;
      for (const i of idxs) s += d.fertility[i] ?? 0;
      return idxs.length === 0 ? 0 : s / idxs.length;
    };
    expect(mean(top)).toBeLessThan(mean(bottom));
  });

  it('Flussnähe erhöht die Fruchtbarkeit', () => {
    const t = generateTerrain(42, 128, 128);
    const d = generateDerived(42, t);
    const nearRiver = meanOf(d.fertility, (i) => (t.river[i] ?? 0) === 0 && isAdjacent(t.river, i, 128, t.river.length));
    const overall = meanOf(d.fertility, (i) => (t.water[i] ?? 0) === 0);
    expect(nearRiver).toBeGreaterThan(overall);
  });

  it('es gibt Wald und es gibt waldfreies Land (beides nennenswert)', () => {
    for (const seed of [1, 42]) {
      const t = generateTerrain(seed, 128, 128);
      const d = generateDerived(seed, t);
      let forest = 0;
      let land = 0;
      for (let i = 0; i < d.forest.length; i++) {
        if ((t.water[i] ?? 0) === 1) continue;
        land++;
        forest += d.forest[i] ?? 0;
      }
      expect(forest).toBeGreaterThan(land * 0.03);
      expect(forest).toBeLessThan(land * 0.9);
    }
  });
});

function isAdjacent(layer: Uint8Array, idx: number, width: number, length: number): boolean {
  const x = idx % width;
  const y = Math.floor(idx / width);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width) continue;
      const n = ny * width + nx;
      if (n < 0 || n >= length) continue;
      if ((layer[n] ?? 0) === 1) return true;
    }
  }
  return false;
}
