/**
 * Strassentypen (M2). ID 0 = keine Strasse (gelten offroad-Regeln).
 * speedTilesPerTick: Beweglichkeit pro Sim-Tick auf diesem Typ.
 * capacity: Einheiten/Tick, die die Strasse Later nutzen können (M4/M6).
 */
export interface RoadType {
  readonly id: number;
  readonly name: string;
  readonly buildCost: number;
  readonly upkeepPerTick: number;
  readonly speedTilesPerTick: number;
  readonly capacity: number;
  readonly color: string;
}

export const ROAD_TYPES: readonly RoadType[] = [
  { id: 1, name: 'Pfad', buildCost: 2, upkeepPerTick: 0.01, speedTilesPerTick: 0.6, capacity: 10, color: '#8a7350' },
  { id: 2, name: 'Strasse', buildCost: 5, upkeepPerTick: 0.03, speedTilesPerTick: 1.0, capacity: 40, color: '#9a9a94' },
  { id: 3, name: 'Chaussee', buildCost: 12, upkeepPerTick: 0.08, speedTilesPerTick: 2.0, capacity: 120, color: '#c8c8c2' },
];

export const ROAD_BY_ID = new Map<number, RoadType>(ROAD_TYPES.map((r) => [r.id, r]));

/** Fortbewegung abseits von Strassen (Land), Wasser ist unpassierbar. */
export const MOVEMENT = {
  offroadSpeedTilesPerTick: 0.25,
  /** Pendler-Korridorkapazität abseits von Strassen (Trampelpfad). */
  offroadCapacity: 2,
} as const;

/**
 * Terrain-Modifikator auf der offroad-Geschwindigkeit, indiziert nach Tile-ID
 * (siehe data/tiles.ts). Strassen ignorieren Terrain (ausgebaut = ausgeglichen).
 * Wasser (3) ist mit 0 unpassierbar.
 */
export const TERRAIN_OFFROAD_FACTOR: readonly number[] = [
  1.0, // 0 Ödland
  1.0, // 1 Gras
  1.0, // 2 Erde
  0.0, // 3 Wasser
  0.7, // 4 Fels
  0.6, // 5 Wald
];
