/**
 * Serialisierung des Weltzustands (M9.3-Ausgliederung aus world.ts):
 * Savegame-JSON (Layer als base64), Wiederherstellung mit harten
 * Validierungen sowie die tiefe Gleichheitsprüfung für Tests.
 * Kein Verhalten: reine Funktionsauslagerung, Golden-Master bleibt gleich.
 */
import { base64ToBytes, bytesToBase64, bytesToInt16, int16ToBytes } from './base64';
import { Buildings } from './buildings';
import { Cities } from './cities';
import { Population } from './population';
import { Rng } from './rng';
import { Storage } from './storage';
import { Market } from './market';
import { createTradeState } from './trade';
import { assignWorkers } from './employment';
import { recomputePollution } from './pollution';
import { recomputeSupply } from './networks';
import { SIM_CONFIG } from '../data/config';
import { TILE_TYPES } from '../data/tiles';
import { DEPOSIT_DEFS } from '../data/deposits';
import type { WorldLayers } from './world';
import { World } from './world';

/** JSON-Savegame-Layout (Version in SIM_CONFIG.saveVersion). */
export interface SerializedWorld {
  saveVersion: number;
  seed: number;
  tick: number;
  width: number;
  height: number;
  treasury: number;
  taxRate: number;
  debt: number;
  bankrupt: boolean;
  history: { tick: number[]; treasury: number[]; residents: number[]; satisfaction: number[] };
  tiles: string;
  roads: string;
  cities: ReturnType<Cities['serialize']>;
  buildings: ReturnType<Buildings['serialize']>;
  zoneType: string;
  zoneCity: string;
  population: number[][];
  storage: number[][];
  market: { prices: number[][]; produced: number[][]; consumed: number[][] };
  trade: { exports: number[][]; imports: number[][] };
  layers: Record<keyof WorldLayers, string>;
  rngState: number;
}

const LAYER_KEYS = [
  'elevation',
  'water',
  'river',
  'fertility',
  'forest',
  'deposits',
] as const;

const ALL_DEPOSIT_BITS = DEPOSIT_DEFS.reduce((acc, d) => acc | d.bit, 0);

export function serializeWorld(world: World): SerializedWorld {
  const layers = {} as Record<keyof WorldLayers, string>;
  for (const key of LAYER_KEYS) {
    layers[key] = bytesToBase64(world.layers[key]);
  }
  return {
    saveVersion: SIM_CONFIG.saveVersion,
    seed: world.seed,
    tick: world.tick,
    width: world.width,
    height: world.height,
    treasury: world.treasury,
    taxRate: world.taxRate,
    debt: world.debt,
    bankrupt: world.bankrupt,
    history: JSON.parse(JSON.stringify(world.history)),
    tiles: bytesToBase64(world.tiles),
    roads: bytesToBase64(world.roads),
    cities: world.cities.serialize(),
    buildings: world.buildings.serialize(),
    zoneType: bytesToBase64(world.zoneType),
    zoneCity: bytesToBase64(int16ToBytes(world.zoneCity)),
    population: world.population.serialize(),
    storage: world.storage.serialize(),
    market: world.market.serialize(),
    trade: { exports: world.trade.exports.map((v) => Array.from(v)), imports: world.trade.imports.map((v) => Array.from(v)) },
    layers,
    rngState: world.rngStateU32,
  };
}

