/**
 * Bodenwert-Parameter (M8.1). Alle Balance-Zahlen hier; die Berechnung
 * (sim/landvalue.ts) nutzt ausschliesslich diese Konstanten.
 */
export const LANDVALUE = {
  /** Bonus, wenn ein Fluss das Stadtgebiet berührt. */
  riverBonus: 0.3,
  /** Bonus, wenn Küste/Ozean das Stadtgebiet berührt. */
  coastBonus: 0.2,
  /** Neutraler Index, wenn keine Fruchtbarkeitsdaten vorliegen (Fakes, leere Karte). */
  neutral: 0.5,
} as const;
