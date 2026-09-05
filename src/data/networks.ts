/**
 * Versorgungsnetze (M8.4): Strom/Wasser laufen entlang des Straßengraphen vom
 * Stadtzentrum. Gebäude ohne Netzanschluss produzieren mit reduzierter Rate.
 */
export const NETWORKS = {
  /** Produktionsfaktor für Gebäude ohne Netzanschluss (0..1]. */
  unsuppliedRateFactor: 0.5,
} as const;
