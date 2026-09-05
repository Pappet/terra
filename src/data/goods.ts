/**
 * Güter und Rezepte (M5.1). Rezepte gelten für Industriegebäude; welches
 * Rezept ein Gebäude ausführt, legt M5.2 bei Fertigstellung anhand der
 * Umgebung (Vorkommen/Wald) fest. Alle Balance-Zahlen hier.
 */
export interface Good {
  readonly id: number;
  readonly name: string;
  readonly basePrice: number;
  /** Grundnachfrage pro Tick (Preis-Boden, siehe sim/market.ts). */
  readonly baselineDemand: number;
}

export const GOODS: readonly Good[] = [
  { id: 0, name: 'Nahrung', basePrice: 2, baselineDemand: 1.5 },
  { id: 1, name: 'Holz', basePrice: 3, baselineDemand: 0.8 },
  { id: 2, name: 'Stein', basePrice: 3, baselineDemand: 0.6 },
  { id: 3, name: 'Erz', basePrice: 5, baselineDemand: 0.5 },
  { id: 4, name: 'Bretter', basePrice: 8, baselineDemand: 0.4 },
  { id: 5, name: 'Werkzeug', basePrice: 15, baselineDemand: 0.3 },
];

/** Preisgrenzen als Faktor auf basePrice (Marktdynamik, D006-Stil datengetrieben). */
export const MARKET = {
  emaFactor: 0.1,
  priceAdjustment: 0.15,
  minPriceFactor: 0.5,
  maxPriceFactor: 2,
  /** Bestand, der als "ausreichend" gilt (skaliert das Angebot). */
  targetStock: 20,
} as const;

export const GOOD_COUNT = GOODS.length;

export interface RecipeStack {
  readonly good: number;
  readonly amount: number;
}

/** Umgebungsbedingung eines Rezepts (D006, datengetrieben). */
export interface RecipeRequirement {
  /** 'deposit' prüft Vorkommen-Bits, 'forest' Wald-Layer, 'fertility' Fruchtbarkeit. */
  readonly kind: 'deposit' | 'forest' | 'fertility';
  /** Prüfradius in Tiles (Chebyshev). */
  readonly radius: number;
  /** deposit: benötigte Bitmaske. */
  readonly bits?: number;
  /** fertility: Mindestwert 0..1. */
  readonly min?: number;
}

export interface Recipe {
  readonly id: number;
  readonly name: string;
  /** Gebäude-Typ, der dieses Rezept ausführt (1 R, 2 C, 3 I). */
  readonly buildingType: number;
  /** Arbeitskraft pro Produktionstick. */
  readonly workers: number;
  readonly input: readonly RecipeStack[];
  readonly output: RecipeStack;
  /** Umgebungsbedingung oder null (immer gültig). */
  readonly requires: RecipeRequirement | null;
}

export const RECIPES: readonly Recipe[] = [
  // Rohstoffstufe (I)
  { id: 0, name: 'Holzfäller', buildingType: 3, workers: 4, input: [], output: { good: 1, amount: 2 }, requires: { kind: 'forest', radius: 3 } },
  { id: 1, name: 'Steinbruch', buildingType: 3, workers: 4, input: [], output: { good: 2, amount: 2 }, requires: { kind: 'deposit', radius: 3, bits: 1 } },
  { id: 2, name: 'Erzgrube', buildingType: 3, workers: 4, input: [], output: { good: 3, amount: 1.5 }, requires: { kind: 'deposit', radius: 3, bits: 8 } },
  { id: 3, name: 'Farm', buildingType: 3, workers: 3, input: [], output: { good: 0, amount: 2.5 }, requires: { kind: 'fertility', radius: 0, min: 0.35 } },
  // Veredelungsstufe (I)
  { id: 4, name: 'Sägewerk', buildingType: 3, workers: 4, input: [{ good: 1, amount: 2 }], output: { good: 4, amount: 1.5 }, requires: null },
  { id: 5, name: 'Werkstatt', buildingType: 3, workers: 5, input: [{ good: 4, amount: 1.5 }, { good: 3, amount: 1.5 }], output: { good: 5, amount: 1 }, requires: null },
  // Konsumstufe (C): Markt verzehrt Nahrung
  { id: 6, name: 'Markt', buildingType: 2, workers: 3, input: [{ good: 0, amount: 2 }], output: { good: 0, amount: 0 }, requires: null },
  // Bildung (M8.2, C): Schule bildet Kohorten über die Demografie weiter
  { id: 7, name: 'Schule', buildingType: 2, workers: 2, input: [], output: { good: 0, amount: 0 }, requires: null },
];

/** Rezept-ID der Schule (Bildungssystem, M8.2). */
export const RECIPE_SCHOOL = 7;

export const RECIPE_BY_ID = new Map<number, Recipe>(RECIPES.map((r) => [r.id, r]));
