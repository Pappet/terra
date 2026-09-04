/**
 * Tile-Typen der M0-Zelle. In M1 ersetzt das Weltgen diese Statik durch
 * prozedurale Layer; die Tabelle bleibt als Palette/Paint-Datenquelle bestehen.
 * Alle Farben an einer Stelle – der Renderer liest nur hier.
 */
export interface TileType {
  readonly id: number;
  readonly name: string;
  readonly color: string;
}

/** IDs sind kontiguierlich ab 0 und passen zu Uint8Array-Werten. */
export const TILE_TYPES: readonly TileType[] = [
  { id: 0, name: 'Ödland', color: '#181d14' },
  { id: 1, name: 'Gras', color: '#3a6b35' },
  { id: 2, name: 'Erde', color: '#6b5335' },
  { id: 3, name: 'Wasser', color: '#28527a' },
  { id: 4, name: 'Fels', color: '#7a7a72' },
];
