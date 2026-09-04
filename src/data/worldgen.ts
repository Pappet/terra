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
} as const;
