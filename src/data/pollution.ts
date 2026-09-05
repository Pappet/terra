/**
 * Verschmutzungs-Parameter (M8.3). Industriegebäude emittieren; die
 * Ausbreitung wird als Falloff-Stempel um jede Quelle berechnet (sim/pollution.ts).
 */
export const POLLUTION = {
  /** Emission einer Industriequelle am Quell-Tile (Skala 0..255). */
  emissionPerBuilding: 64,
  /** Ausbreitungsradius (Chebyshev) einer Quelle in Tiles. */
  radius: 5,
  /** Anteil der Fruchtbarkeit, den Vollverschmutzung zusätzlich entfernt. */
  fertilityLossFactor: 0.5,
  /** Zufriedenheitsmalus bei mittlerer Vollverschmutzung im Stadtgebiet. */
  satisfactionWeight: 0.15,
} as const;
