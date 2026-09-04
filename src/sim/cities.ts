/**
 * Städte als Struct-of-Arrays mit numerischen IDs (M3.1).
 *
 * Stadt-IDs beginnen bei 1 (0 = "keine Stadt" in Referenz-Layern wie
 * zoneCity). Numerische Felder liegen in wachsbaren Arrays; Namen in
 * string[] – beides direkt JSON-serialisierbar (DECISIONS: SoA-Pragmatismus,
 * TypedArrays folgen in M4, wenn Kohorten in fixe Skalare übergehen).
 */
export class Cities {
  count = 0;
  names: string[] = [];
  /** Stadtzentren in Tile-Koordinaten. */
  x: number[] = [];
  y: number[] = [];
  /** Tick der Gründung. */
  founded: number[] = [];

  /** Gründet eine Stadt, liefert die neue ID (>= 1). */
  found(name: string, x: number, y: number, tick: number): number {
    this.count++;
    this.names.push(name);
    this.x.push(x);
    this.y.push(y);
    this.founded.push(tick);
    return this.count;
  }

  distanceToNearest(x: number, y: number): number {
    let best = Infinity;
    for (let i = 0; i < this.count; i++) {
      const dx = (this.x[i] ?? 0) - x;
      const dy = (this.y[i] ?? 0) - y;
      best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
    }
    return best;
  }

  /** Nächstgelegene Stadt (ID 1-basiert) oder null, wenn keine existiert. */
  nearest(x: number, y: number): { id: number; dist: number } | null {
    if (this.count === 0) return null;
    let bestId = 1;
    let best = Infinity;
    for (let i = 0; i < this.count; i++) {
      const dx = (this.x[i] ?? 0) - x;
      const dy = (this.y[i] ?? 0) - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < best) {
        best = dist;
        bestId = i + 1;
      }
    }
    return { id: bestId, dist: best };
  }

  serialize(): { count: number; names: string[]; x: number[]; y: number[]; founded: number[] } {
    return {
      count: this.count,
      names: [...this.names],
      x: [...this.x],
      y: [...this.y],
      founded: [...this.founded],
    };
  }

  static deserialize(data: unknown): Cities {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Savegame: cities fehlt');
    }
    const d = data as Record<string, unknown>;
    const cities = new Cities();
    const count = d.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error(`Savegame: cities.count ungültig: ${String(count)}`);
    }
    const arrays = ['names', 'x', 'y', 'founded'] as const;
    for (const key of arrays) {
      if (!Array.isArray(d[key]) || (d[key] as unknown[]).length !== count) {
        throw new Error(`Savegame: cities.${key} hat nicht Länge ${count}`);
      }
    }
    cities.count = count;
    cities.names = [...(d.names as string[])];
    cities.x = [...(d.x as number[])];
    cities.y = [...(d.y as number[])];
    cities.founded = [...(d.founded as number[])];
    for (let i = 0; i < count; i++) {
      for (const arr of [cities.x, cities.y]) {
        const v = arr[i];
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
          throw new Error(`Savegame: cities Koordinate ungültig (Index ${i})`);
        }
      }
      if (typeof cities.names[i] !== 'string') {
        throw new Error(`Savegame: cities.names[${i}] ist kein String`);
      }
      if (typeof cities.founded[i] !== 'number' || (cities.founded[i] ?? 0) < 0) {
        throw new Error(`Savegame: cities.founded[${i}] ungültig`);
      }
    }
    return cities;
  }
}
