/**
 * Rohstoff-Vorkommen: ein Bit pro Rohstoff, Placement-Parameter pro Feld.
 * Statt absoluter fBm-Schwelle wird ein Perzentil genommen: `rate` ist der
 * Anteil der geeigneten Tiles (Land + Höhenband), der als Vorkommen gilt.
 * Das macht die Menge zur Designgrösse und kalibriert sich selbst über Seeds;
 * die räumliche Glätte des fBm-Feldes liefert die regionalen Klumpen.
 */
export interface DepositDef {
  readonly bit: number;
  readonly name: string;
  readonly octaves: number;
  /** Wellenlänge des Feldes in Tiles – gröber = ausgedehntere Lagerstätten. */
  readonly wavelength: number;
  /** Anteil der geeigneten Tiles, der als Vorkommen gesetzt wird (0..1). */
  readonly rate: number;
  /** Höhenband als Anteil von 255. */
  readonly minElevation: number;
  readonly maxElevation: number;
  /** Feld-Offset, trennt die Vorkommensfelder auf demselben Seed. */
  readonly offsetX: number;
  readonly offsetY: number;
}

export const DEPOSIT_DEFS: readonly DepositDef[] = [
  { bit: 1, name: 'Stein', octaves: 3, wavelength: 40, rate: 0.03, minElevation: 0.55, maxElevation: 0.95, offsetX: 17.3, offsetY: 401.1 },
  { bit: 2, name: 'Ton', octaves: 3, wavelength: 48, rate: 0.04, minElevation: 0.38, maxElevation: 0.52, offsetX: 211.7, offsetY: 88.2 },
  { bit: 4, name: 'Kohle', octaves: 3, wavelength: 64, rate: 0.025, minElevation: 0.45, maxElevation: 0.8, offsetX: 503.9, offsetY: 122.4 },
  { bit: 8, name: 'Eisen', octaves: 3, wavelength: 80, rate: 0.02, minElevation: 0.5, maxElevation: 0.9, offsetX: 337.5, offsetY: 619.8 },
  { bit: 16, name: 'Öl', octaves: 3, wavelength: 96, rate: 0.015, minElevation: 0.38, maxElevation: 0.6, offsetX: 771.2, offsetY: 245.6 },
];

/** Bit für einen Rohstoffnamen (Data-Lookup für UI/Savegame-Kommentare). */
export function depositBitByName(name: string): number | undefined {
  return DEPOSIT_DEFS.find((d) => d.name === name)?.bit;
}
