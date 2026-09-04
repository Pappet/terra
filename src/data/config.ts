/**
 * Engine-Konfiguration. Keine Balance-Werte hier – Spielbalance gehört in
 * eigene Datendateien (z.B. tiles.ts, ab M1 Gebäude/Rezepte).
 */
export const SIM_CONFIG = {
  /** Savegame-Formatversion; wird beim Laden geprüft. v5: Zonen + Gebäude. */
  saveVersion: 5,

  /** Startkapital der Staatskasse. */
  startingTreasury: 500,

  /** Kartengrösse. Seit M1: 512x512. */
  map: { width: 512, height: 512 },

  /** Seed, wenn die URL keinen angibt. */
  defaultSeed: 1337,

  /** Sim-Ticks pro Sekunde bei Geschwindigkeit 1x. */
  ticksPerSecond: 20,

  /** Hartes Limit an Ticks pro gerendertem Frame (Schutz vor Todesspirale). */
  maxTicksPerFrame: 400,
} as const;

/** Wählbare Simulationsgeschwindigkeit: Pause, 1x, 3x, 10x. */
export const SPEED_STEPS = [0, 1, 3, 10] as const;
export type SimSpeed = (typeof SPEED_STEPS)[number];

/** Kamera/Ansicht – Engine-Werte, keine Spielbalance. */
export const VIEW_CONFIG = {
  minZoom: 1,
  maxZoom: 48,
  defaultZoom: 8,
  /** Zoomfaktor pro Mausrad-Rasterung. */
  wheelZoomFactor: 1.15,
  /** Kamera-Pan über Tastatur, in Tiles pro Sekunde. */
  keyPanTilesPerSecond: 24,
  /** Ab diesem Zoom werden Tile-Grenzen gezeichnet. */
  gridLineMinZoom: 8,
} as const;
