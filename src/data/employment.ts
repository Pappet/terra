/**
 * Arbeitsmarkt-Parameter (M4.3). Balance-Zahl hier; die Zuweisungslogik
 * (sim/employment.ts) liest sie von dieser Stelle.
 */
export const EMPLOYMENT = {
  /** Anteil der Erwerbsfähigen (Altersgruppen 1+2), der arbeiten will. */
  participationRate: 0.6,
} as const;
