/**
 * Demografie-Parameter (M4.2). Raten pro Alterungs-Intervall (siehe
 * AGE_TICK_INTERVAL); deterministisch über den Welt-RNG.
 */
export const DEMOGRAPHICS = {
  /** Geburten pro Erwachsenem (Altersgruppen 1+2) pro Intervall. */
  birthRatePerInterval: 0.08,
  /** Sterberate pro Intervall je Altersgruppe. */
  mortalityPerInterval: [0.004, 0.002, 0.008, 0.06],
  /** Chance, dass ein Kind beim Erwachsenwerden Grundbildung bekommt. */
  childEducationChance: 0.9,
  /** Chance, dass ein junger Erwachsener bei 40+ Hochschulbildung bekommt. */
  higherEducationChance: 0.15,
  /** Ohne Wohnkapazität wandern Geburtenstatistisch ab (keine Obdachlosenzelte). */
} as const;