/** Aus beliebigem (untrusted) JSON wiederherstellen; wirft bei Defekten. */
export function deserializeWorld(data: unknown): World {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Savegame: kein Objekt');
  }
  const d = data as Record<string, unknown>;
  if (d.saveVersion !== SIM_CONFIG.saveVersion) {
    throw new Error(
      `Savegame-Version ${String(d.saveVersion)} wird nicht unterstützt (erwartet ${SIM_CONFIG.saveVersion})`,
    );
  }
  const seed = asUint32(d.seed, 'seed');
  const width = asUint32(d.width, 'width');
  const height = asUint32(d.height, 'height');
  const tick = asUint32(d.tick, 'tick');
  if (width === 0 || height === 0) {
    throw new Error(`Savegame: ungültige Kartengrösse ${width}x${height}`);
  }
  const size = width * height;

  const world = new World(seed, width, height);
  world.tiles = decodeLayer(d.tiles, 'tiles', size, 0, TILE_TYPES.length - 1);
  world.roads = decodeLayer(d.roads, 'roads', size, 0, 255);
  world.cities = Cities.deserialize(d.cities);
  world.buildings = Buildings.deserialize(d.buildings);
  world.zoneType = decodeLayer(d.zoneType, 'zoneType', size, 0, 3);
  world.population = Population.deserialize(d.population);
  world.storage = Storage.deserialize(d.storage);
  world.market = Market.deserialize(d.market);
  world.trade = createTradeState();
  world.trade.exports = (d.trade as { exports: number[][] }).exports.map((v) => Float64Array.from(v));
  world.trade.imports = (d.trade as { imports: number[][] }).imports.map((v) => Float64Array.from(v));
  if (world.population.perCity.length < world.cities.count) {
    throw new Error('Savegame: Bevölkerungsvektoren fehlen für geladene Städte');
  }
  const zoneCityBytes = base64ToBytes(typeof d.zoneCity === 'string' ? d.zoneCity : '');
  if (zoneCityBytes.length !== size * 2) {
    throw new Error(`Savegame: zoneCity hat ${zoneCityBytes.length} Bytes, erwartet ${size * 2}`);
  }
  world.zoneCity = bytesToInt16(zoneCityBytes);
  for (let i = 0; i < size; i++) {
    const cityId = world.zoneCity[i] ?? 0;
    if (cityId < 0 || cityId > world.cities.count) {
      throw new Error(`Savegame: zoneCity[${i}] verweist auf unbekannte Stadt ${cityId}`);
    }
  }
  // buildingIndex ist abgeleitet -> aus den Gebäuden rekonstruieren.
  for (let b = 0; b < world.buildings.count; b++) {
    const bx = world.buildings.x[b] as number;
    const by = world.buildings.y[b] as number;
    const idx = by * width + bx;
    if ((world.buildingIndex[idx] ?? 0) !== 0) {
      throw new Error(`Savegame: zwei Gebäude auf Tile ${bx},${by}`);
    }
    world.buildingIndex[idx] = b + 1;
  }
  const treasury = d.treasury;
  // Negative Kasse ist gültig: bankrotte Städte liegen unter 0 (M7.4) und
  // müssen sich über das Savegame hinweg wieder erholen können.
  if (typeof treasury !== 'number' || !Number.isFinite(treasury)) {
    throw new Error(`Savegame: treasury ist keine gültige Zahl: ${String(treasury)}`);
  }
  world.treasury = treasury;
  const taxRate = d.taxRate;
  if (typeof taxRate !== 'number' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    throw new Error(`Savegame: taxRate ungültig: ${String(taxRate)}`);
  }
  world.taxRate = taxRate;
  const debt = d.debt;
  if (typeof debt !== 'number' || !Number.isFinite(debt) || debt < 0) {
    throw new Error(`Savegame: debt ungültig: ${String(debt)}`);
  }
  world.debt = debt;
  if (d.bankrupt !== true && d.bankrupt !== false) {
    throw new Error('Savegame: bankrupt fehlt oder ist kein Boolean');
  }
  world.bankrupt = d.bankrupt as boolean;
  const hist = d.history as { tick?: unknown; treasury?: unknown; residents?: unknown; satisfaction?: unknown } | undefined;
  if (hist !== undefined) {
    for (const key of ['tick', 'treasury', 'residents', 'satisfaction'] as const) {
      const arr = hist[key];
      if (Array.isArray(arr)) (world.history[key] as number[]) = [...(arr as number[])];
    }
  }

  if (typeof d.layers !== 'object' || d.layers === null) {
    throw new Error('Savegame: layers fehlt');
  }
  const rawLayers = d.layers as Record<string, unknown>;
  const layers = {} as { -readonly [K in keyof WorldLayers]: Uint8Array };
  for (const key of LAYER_KEYS) {
    layers[key] = decodeLayer(rawLayers[key], `layers.${key}`, size, 0, 255);
  }
  for (let i = 0; i < size; i++) {
    if ((layers.water[i] ?? 0) > 1) throw new Error(`Savegame: layers.water[${i}] ist nicht 0/1`);
    if ((layers.river[i] ?? 0) > 1) throw new Error(`Savegame: layers.river[${i}] ist nicht 0/1`);
    if ((layers.forest[i] ?? 0) > 1) throw new Error(`Savegame: layers.forest[${i}] ist nicht 0/1`);
    if (((layers.deposits[i] ?? 0) & ~ALL_DEPOSIT_BITS) !== 0) {
      throw new Error(`Savegame: layers.deposits[${i}] enthält unbekannte Bits`);
    }
  }
  world.layers = layers;
  world.tick = tick;
  world.rebuildCityZoneTiles();
  world.recomputeUpkeep();
  recomputeSupply(world); // abgeleitete M8-Layer neu (nicht serialisiert)
  recomputePollution(world);
  world.commute = assignWorkers(world);
  world.rng = Rng.fromState(asUint32(d.rngState, 'rngState'));
  return world;
}

