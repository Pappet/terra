/**
 * Handels-Parameter (M6). Alle Balance-Zahlen hier; die Arbitrage-Logik
 * (sim/trade.ts) nutzt ausschliesslich diese Konstanten.
 */
export const TRADE = {
  /** Transportkosten pro Reisezeit-Einheit (zieht die Marge ab). */
  transportCostPerTimeUnit: 0.1,
  /** Lager, das die abgebende Stadt behält. */
  reserveStock: 2,
  /** Mindestmarge (Preisdifferenz minus Transportkosten) für Handel. */
  minMargin: 0.2,
} as const;
