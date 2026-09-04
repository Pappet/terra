/**
 * Gebäude als Struct-of-Arrays mit numerischen IDs (M3.2).
 * IDs beginnen bei 1; 0 bedeutet in Referenzlayern "kein Gebäude".
 * condition (0..1) steuert den Verfall (M3.4), level die Ausbaustufe (M5+).
 * Plain Arrays wie bei Cities (siehe JOURNAL-Entscheidung zu M3.1).
 */
export class Buildings {
  count = 0;
  cityId: number[] = [];
  x: number[] = [];
  y: number[] = [];
  /** 1 = Wohnen, 2 = Gewerbe, 3 = Industrie (folgt Zonen-Typen). */
  type: number[] = [];
  level: number[] = [];
  /** 0 = verfallen, 1 = neuwertig. */
  condition: number[] = [];

  add(cityId: number, x: number, y: number, type: number): number {
    this.count++;
    this.cityId.push(cityId);
    this.x.push(x);
    this.y.push(y);
    this.type.push(type);
    this.level.push(1);
    this.condition.push(1);
    return this.count;
  }

  /** Gebäude entfernen (Index 0-basiert) und letzte Position einschieben. */
  removeAt(index: number): void {
    const last = this.count - 1;
    if (index !== last) {
      this.cityId[index] = this.cityId[last] as number;
      this.x[index] = this.x[last] as number;
      this.y[index] = this.y[last] as number;
      this.type[index] = this.type[last] as number;
      this.level[index] = this.level[last] as number;
      this.condition[index] = this.condition[last] as number;
    }
    this.cityId.pop();
    this.x.pop();
    this.y.pop();
    this.type.pop();
    this.level.pop();
    this.condition.pop();
    this.count--;
  }

  serialize(): {
    count: number;
    cityId: number[];
    x: number[];
    y: number[];
    type: number[];
    level: number[];
    condition: number[];
  } {
    return {
      count: this.count,
      cityId: [...this.cityId],
      x: [...this.x],
      y: [...this.y],
      type: [...this.type],
      level: [...this.level],
      condition: [...this.condition],
    };
  }

  static deserialize(data: unknown): Buildings {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Savegame: buildings fehlt');
    }
    const d = data as Record<string, unknown>;
    const buildings = new Buildings();
    const count = d.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error(`Savegame: buildings.count ungültig: ${String(count)}`);
    }
    const keys = ['cityId', 'x', 'y', 'type', 'level', 'condition'] as const;
    for (const key of keys) {
      if (!Array.isArray(d[key]) || (d[key] as unknown[]).length !== count) {
        throw new Error(`Savegame: buildings.${key} hat nicht Länge ${count}`);
      }
    }
    buildings.count = count;
    buildings.cityId = [...(d.cityId as number[])];
    buildings.x = [...(d.x as number[])];
    buildings.y = [...(d.y as number[])];
    buildings.type = [...(d.type as number[])];
    buildings.level = [...(d.level as number[])];
    buildings.condition = [...(d.condition as number[])];
    for (let i = 0; i < count; i++) {
      const type = buildings.type[i];
      if (typeof type !== 'number' || type < 1 || type > 3) {
        throw new Error(`Savegame: buildings.type[${i}] ungültig: ${String(type)}`);
      }
      const condition = buildings.condition[i];
      if (typeof condition !== 'number' || condition < 0 || condition > 1) {
        throw new Error(`Savegame: buildings.condition[${i}] ausserhalb [0,1]`);
      }
    }
    return buildings;
  }
}
