/**
 * Parameter des Kartengenerators (M1). Keine dieser Zahlen steht im Code.
 * Geändert wird hier – der Generator liest nur.
 */
export const WORLDGEN = {
  elevation: {
    /** fBm-Oktaven für die Grundhöhe. */
    octaves: 5,
    /** Basis-Wellenlänge in Tiles – gröber = grössere Kontinente. */
    wavelength: 160,
    gain: 0.5,
    lacunarity: 2,
    /** Stärke des Domain-Warps (Küstenverwirbelung), in Tiles. */
    warpStrength: 40,
  },
  /** Wasserlinie als Anteil der normalisierten Höhe [0..1]. */
  seaLevel: 0.38,
  /** Rand-Falloff: ab diesem Abstand (in Kartenanteil) sinkt die Höhe zum Ozean. */
  edgeFalloffStart: 0.72,
  rivers: {
    /** Anzahl Flussquellen (Versuch, gedrosselt durch Abstand). */
    sources: 28,
    /** Mindesthöhe einer Quelle, Anteil von 255. */
    minElevation: 0.55,
    /** Mindestabstand zwischen Quellen in Tiles. */
    minSpacing: 20,
    /** Maximale Schritte pro Fluss (Deckel gegen Endlosschleifen auf Plateaus). */
    maxSteps: 1200,
  },
  fertility: {
    octaves: 4,
    /** Regionale Grundfruchtbarkeit, Wellenlänge in Tiles. */
    wavelength: 96,
    /** Höhenstrafe: fruchtbar sind Täler, karg sind Höhen. */
    elevationPenalty: 0.7,
    /** Flussnähe: Boost innerhalb so vieler Tiles (Chebyshev-Distanz). */
    riverRadius: 5,
    riverBoost: 0.35,
    /** Küstennähe (Meer): kleinerer Boost. */
    coastRadius: 2,
    coastBoost: 0.15,
  },
  forest: {
    octaves: 4,
    /** Feuchte-Feld, Wellenlänge in Tiles. */
    wavelength: 72,
    /** Feuchte-Schwelle für Wald. */
    threshold: 0.62,
    /** Flussnähe befeuchtet. */
    riverRadius: 6,
    riverBoost: 0.2,
    /** Oberhalb dieses Höhenanteils wächst kein Wald (Baumgrenze). */
    maxElevation: 0.78,
  },
} as const;
