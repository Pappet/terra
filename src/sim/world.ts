/**
 * Der Weltzustand: Struct-of-Arrays, serialisierbar, komplett DOM-frei.
 *
 * Änderungsregeln:
 * - Der Weltzustand ändert sich NUR über Actions in der Warteschlange, die
 *   `update()` zu Beginn des Ticks abarbeitet.
 * - Kein Objektzeiger-Netz: alle Layer sind flache Uint8Arrays, der RNG-Zustand
 *   ist ein uint32. Savegame-fähig in einem einzigen JSON (Layer als base64).
 *
 * Der Konstruktor erzeugt die Welt prozedural (M1) – gleicher Seed, gleiche Welt.
 */
import { applyAction, type ActionContext, type GameAction } from './actions';
import { base64ToBytes, bytesToBase64 } from './base64';
import { PathFinder } from './pathfinding';
import { Rng } from './rng';
import { SIM_CONFIG } from '../data/config';
import { TILE_TYPES } from '../data/tiles';
import { DEPOSIT_DEFS } from '../data/deposits';
import { generateDeposits } from '../worldgen/deposits';
import { generateDerived, type DerivedLayers } from '../worldgen/derived';
import { generateTerrain } from '../worldgen/terrain';
import { generateSurface } from '../worldgen/surface';

/** Alle prozeduralen Layer des WorldState. */
export interface WorldLayers extends DerivedLayers {
  readonly elevation: Uint8Array;
  readonly water: Uint8Array;
  readonly river: Uint8Array;
  readonly deposits: Uint8Array;
}

/** JSON-Savegame-Layout (Version in SIM_CONFIG.saveVersion, aktuell 3). */
export interface SerializedWorld {
  saveVersion: number;
  seed: number;
  tick: number;
  width: number;
  height: number;
  treasury: number;
  tiles: string;
  roads: string;
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

export class World {
  readonly seed: number;
  readonly width: number;
  readonly height: number;

  tick = 0;
  tiles: Uint8Array;
  layers: WorldLayers;
  /** Strassentyp pro Tile (0 = keine Strasse, siehe /src/data/roads.ts). */
  roads: Uint8Array;
  /** Staatskasse. Bau-/Unterhaltskosten werden über Actions/Ticks verbucht. */
  treasury: number = SIM_CONFIG.startingTreasury;
  /** Grund des zuletzt abgelehnten Action-Calls (UI-Anzeige), sonst null. */
  lastRejected: string | null = null;
  /** Angezeigte Route (Snapshot bei Anfragezeit, rev = tileRev dann). Transient, nicht im Savegame. */
  route: { readonly path: readonly number[]; readonly timeTicks: number; readonly rev: number } | null = null;
  /** Vom Tick auszuwertende Routenanfrage (ActionContext-Kontrakt). */
  routeRequest: { from: number; to: number } | null = null;
  /** Erhöht sich bei jeder Änderung an sichtbaren Layerdaten (tiles/roads). */
  tileRev = 0;

  private rng: Rng;
  private pathfinder = new PathFinder();
  private queue: GameAction[] = [];

  constructor(seed: number, width: number, height: number) {
    this.seed = seed >>> 0;
    this.width = width;
    this.height = height;
    this.rng = new Rng(this.seed);

    const terrain = generateTerrain(this.seed, width, height);
    const derived = generateDerived(this.seed, terrain);
    const deposits = generateDeposits(this.seed, terrain);
    this.tiles = generateSurface(terrain, derived);
    this.layers = { ...terrain, ...derived, deposits };
    this.roads = new Uint8Array(width * height);
  }

  /** Action einreihen; sie greift zu Beginn des nächsten update(). */
  enqueue(action: GameAction): void {
    this.queue.push(action);
  }

  /** Ein Sim-Tick: wartende Actions anwenden, Routenanfrage auswerten, Uhr weitersetzen. */
  update(): void {
    this.lastRejected = null;
    let routeDirty = false;
    if (this.queue.length > 0) {
      for (const action of this.queue) {
        applyAction(this, action);
        if (action.kind === 'requestRoute' || action.kind === 'clearRoute') routeDirty = true;
      }
      this.tileRev++;
      this.queue = [];
    }
    if (routeDirty && this.routeRequest !== null) {
      const { from, to } = this.routeRequest;
      this.routeRequest = null;
      if (from < 0 || to < 0) {
        this.route = null;
      } else {
        const result = this.pathfinder.findPath(this.routeContext(), from, to);
        this.route =
          result === null || result.path.length === 0
            ? null
            : { path: result.path, timeTicks: result.timeTicks, rev: this.tileRev };
      }
    }
    // M2.5: Unterhaltskosten pro Tick verbuchen.
    this.tick++;
  }

  private routeContext(): ActionContext & { rev: number } {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
      water: this.layers.water,
      roads: this.roads,
      rev: this.tileRev,
      treasury: this.treasury,
      lastRejected: this.lastRejected,
      routeRequest: this.routeRequest,
    };
  }

  get rngStateU32(): number {
    return this.rng.stateU32;
  }

  /** Top-Level-Sicht auf den Wasser-Layer (ActionContext-Kontrakt). */
  get water(): Uint8Array {
    return this.layers.water;
  }

  serialize(): SerializedWorld {
    const layers = {} as Record<keyof WorldLayers, string>;
    for (const key of LAYER_KEYS) {
      layers[key] = bytesToBase64(this.layers[key]);
    }
    return {
      saveVersion: SIM_CONFIG.saveVersion,
      seed: this.seed,
      tick: this.tick,
      width: this.width,
      height: this.height,
      treasury: this.treasury,
      tiles: bytesToBase64(this.tiles),
      roads: bytesToBase64(this.roads),
      layers,
      rngState: this.rng.stateU32,
    };
  }

  toJson(): string {
    return JSON.stringify(this.serialize());
  }

  static fromJson(json: string): World {
    return World.deserialize(JSON.parse(json));
  }

  /** Aus beliebigem (untrusted) JSON wiederherstellen; wirft bei Defekten. */
  static deserialize(data: unknown): World {
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
    const treasury = d.treasury;
    if (typeof treasury !== 'number' || !Number.isFinite(treasury) || treasury < 0) {
      throw new Error(`Savegame: treasury ist keine gültige Zahl: ${String(treasury)}`);
    }
    world.treasury = treasury;

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
    world.rng = Rng.fromState(asUint32(d.rngState, 'rngState'));
    return world;
  }
}

/** Tiefe Gleichheit zweier Welten (Tests, Savegame-Verifikation).
 *  Vergleicht nur Sim-Zustand; `tileRev` ist Renderer-Bookkeeping und wird
 *  bewusst nicht serialisiert, daher nicht verglichen. */
export function equalWorlds(a: World, b: World): boolean {
  if (
    a.seed !== b.seed || a.width !== b.width || a.height !== b.height ||
    a.tick !== b.tick || a.treasury !== b.treasury || a.rngStateU32 !== b.rngStateU32
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
