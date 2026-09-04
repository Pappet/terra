/**
 * Flussgenerator (M1): Quellen an hohen Landtiles, dann deterministischer
 * Abstieg zum tiefsten Nachbarn. Erreicht der Fluss Wasser (Meer, See oder
 * anderer Fluss), mündet er; liegt der tiefste Nachbar hoeher als die
 * aktuelle Stelle, wird er gegraben (Carving senkt die Hoehe) – daraus
 * entstehen Taeler. Mutiert die uebergebenen elevation/water-Layer:
 * die Hoehe gilt nachher als "effektive Hoehe inkl. Flussgraben".
 */
import { WORLDGEN } from '../data/worldgen';
import type { BaseTerrainLayers } from './terrain';

export function generateRivers(seed: number, terrain: BaseTerrainLayers): Uint8Array {
  void seed; // Quellenwahl ist rein hoehenbasiert; seed-Parameter bleibt fuer kuenftige Jitter-Varianten
  const { width, height, elevation, water } = terrain;
  const river = new Uint8Array(width * height);

  // 1) Quellen: hoechste Landtiles, gierig mit Mindestabstand.
  const candidates: number[] = [];
  const minElev = Math.round(WORLDGEN.rivers.minElevation * 255);
  for (let i = 0; i < elevation.length; i++) {
    if (water[i] === 0 && (elevation[i] ?? 0) >= minElev) candidates.push(i);
  }
  candidates.sort((a, b) => (elevation[b] ?? 0) - (elevation[a] ?? 0) || a - b);

  const sources: number[] = [];
  const minDistSq = WORLDGEN.rivers.minSpacing * WORLDGEN.rivers.minSpacing;
  for (const c of candidates) {
    if (sources.length >= WORLDGEN.rivers.sources) break;
    const cx = c % width;
    const cy = Math.floor(c / width);
    let spaced = true;
    for (const s of sources) {
      const dx = (s % width) - cx;
      const dy = Math.floor(s / width) - cy;
      if (dx * dx + dy * dy < minDistSq) {
        spaced = false;
        break;
      }
    }
    if (spaced) sources.push(c);
  }

  // 2) Abstieg: immer zum tiefsten 8er-Nachbarn; Gleichstand via Index-Reihenfolge.
  for (const source of sources) {
    let cur = source;
    let prev = -1;
    for (let step = 0; step < WORLDGEN.rivers.maxSteps; step++) {
      river[cur] = 1;
      water[cur] = 1;
      const cx = cur % width;
      const cy = Math.floor(cur / width);
      let best = -1;
      let bestE = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (n === prev) continue; // nicht zurückspringen (Plateau-Bounce)
          const e = elevation[n] ?? 255;
          if (e < bestE) {
            bestE = e;
            best = n;
          }
        }
      }
      if (best < 0) break;
      if (water[best] === 1) break; // Muendung in Meer/See/anderen Fluss
      if (bestE >= (elevation[cur] ?? 0)) {
        elevation[best] = Math.max(0, (elevation[cur] ?? 1) - 1); // Carving
      }
      prev = cur;
      cur = best;
    }
  }

  return river;
}
