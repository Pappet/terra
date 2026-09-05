/**
 * Stadt-Parameter (M3). Gründungskosten/Budget-Regeln kommen mit M7.
 */
export const CITIES = {
  /** Mindestabstand zweier Stadtzentren in Tiles. */
  minFoundingDistance: 8,
  /** Zonen nur innerhalb dieses Radius um das Stadtzentrum. */
  maxZoneDistance: 14,
  /** Farben für Stadtmarker im Kartenbild. */
  markerColor: '#ffd27a',
  markerBorderColor: '#141414',
} as const;

/** Zonen-Typen (Layer-Werte). 0 = nicht gezont. */
export const ZONE_TYPES = {
  residential: 1,
  commercial: 2,
  industrial: 3,
} as const;

/**
 * Finanzen (M5.4): Steuern pro Erwachsenem und Intervall (nach Einkommens-
 * gruppe faktoriert) gegen den laufenden Unterhalt (Strassen + Gebäude).
 */
export const FINANCE = {
  /** Steuern pro Erwachsenem und Demografie-Intervall (200 Ticks). */
  taxPerAdultPerInterval: 30,
  /** Einkommens-Faktor je Gruppe (niedrig/mittel/hoch). */
  incomeFactor: [0.6, 1.0, 1.6],
  /** Unterhalt pro Gebäude und Tick. */
  buildingUpkeepPerTick: 0.01,
  /** Kreditzinsen pro Intervall (Anteil der Restschuld). */
  loanInterestPerInterval: 0.05,
  /** Max. Schulden pro Erwachsenem (Kreditlimit). */
  maxDebtPerAdult: 20,
  /** Kasse unter diesem Wert -> Bankrott (M7.4). */
  bankruptcyTreasuryLimit: -100,
  /** Zufriedenheitsmalus bei Volllast-Steuersatz (M7.7-Ruin-Hebel). */
  taxBurdenOnSatisfaction: 0.3,
} as const;

/** Gebäudetypen folgen den Zonen (1 R, 2 C, 3 I). Farben fürs Kartenbild. */
export const BUILDING_COLORS: ReadonlyMap<number, string> = new Map([
  [1, '#7a9a6a'],
  [2, '#6a7a9a'],
  [3, '#9a8a5a'],
]);

/**
 * Zonen-Farben fürs Zonen-Overlay + Oberflächen-Tint. Bewusst hell/satt genug,
 * um sich auch auf Gras (#3a6b35) und Erde (#6b5335) klar abzuheben.
 */
export const ZONE_COLORS: ReadonlyMap<number, string> = new Map([
  [1, '#63c263'],
  [2, '#6f9be8'],
  [3, '#e0a83c'],
]);

/**
 * Wachstums- und Nachfragmodell (M3.3/M3.4). Belegung ist in M3 voll
 * (M4 ersetzt das durch echte Kohorten); "Lage" bedeutet hier
 * Strassenanschluss (Distanz-/Bodenwert-Komponenten kommen in M8).
 */
export const GROWTH = {
  /** Einwohner pro Wohngebäude (Vollbelegung in M3). */
  residentsPerHouse: 4,
  /** Arbeitsplätze pro Gewerbe-/Industriegebäude. */
  jobsPerBuilding: 4,
  /** Ziel-Arbeitsplätze pro Einwohner. */
  targetJobsPerResident: 0.5,
  /** Ziel-Gewerbegebäude pro Einwohner. */
  targetShopsPerResident: 0.12,
  /** Ziel-Industriegebäude pro Einwohner. */
  targetFactoriesPerResident: 0.15,
  /** Grundnachfrage nach Wohnen (Zuzugsdruck einer existierenden Stadt). */
  baseResidentialDemand: 0.35,
  /** Chance pro freiem gezonten Tile und Tick, dass gebaut wird. */
  constructionChance: 0.12,
  /** Max. Neubauten pro Stadt und Tick. */
  maxConstructionsPerCityPerTick: 2,
  /** Unterhalb dieser Substanz gilt ein Gebäude als verfallen. */
  decayConditionThreshold: 0.25,
  /** Substanzverlust pro Tick ohne Strassenanschluss. */
  decayPerTickWithoutRoad: 0.03,
  /** Neubau braucht Strassenanschluss (4er-Nachbarschaft). */
  constructionRequiresRoadAccess: true,
} as const;