/** Tiefe Gleichheit zweier Welten (Tests, Savegame-Verifikation).
 *  Vergleicht nur Sim-Zustand; `tileRev` ist Renderer-Bookkeeping und wird
 *  bewusst nicht serialisiert, daher nicht verglichen. */
export function equalWorlds(a: World, b: World): boolean {
  if (
    a.seed !== b.seed || a.width !== b.width || a.height !== b.height ||
    a.tick !== b.tick || a.treasury !== b.treasury || a.taxRate !== b.taxRate || a.debt !== b.debt || a.bankrupt !== b.bankrupt || a.rngStateU32 !== b.rngStateU32
  ) {
    return false;
  }
  // Route ist Teil des deterministischen Zustands (Action-Ergebnis).
  if ((a.route === null) !== (b.route === null)) return false;
  if (a.route !== null && b.route !== null) {
    if (a.route.timeTicks !== b.route.timeTicks || a.route.rev !== b.route.rev) return false;
    if (a.route.path.length !== b.route.path.length) return false;
    for (let i = 0; i < a.route.path.length; i++) {
      if (a.route.path[i] !== b.route.path[i]) return false;
    }
  }
  const arrays: Array<[Uint8Array, Uint8Array]> = [
    [a.tiles, b.tiles],
    [a.roads, b.roads],
    [a.zoneType, b.zoneType],
    [a.layers.elevation, b.layers.elevation],
    [a.layers.water, b.layers.water],
    [a.layers.river, b.layers.river],
    [a.layers.fertility, b.layers.fertility],
    [a.layers.forest, b.layers.forest],
    [a.layers.deposits, b.layers.deposits],
  ];
  for (const [x, y] of arrays) {
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== y[i]) return false;
    }
  }
  // Pendler-Zuweisung (deterministisch abgeleitet).
  if ((a.commute === null) !== (b.commute === null)) return false;
  if (a.commute !== null && b.commute !== null) {
    if (JSON.stringify(a.commute) !== JSON.stringify(b.commute)) return false;
  }
  // Städte & Gebäude (SoA) + Zonen-Besitz + Gebäude-Index + Bevölkerung.
  if (
    a.cities.count !== b.cities.count ||
    a.buildings.count !== b.buildings.count ||
    JSON.stringify(a.cities.serialize()) !== JSON.stringify(b.cities.serialize()) ||
    JSON.stringify(a.buildings.serialize()) !== JSON.stringify(b.buildings.serialize()) ||
    JSON.stringify(a.population.serialize()) !== JSON.stringify(b.population.serialize()) ||
    JSON.stringify(a.storage.serialize()) !== JSON.stringify(b.storage.serialize()) ||
    JSON.stringify(a.trade.exports.map((v) => Array.from(v))) !== JSON.stringify(b.trade.exports.map((v) => Array.from(v))) ||
    JSON.stringify(a.trade.imports.map((v) => Array.from(v))) !== JSON.stringify(b.trade.imports.map((v) => Array.from(v)))
  ) {
    return false;
  }
  for (let i = 0; i < a.zoneCity.length; i++) {
    if (a.zoneCity[i] !== b.zoneCity[i]) return false;
    if (a.buildingIndex[i] !== b.buildingIndex[i]) return false;
  }
  return true;
}

function decodeLayer(value: unknown, name: string, size: number, min: number, max: number): Uint8Array {
  if (typeof value !== 'string') {
    throw new Error(`Savegame: Feld "${name}" fehlt oder ist kein base64-String`);
  }
  const bytes = base64ToBytes(value);
  if (bytes.length !== size) {
    throw new Error(`Savegame: "${name}" hat ${bytes.length} Bytes, erwartet ${size}`);
  }
  if (min === 0 && max === 255) return bytes;
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ?? 0;
    if (v < min || v > max) {
      throw new Error(`Savegame: "${name}"[${i}] = ${v} ausserhalb [${min}, ${max}]`);
    }
  }
  return bytes;
}

function asUint32(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Savegame: Feld "${field}" ist kein uint32: ${String(value)}`);
  }
  return value;
}
