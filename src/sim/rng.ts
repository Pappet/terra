/**
 * Seeded PRNG (mulberry32) – die einzige Zufallsquelle der Simulation.
 *
 * Determinismus-Regeln:
 * - Nie Math.random in /src/sim. Alles läuft über Rng-Instanzen.
 * - Der interne Zustand ist ein uint32 und lässt sich exportieren/einlesen,
 *   damit Savegames die Zufallssequenz exakt an der saveden Stelle fortsetzen.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform gleichverteilt in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniformer Integer in [min, max] (inklusiv). */
  int(min: number, max: number): number {
    const span = max - min + 1;
    if (span <= 0) throw new Error(`rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * span);
  }

  /** True mit Wahrscheinlichkeit p (p in [0, 1]). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Zufälliges Element aus einem nichtleeren Array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('rng.pick: leeres Array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Aktueller interner Zustand (uint32) für Savegames. */
  get stateU32(): number {
    return this.state >>> 0;
  }

  /** RNG aus gespeichertem Zustand wiederherstellen. */
  static fromState(state: number): Rng {
    const rng = new Rng(0);
    rng.state = state >>> 0;
    return rng;
  }
}
