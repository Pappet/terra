/**
 * Terrain-Generator (M1): Höhenfeld + Wasserlinie.
 *
 * Aufbau: fBm-Grundhöhe, mit Domain-Warp für organische Küsten und radialem
 * Falloff zum Kartenrand (Mapränder sind Ozean – garantiert, dass jede
 * Binnenlage über Wasser erreichbar ist, sobald M2/M6 Netze und Handel kommen).
 */
import { WORLDGEN } from '../data/worldgen';
import { fbm2 } from './noise';

export interface TerrainLayers {
  readonly width: number;
  readonly height: number;
  /** Normalisierte Höhe 0..255. */
  readonly elevation: Uint8Array;
  /** 1 = Wasser, 0 = Land. */
  readonly water: Uint8Array;
}

export function generateTerrain(seed: number, width: number, height: number): TerrainLayers {
  const { octaves, wavelength, gain, lacunarity, warpStrength } = WORLDGEN.elevation;
  const elevation = new Uint8Array(width * height);
  const water = new Uint8Array(width * height);

  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const halfW = width / 2;
  const halfH = height / 2;
  const start = WORLDGEN.edgeFalloffStart;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Domain-Warp: Verschiebung der Abfrageposition durch zwei eigene fBm-Felder
      const warpX =
        (fbm2(seed, x, y, { octaves: 3, wavelength: 96, gain, lacunarity }, 513.7, -71.3) - 0.5) *
        2 * warpStrength;
      const warpY =
        (fbm2(seed, x, y, { octaves: 3, wavelength: 96, gain, lacunarity }, -311.1, 427.9) - 0.5) *
        2 * warpStrength;

      let h = fbm2(
        seed,
        x + warpX,
        y + warpY,
        { octaves, wavelength, gain, lacunarity },
      );

      // Rand-Falloff: 1 im Binnenland, smoothstep auf 0 exakt am Kartenrand
      // (normierte Distanz: 0 = Mitte, 1 = Kante).
      const edge = Math.max(Math.abs(x - centerX) / halfW, Math.abs(y - centerY) / halfH);
      const ramp = Math.min(1, Math.max(0, (edge - start) / (1 - start)));
      const falloff = 1 - ramp * ramp * (3 - 2 * ramp);
      h *= falloff;

      const idx = y * width + x;
      elevation[idx] = Math.max(0, Math.min(255, Math.round(h * 255)));
      water[idx] = h < WORLDGEN.seaLevel ? 1 : 0;
    }
  }

  return { width, height, elevation, water };
}
