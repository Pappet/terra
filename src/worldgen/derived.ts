/**
 * Abgeleitete Layer (M1): Fruchtbarkeit und Wald.
 *
 * Fruchtbarkeit = regionales fBm-Feld, gedämpft durch Höhe, verstärkt an
 * Flüssen und Küsten. Wald = Feuchte-Feld (eigenes fBm + Flussnähe) über
 * fruchtbarem, niedrigem Land. Beide lesen die "effektive Höhe" inklusive
 * Fluss-Carving, dadurch folgen Wälder den Tälern.
 */
import { WORLDGEN } from '../data/worldgen';
import { fbm2 } from './noise';
import type { BaseTerrainLayers } from './terrain';

export interface DerivedLayers {
  readonly fertility: Uint8Array;
  /** 0/1. */
  readonly forest: Uint8Array;
}

/**
 * Chebyshev-Distanzfeld zu allen Seed-Tiles, gekappt bei `radius`
 * (radius = weit weg, 0 = auf dem Seed selbst). BFS, deterministisch.
 */
export function distanceField(
  width: number,
  height: number,
  seeds: Uint8Array,
  radius: number,
): Uint8Array {
  const dist = new Uint8Array(width * height).fill(radius);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < seeds.length; i++) {
    if ((seeds[i] ?? 0) === 1) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const idx = queue[head++] as number;
    const d = dist[idx] as number;
    if (d >= radius) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if ((dist[n] ?? 0) > d + 1) {
          dist[n] = d + 1;
          queue[tail++] = n;
        }
      }
    }
  }
  return dist;
}

export function generateDerived(seed: number, terrain: BaseTerrainLayers & { readonly river: Uint8Array }): DerivedLayers {
  const { width, height, elevation, water, river } = terrain;
  const fertility = new Uint8Array(width * height);
  const forest = new Uint8Array(width * height);

  const F = WORLDGEN.fertility;
  const distRiver = distanceField(width, height, river, F.riverRadius);
  const distCoast = distanceField(width, height, water, F.coastRadius);

  const MO = WORLDGEN.forest;
  const distRiverForest = distanceField(width, height, river, MO.riverRadius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const isWater = (water[idx] ?? 0) === 1;

      // Fruchtbarkeit
      let f = fbm2(seed, x, y, { octaves: F.octaves, wavelength: F.wavelength }, 91.3, -17.7);
      f *= 1 - F.elevationPenalty * ((elevation[idx] ?? 0) / 255);
      if ((distRiver[idx] ?? 0) < F.riverRadius) {
        f += F.riverBoost * (1 - (distRiver[idx] ?? 0) / F.riverRadius);
      }
      if ((distCoast[idx] ?? 0) < F.coastRadius) {
        f += F.coastBoost * (1 - (distCoast[idx] ?? 0) / F.coastRadius);
      }
      const fByte = Math.round(Math.min(1, Math.max(0, f)) * 255);
      fertility[idx] = isWater ? 0 : fByte;

      // Wald
      if (!isWater) {
        let m = fbm2(seed, x, y, { octaves: MO.octaves, wavelength: MO.wavelength }, -203.5, 88.9);
        if ((distRiverForest[idx] ?? 0) < MO.riverRadius) {
          m += MO.riverBoost * (1 - (distRiverForest[idx] ?? 0) / MO.riverRadius);
        }
        const belowTreeline = (elevation[idx] ?? 255) / 255 < MO.maxElevation;
        forest[idx] = belowTreeline && m > MO.threshold ? 1 : 0;
      }
    }
  }

  return { fertility, forest };
}
