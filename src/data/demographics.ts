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

/**
 * Migration (M4.5): Zuzug bei hoher Zufriedenheit (in freie Wohnkapazität),
 * Wegzug bei niedriger. Zufriedenheit gewichtet Jobs, Pendelzeit, Wohnraum.
 */
export const MIGRATION = {
  /** Gewichtung Arbeitsplatzversorgung. */
  weightEmployment: 0.45,
  /** Gewichtung Pendelzeit. */
  weightCommute: 0.25,
  /** Gewichtung Wohnraum. */
  weightHousing: 0.3,
  /** Pendelzeit in Ticks, ab der das Pendeln als belastend gilt. */
  commuteToleranceTicks: 60,
  /** Zuzug setzt Zufriedenheit über dieser Schwelle voraus. */
  immigrationThreshold: 0.6,
  /** Anteil der freien Kapazität, der pro Intervall bei vollem Zuzug wandert. */
  immigrationRate: 0.5,
  /** Wegzug setzt Zufriedenheit unter dieser Schwelle. */
  departureThreshold: 0.35,
  /** Anteil der Einwohner, der pro Intervall bei voller Unzufriedenheit geht. */
  departureRate: 0.15,
  /** Chance, dass Zuzug Grundbildung mitbringt (sonst keine). */
  immigrantEducationChance: 0.7,
  /**
   * Gewichtung des Bodenwerts (M8.1-Rückkopplung). Der Bonus ist symmetrisch
   * um den neutralen Index (landValueNeutral): gute Lage erhöht die
   * Zufriedenheit, schlechte senkt sie.
   */
  weightLand: 0.1,
  /** Bodenwert-Index, der als neutral (kein Bonus/Malus) gilt. */
  landValueNeutral: 0.5,
} as const;
