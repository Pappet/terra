/**
 * Güter und Rezepte (M5.1). Rezepte gelten für Industriegebäude; welches
 * Rezept ein Gebäude ausführt, legt M5.2 bei Fertigstellung anhand der
 * Umgebung (Vorkommen/Wald) fest. Alle Balance-Zahlen hier.
 */
export interface Good {
  readonly id: number;
  readonly name: string;
  readonly basePrice: number;
}

export const GOODS: readonly Good[] = [
  { id: 0, name: 'Nahrung', basePrice: 2 },
  { id: 1, name: 'Holz', basePrice: 3 },
  { id: 2, name: 'Stein', basePrice: 3 },
  { id: 3, name: 'Erz', basePrice: 5 },
  { id: 4, name: 'Bretter', basePrice: 8 },
  { id: 5, name: 'Werkzeug', basePrice: 15 },
];

export const GOOD_COUNT = GOODS.length;

export interface RecipeStack {
  readonly good: number;
  readonly amount: number;
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
}

export const RECIPES: readonly Recipe[] = [
  // Rohstoffstufe (I)
  { id: 0, name: 'Holzfäller', buildingType: 3, workers: 4, input: [], output: { good: 1, amount: 2 } },
  { id: 1, name: 'Steinbruch', buildingType: 3, workers: 4, input: [], output: { good: 2, amount: 2 } },
  { id: 2, name: 'Erzgrube', buildingType: 3, workers: 4, input: [], output: { good: 3, amount: 1.5 } },
  { id: 3, name: 'Farm', buildingType: 3, workers: 3, input: [], output: { good: 0, amount: 2.5 } },
  // Veredelungsstufe (I)
  { id: 4, name: 'Sägewerk', buildingType: 3, workers: 4, input: [{ good: 1, amount: 2 }], output: { good: 4, amount: 1.5 } },
  { id: 5, name: 'Werkstatt', buildingType: 3, workers: 5, input: [{ good: 4, amount: 1.5 }, { good: 3, amount: 1.5 }], output: { good: 5, amount: 1 } },
  // Konsumstufe (C): Nahrung wird zu Bedarf (M5.2/M4-Bevölkerung gekoppelt)
  { id: 6, name: 'Markt', buildingType: 2, workers: 3, input: [{ good: 0, amount: 2 }], output: { good: 0, amount: 0 } },
];

export const RECIPE_BY_ID = new Map<number, Recipe>(RECIPES.map((r) => [r.id, r]));
