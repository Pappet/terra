/**
 * Overlay-Farblogik (M1): füllt ein RGBA-Pixelarray (1px pro Tile) für einen
 * Overlay-Modus. Gradienten laufen über eine vorberechnete 256er-LUT.
 */
import {
  DEPOSIT_COLORS,
  overlayById,
  type OverlayDef,
} from '../data/overlays';
import { BUILDING_COLORS, ZONE_COLORS } from '../data/cities';
import { ROAD_BY_ID, ROAD_TYPES } from '../data/roads';
import { TILE_TYPES } from '../data/tiles';
import type { World } from '../sim/world';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function mapToRgb(map: ReadonlyMap<number, string>): Map<number, Rgb> {
  return new Map([...map.entries()].map(([k, v]) => [k, hexToRgb(v)]));
}

const roadColors = ROAD_TYPES.map((r) => hexToRgb(r.color));
const roadColorById = new Map<number, Rgb>(ROAD_TYPES.map((r) => [r.id, hexToRgb(r.color)]));
const buildingColorById = mapToRgb(BUILDING_COLORS);
const zoneColorById = mapToRgb(ZONE_COLORS);
const routeHighlight = hexToRgb('#e08a3c');
const routeStart = hexToRgb('#ffd27a');
const routeGoal = hexToRgb('#ff5f4a');

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const gradientLuts = new Map<string, Uint8Array>();

function gradientLut(def: OverlayDef): Uint8Array {
  const cached = gradientLuts.get(def.id);
  if (cached !== undefined) return cached;
  const min = hexToRgb(def.min ?? '#000000');
  const max = hexToRgb(def.max ?? '#ffffff');
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    lut[i * 3] = Math.round(min.r + (max.r - min.r) * t);
    lut[i * 3 + 1] = Math.round(min.g + (max.g - min.g) * t);
    lut[i * 3 + 2] = Math.round(min.b + (max.b - min.b) * t);
  }
  gradientLuts.set(def.id, lut);
  return lut;
}

