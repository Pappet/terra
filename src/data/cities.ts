/**
 * Stadt-Parameter (M3). Gründungskosten/Budget-Regeln kommen mit M7.
 */
export const CITIES = {
  /** Mindestabstand zweier Stadtzentren in Tiles. */
  minFoundingDistance: 8,
  /** Zonen nur innerhalb dieses Radius um das Stadtzentrum. */
  maxZoneDistance: 14,
  /** Farben für Stadtmarker im Kartenbild. */
  markerColor: '#ffd27a',
  markerBorderColor: '#141414',
} as const;

/** Zonen-Typen (Layer-Werte). 0 = nicht gezont. */
export const ZONE_TYPES = {
  residential: 1,
  commercial: 2,
  industrial: 3,
} as const;

/** Gebäudetypen folgen den Zonen (1 R, 2 C, 3 I). Farben fürs Kartenbild. */
export const BUILDING_COLORS: ReadonlyMap<number, string> = new Map([
  [1, '#7a9a6a'],
  [2, '#6a7a9a'],
  [3, '#9a8a5a'],
]);

/** Zonen-Farben fürs Zonen-Overlay. */
export const ZONE_COLORS: ReadonlyMap<number, string> = new Map([
  [1, '#4f7a4f'],
  [2, '#4f5f7f'],
  [3, '#7f6f3f'],
]);
