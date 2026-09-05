/**
 * Ereignisse (M8.5): deterministisch über den Welt-RNG, je Demografie-Intervall
 * höchstens ein Ereignis. Rückkopplungen: Brand -> Gebäudesubstanz -> Wohnraum/
 * Arbeitsplätze; Missernte -> Nahrungslager -> Preise.
 */
export const EVENTS = {
  /** Chance pro Intervall, dass überhaupt ein Ereignis eintritt. */
  chancePerInterval: 0.12,
  /** Substanzverlust eines Brandes am getroffenen Gebäude. */
  fireConditionLoss: 0.6,
  /** Anteil des Nahrungslagers, den eine Missernte vernichtet. */
  harvestLossShare: 0.5,
} as const;
