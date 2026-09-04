import { describe, expect, it } from 'vitest';
import { generateDeposits } from './deposits';
import { DEPOSIT_DEFS } from '../data/deposits';
import { generateTerrain } from './terrain';

/** Grösste zusammenhängende Komponente (4er-Nachbarschaft) eines Bits. */
function largestCluster(bits: Uint8Array, width: number, height: number, bit: number): number {
  const visited = new Uint8Array(bits.length);
  const stack: number[] = [];
  let largest = 0;
  for (let start = 0; start < bits.length; start++) {
    if (((bits[start] ?? 0) & bit) === 0 || visited[start] === 1) continue;
    let size = 0;
    visited[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const idx = stack.pop() as number;
      size++;
      const x = idx % width;
      const y = Math.floor(idx / width);
      if (x > 0) maybePush(bits, visited, stack, idx - 1, bit);
      if (x < width - 1) maybePush(bits, visited, stack, idx + 1, bit);
      if (y > 0) maybePush(bits, visited, stack, idx - width, bit);
      if (y < height - 1) maybePush(bits, visited, stack, idx + width, bit);
    }
    largest = Math.max(largest, size);
  }
  return largest;
}

function maybePush(bits: Uint8Array, visited: Uint8Array, stack: number[], idx: number, bit: number): void {
  if (visited[idx] === 0 && ((bits[idx] ?? 0) & bit) !== 0) {
    visited[idx] = 1;
    stack.push(idx);
  }
}

function countBit(bits: Uint8Array, bit: number): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    if (((bits[i] ?? 0) & bit) !== 0) n++;
  }
  return n;
}

describe('generateDeposits', () => {
  it('ist reproduzierbar', () => {
    const t = generateTerrain(42, 64, 64);
    const a = generateDeposits(42, t);
    const b = generateDeposits(42, t);
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it('Vorkommen liegen nur auf Land und die Bitmaske kennt nur definierte Bits', () => {
    const allBits = DEPOSIT_DEFS.reduce((acc, d) => acc | d.bit, 0);
    for (const seed of [1, 42, 9999]) {
      const t = generateTerrain(seed, 96, 96);
      const deposits = generateDeposits(seed, t);
      for (let i = 0; i < deposits.length; i++) {
        const v = deposits[i] ?? 0;
        expect(v & ~allBits).toBe(0);
        if (v !== 0) expect(t.water[i]).toBe(0);
      }
    }
  });

  it('jeder Rohstoff kommt in brauchbarer Menge vor (weniger als 12% des Landes, mindestens 0.1%)', () => {
    for (const seed of [1, 42, 9999]) {
      const t = generateTerrain(seed, 128, 128);
      const deposits = generateDeposits(seed, t);
      let land = 0;
      for (let i = 0; i < t.water.length; i++) land += (t.water[i] ?? 0) === 0 ? 1 : 0;
      for (const def of DEPOSIT_DEFS) {
        const n = countBit(deposits, def.bit);
        expect(n, `${def.name} @ seed ${seed}`).toBeGreaterThan(land * 0.001);
        expect(n, `${def.name} @ seed ${seed}`).toBeLessThan(land * 0.12);
      }
    }
  });

  it('Vorkommen sind regionalisiert: die grösste Klumpen-Komponente hält einen relevanten Anteil', () => {
    const size = 128;
    const t = generateTerrain(42, size, size);
    const deposits = generateDeposits(42, t);
    for (const def of DEPOSIT_DEFS) {
      const total = countBit(deposits, def.bit);
      if (total === 0) continue;
      const largest = largestCluster(deposits, size, size, def.bit);
      expect(largest, def.name).toBeGreaterThan(total * 0.15);
    }
  });

  it('Performance: 512x512 inklusive Vorkommen bleibt unter 3 s', () => {
    const t = generateTerrain(42, 512, 512);
    const start = performance.now();
    generateDeposits(42, t);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
