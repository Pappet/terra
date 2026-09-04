/**
 * Lagerbestände (M5.1): pro Stadt ein Float64-Vektor über alle Güter.
 * Gleiche Struktur-Logik wie Population (SoA pro Stadt, serialisierbar).
 */
import { GOOD_COUNT } from '../data/goods';

export class Storage {
  perCity: Float64Array[] = [];

  ensureCity(cityId: number): void {
    while (this.perCity.length < cityId) this.perCity.push(new Float64Array(GOOD_COUNT));
  }

  city(cityId: number): Float64Array | null {
    return this.perCity[cityId - 1] ?? null;
  }

  amount(cityId: number, good: number): number {
    return this.city(cityId)?.[good] ?? 0;
  }

  add(cityId: number, good: number, delta: number): void {
    this.ensureCity(cityId);
    const vec = this.perCity[cityId - 1] as Float64Array;
    vec[good] = Math.max(0, (vec[good] ?? 0) + delta);
  }

  /** Versucht, amount zu entnehmen; liefert die tatsächlich entnommene Menge. */
  take(cityId: number, good: number, amount: number): number {
    this.ensureCity(cityId);
    const vec = this.perCity[cityId - 1] as Float64Array;
    const available = vec[good] ?? 0;
    const taken = Math.min(available, amount);
    vec[good] = available - taken;
    return taken;
  }

  serialize(): number[][] {
    return this.perCity.map((vec) => Array.from(vec));
  }

  static deserialize(data: unknown): Storage {
    if (typeof data !== 'object' || data === null || !Array.isArray(data)) {
      throw new Error('Savegame: storage fehlt oder ist kein Array');
    }
    const storage = new Storage();
    for (const raw of data as unknown[]) {
      if (!Array.isArray(raw) || raw.length !== GOOD_COUNT) {
        throw new Error(`Savegame: Lagervektor hat nicht Länge ${GOOD_COUNT}`);
      }
      const vec = new Float64Array(GOOD_COUNT);
      for (let i = 0; i < GOOD_COUNT; i++) {
        const v = raw[i];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          throw new Error(`Savegame: Lagerwert ${String(v)} ungültig`);
        }
        vec[i] = v;
      }
      storage.perCity.push(vec);
    }
    return storage;
  }
}