/** Füllt rgba (4 Bytes pro Tile) im Modus des Overlays. */
export function fillTileColors(world: World, overlayId: string, rgba: Uint8ClampedArray): void {
  const def = overlayById(overlayId);
  const fallback = hexToRgb('#ff00ff');
  if (def === undefined) {
    for (let i = 0; i < world.tiles.length; i++) {
      rgba[i * 4] = fallback.r;
      rgba[i * 4 + 1] = fallback.g;
      rgba[i * 4 + 2] = fallback.b;
      rgba[i * 4 + 3] = 255;
    }
    return;
  }

  const { width, height } = world;
  const tiles = world.tiles;
  const layers = world.layers;

  const colors = TILE_TYPES.map((t) => hexToRgb(t.color));

  /** Oberflächenfarbe mit Strassen/Gebäuden als Überprägung. */
  const baseColor = (i: number): Rgb => {
    const buildingId = world.buildingIndex[i] ?? 0;
    if (buildingId !== 0) {
      const bType = world.buildings.type[buildingId - 1] ?? 0;
      const c = buildingColorById.get(bType);
      if (c !== undefined) return c;
    }
    const road = ROAD_BY_ID.get(world.roads[i] ?? 0);
    if (road !== undefined) {
      const c = roadColorById.get(road.id);
      if (c !== undefined) return c;
    }
    return colors[tiles[i] ?? 0] ?? fallback;
  };

  switch (def.kind) {
    case 'surface': {
      for (let i = 0; i < width * height; i++) {
        const c = baseColor(i);
        rgba[i * 4] = c.r;
        rgba[i * 4 + 1] = c.g;
        rgba[i * 4 + 2] = c.b;
        rgba[i * 4 + 3] = 255;
      }
      return;
    }
    case 'zones': {
      for (let i = 0; i < width * height; i++) {
        const zone = world.zoneType[i] ?? 0;
        const buildingId = world.buildingIndex[i] ?? 0;
        const c =
          buildingId !== 0
            ? (buildingColorById.get(world.buildings.type[buildingId - 1] ?? 0) ?? fallback)
            : zone !== 0
              ? (zoneColorById.get(zone) ?? fallback)
              : (colors[tiles[i] ?? 0] ?? fallback);
        rgba[i * 4] = c.r;
        rgba[i * 4 + 1] = c.g;
        rgba[i * 4 + 2] = c.b;
        rgba[i * 4 + 3] = 255;
      }
      return;
    }
    case 'roads': {
      const base = hexToRgb('#10140f');
      for (let i = 0; i < width * height; i++) {
        const road = ROAD_BY_ID.get(world.roads[i] ?? 0);
        const c = road === undefined ? base : (roadColors[ROAD_TYPES.findIndex((r) => r.id === road.id)] ?? fallback);
        rgba[i * 4] = c.r;
        rgba[i * 4 + 1] = c.g;
        rgba[i * 4 + 2] = c.b;
        rgba[i * 4 + 3] = 255;
      }
      return;
    }
    case 'route': {
      // Oberflächenbasis + Routen-Highlight
      const colors = TILE_TYPES.map((t) => hexToRgb(t.color));
      const route = world.route;
      const onPath = new Set<number>(route?.path ?? []);
      const start = route !== null && route.path.length > 0 ? route.path[0] : -1;
      const goal = route !== null && route.path.length > 0 ? route.path[route.path.length - 1] : -1;
      for (let i = 0; i < width * height; i++) {
        let c = colors[tiles[i] ?? 0] ?? fallback;
        const road = ROAD_BY_ID.get(world.roads[i] ?? 0);
        if (road !== undefined) c = roadColorById.get(road.id) ?? c;
        if (onPath.has(i)) c = i === start ? routeStart : i === goal ? routeGoal : routeHighlight;
        rgba[i * 4] = c.r;
        rgba[i * 4 + 1] = c.g;
        rgba[i * 4 + 2] = c.b;
        rgba[i * 4 + 3] = 255;
      }
      return;
    }
    case 'gradient': {
      const lut = gradientLut(def);
      const layer = def.layer === 'elevation' ? layers.elevation : layers.fertility;
      for (let i = 0; i < width * height; i++) {
        const v = (layer[i] ?? 0) * 3;
        rgba[i * 4] = lut[v] ?? 0;
        rgba[i * 4 + 1] = lut[v + 1] ?? 0;
        rgba[i * 4 + 2] = lut[v + 2] ?? 0;
        rgba[i * 4 + 3] = 255;
      }
      return;
    }
    case 'boolean': {
      const off = hexToRgb(def.falseColor ?? '#000000');
      const on = hexToRgb(def.trueColor ?? '#ffffff');
      const layer = layers.forest;
      for (let i = 0; i < width * height; i++) {
        const c = (layer[i] ?? 0) === 1 ? on : off;
        rgba[i * 4] = c.r;
        rgba[i * 4 + 1] = c.g;
        rgba[i * 4 + 2] = c.b;
        rgba[i * 4 + 3] = 255;
      }
      return;
    }
    case 'water': {
      const sea = hexToRgb('#28527a');
      const river = hexToRgb('#5b9bd5');
      const land = hexToRgb('#1a2016');
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const c = (layers.river[i] ?? 0) === 1 ? river : (layers.water[i] ?? 0) === 1 ? sea : land;
          rgba[i * 4] = c.r;
          rgba[i * 4 + 1] = c.g;
          rgba[i * 4 + 2] = c.b;
          rgba[i * 4 + 3] = 255;
        }
      }
      return;
    }
    case 'bitmask': {
      const base = hexToRgb('#141813');
      for (let i = 0; i < width * height; i++) {
        const bits = layers.deposits[i] ?? 0;
        const present = [...DEPOSIT_COLORS.entries()].filter(([bit]) => (bits & bit) !== 0);
        let c: Rgb;
        if (present.length === 0) {
          c = base;
        } else if (present.length === 1) {
          c = { r: present[0]![1][0], g: present[0]![1][1], b: present[0]![1][2] };
        } else {
          // Mehrfachvorkommen: mischen
          let r = 0;
          let g = 0;
          let b = 0;
          for (const [, col] of present) {
            r += col[0];
            g += col[1];
            b += col[2];
          }
          c = { r: Math.round(r / present.length), g: Math.round(g / present.length), b: Math.round(b / present.length) };
        }
        rgba[i * 4] = c.r;
        rgba[i * 4 + 1] = c.g;
        rgba[i * 4 + 2] = c.b;
        rgba[i * 4 + 3] = 255;
      }
      return;
    }
  }
}
