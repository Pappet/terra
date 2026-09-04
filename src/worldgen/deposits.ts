/**
 * Vorkommen (M1): Bitmaske pro Tile, ein Bit pro Rohstoff.
 * Placement: pro Rohstoff ein eigenes fBm-Feld auf den geeigneten Tiles
 * (Land + Höhenband); die obersten `rate`-Anteil bekommen das Bit.
 * Deterministisch: Quantil über die Feldwerte, Tiebreak über Tile-Index.
 */
import { DEPOSIT_DEFS } from '../data/deposits';
import { fbm2 } from './noise';
import type { BaseTerrainLayers } from './terrain';

export function generateDeposits(
  seed: number,
  terrain: Pick<BaseTerrainLayers, 'width' | 'height' | 'elevation' | 'water'>,
): Uint8Array {
  const { width, height, elevation, water } = terrain;
  const deposits = new Uint8Array(width * height);

  for (const def of DEPOSIT_DEFS) {
    const minE = def.minElevation * 255;
    const maxE = def.maxElevation * 255;

    // Pass 1: geeignete Tiles + Feldwerte sammeln
    const indices: number[] = [];
    const values: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if ((water[idx] ?? 0) === 1) continue;
        const e = elevation[idx] ?? 0;
        if (e < minE || e > maxE) continue;
        indices.push(idx);
        values.push(fbm2(seed, x, y, { octaves: def.octaves, wavelength: def.wavelength }, def.offsetX, def.offsetY));
      }
    }
    if (indices.length === 0) continue;

    // Pass 2: Schwellenwert als Quantil, dann Bit setzen
    const sorted = Float64Array.from(values).sort();
    const cutIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - def.rate)));
    const cut = sorted[cutIndex] as number;
    for (let i = 0; i < indices.length; i++) {
      if ((values[i] ?? 0) >= cut) {
        deposits[indices[i] as number] = (deposits[indices[i] as number] ?? 0) | def.bit;
      }
    }
  }

  return deposits;
}
