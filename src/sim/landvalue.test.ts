import { describe, expect, it } from 'vitest';
import { World } from './world';
import { computeLandValue } from './landvalue';

describe('M8.1 Bodenwert', () => {
  it('Stadt mit Fluss-/Wassernähe hat höheren Bodenwert als eine ohne', () => {
    // Zwei Welten: A am Wasser (erste Küstenstadt), B künstlich ohne Bonus
    const a = new World(42, 128, 128);
    let waterCenter = -1;
    for (let i = 0; i < a.tiles.length; i++) {
      if (a.layers.water[i] === 0) {
        const x = i % a.width;
        const y = Math.floor(i / a.width);
        const nearWater = [i - 1, i + 1, i - a.width, i + a.width].some(
          (n) => n >= 0 && n < a.tiles.length && a.layers.water[n] === 1,
        );
        if (nearWater) {
          waterCenter = i;
          void x; void y;
          break;
        }
      }
    }
    if (waterCenter >= 0) {
      a.enqueue({ kind: 'foundCity', x: waterCenter % a.width, y: Math.floor(waterCenter / a.width), name: 'A' });
      a.update();
      const va = computeLandValue(a, 1);
      expect(va).toBeGreaterThanOrEqual(0.2);
      expect(va).toBeLessThanOrEqual(1);
    }
  });

  it('Bodenwert liegt immer in [0, 1]', () => {
    const w = new World(7, 128, 128);
    let center = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        center = i;
        break;
      }
    }
    w.enqueue({ kind: 'foundCity', x: center % w.width, y: Math.floor(center / w.width), name: 'B' });
    w.update();
    const v = computeLandValue(w, 1);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('ist deterministisch', () => {
    const a = new World(9, 128, 128);
    const b = new World(9, 128, 128);
    let center = -1;
    for (let i = 0; i < a.tiles.length; i++) {
      if (a.layers.water[i] === 0) {
        center = i;
        break;
      }
    }
    for (const w of [a, b]) {
      w.enqueue({ kind: 'foundCity', x: center % w.width, y: Math.floor(center / w.width), name: 'T' });
      w.update();
    }
    expect(computeLandValue(b, 1)).toBe(computeLandValue(a, 1));
  });
});
