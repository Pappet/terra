/**
 * Value-Noise mit fBm – Grundbaustein des Kartengenerators (M1).
 *
 * Determinismus: Werte entstehen aus einem ganzzahligen Hash von (seed, x, y),
 * NICHT aus einem sequentiellen RNG – derselbe Punkt liefert immer denselben
 * Wert, egal in welcher Reihenfolge Samples angefordert werden. Kein DOM.
 */

/** 32-Bit-Integer-Hash -> [0, 1). Unabhängig pro (x, y). */
export function hash2(seed: number, x: number, y: number): number {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Quintische Smoothstep-Interpolation (Perlin-Empfehlung). */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Value-Noise an einer Stelle, [0, 1), Zellgrösse 1. */
export function valueNoise2(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = fade(x - x0);
  const ty = fade(y - y0);

  const v00 = hash2(seed, x0, y0);
  const v10 = hash2(seed, x0 + 1, y0);
  const v01 = hash2(seed, x0, y0 + 1);
  const v11 = hash2(seed, x0 + 1, y0 + 1);

  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

export interface FbmOptions {
  /** Anzahl Oktaven (jede halbiert die Wellenlänge). */
  octaves: number;
  /** Basis-Wellenlänge in Einheiten der Eingabekoordinaten. */
  wavelength: number;
  /** Amplitudenabfall pro Oktave (klassisch 0.5). */
  gain?: number;
  /** Wellenlängenwachstum pro Oktave (klassisch 2). */
  lacunarity?: number;
}

/**
 * Fraktales Summieren von Value-Noise. Ergebnis normalisiert auf [0, 1).
 * `offsetX/offsetY` trennen mehrere fBm-Felder auf demselben Seed.
 */
export function fbm2(
  seed: number,
  x: number,
  y: number,
  opts: FbmOptions,
  offsetX = 0,
  offsetY = 0,
): number {
  const { octaves, wavelength } = opts;
  const gain = opts.gain ?? 0.5;
  const lacunarity = opts.lacunarity ?? 2;

  let amplitude = 1;
  let total = 0;
  let max = 0;
  let wl = wavelength;
  let px = (x + offsetX) / wl;
  let py = (y + offsetY) / wl;
  for (let o = 0; o < octaves; o++) {
    total += valueNoise2(seed + o * 0x9e3779b9, px, py) * amplitude;
    max += amplitude;
    amplitude *= gain;
    wl /= lacunarity;
    px = (x + offsetX) / wl;
    py = (y + offsetY) / wl;
  }
  return total / max;
}
