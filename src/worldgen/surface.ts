/**
 * Oberflächen-Mapping (M1): aus den Weltgen-Layern die sichtbaren Tile-IDs
 * ableiten. Priorität: Wasser > Fels > Wald > Gras/Ödland.
 */
import { WORLDGEN } from '../data/worldgen';
import type { DerivedLayers } from './derived';
import type { TerrainLayers } from './terrain';

export function generateSurface(
  terrain: TerrainLayers,
  derived: DerivedLayers,
): Uint8Array {
  const { width, height, elevation, water, river } = terrain;
  const { fertility, forest } = derived;
  const tiles = new Uint8Array(width * height);

  const { rockThreshold, grassThreshold } = WORLDGEN.surface;

  for (let idx = 0; idx < tiles.length; idx++) {
    if ((water[idx] ?? 0) === 1) {
      tiles[idx] = 3; // Wasser
      continue;
    }
    const e = (elevation[idx] ?? 0) / 255;
    if (e >= rockThreshold) {
      tiles[idx] = 4; // Fels
      continue;
    }
    if ((forest[idx] ?? 0) === 1) {
      tiles[idx] = 5; // Wald
      continue;
    }
    tiles[idx] = (fertility[idx] ?? 0) / 255 >= grassThreshold ? 1 : 0; // Gras : Ödland
  }

  // Flüsse bleiben sichtbar (Wasser statt Wald/Gras), sind aber Teil des Landsystems.
  for (let idx = 0; idx < tiles.length; idx++) {
    if ((river[idx] ?? 0) === 1) tiles[idx] = 3;
  }

  return tiles;
}
