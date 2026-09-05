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
import { base64ToBytes, bytesToBase64, bytesToInt16, int16ToBytes } from './base64';
import { Buildings } from './buildings';
import { Cities } from './cities';
import { PathFinder } from './pathfinding';
import { Population } from './population';
import { Rng } from './rng';
import { runGrowthTick } from './growth';
import { runDemographicsTick, runMigration, computeMaxDebt } from './demographics';
import { Storage } from './storage';
import { assignWorkers, type EmploymentState } from './employment';
import { runProductionTick } from './production';
import { Market, updateMarket } from './market';
import { createTradeState, runTradeTick, ensureTradeSize } from './trade';
import { recomputePollution } from './pollution';
import { recomputeSupply } from './networks';
import { runEventTick } from './events';
import { FINANCE } from '../data/cities';
import { SIM_CONFIG } from '../data/config';
import { TILE_TYPES } from '../data/tiles';
import { DEPOSIT_DEFS } from '../data/deposits';
import { ROAD_BY_ID } from '../data/roads';
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

/** JSON-Savegame-Layout (Version in SIM_CONFIG.saveVersion, aktuell 6). */
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

export class World {
  readonly seed: number;
  readonly width: number;
  readonly height: number;

  tick = 0;
  tiles: Uint8Array;
  layers: WorldLayers;
  /** Strassentyp pro Tile (0 = keine Strasse, siehe /src/data/roads.ts). */
  roads: Uint8Array;
  /** Städte als SoA; IDs beginnen bei 1. */
  cities: Cities;
  /** Gebäude als SoA; IDs beginnen bei 1. */
  buildings: Buildings;
  /** Zonen-Typ pro Tile (0 = keine Zone, 1 R, 2 C, 3 I). */
  zoneType: Uint8Array;
  /** Stadt-ID der Zone (0 = keine). */
  zoneCity: Int16Array;
  /** Gebäude-ID pro Tile (0 = keins). */
  buildingIndex: Int32Array;
  /** Verschmutzung pro Tile 0..255 (M8.3, abgeleitet aus Industriegebäuden). */
  pollution: Uint8Array;
  /** Netzversorgung pro Tile 0/1 (M8.4, abgeleitet aus Zentren + Straßennetz). */
  supply: Uint8Array;
  /** Pro Stadt (Index Stadt-ID - 1): gezonte, noch unbebaute Tile-Indizes. */
  cityZoneTiles: number[][];
  /** Bevölkerung als Kohorten pro Stadt. */
  population: Population;
  /** Lagerbestände pro Stadt (Güter laut /src/data/goods.ts). */
  storage: Storage;
  /** Lokaler Markt: Preise und Nachfrage-/Angebotsraten pro Stadt. */
  market: Market;
  /** Handel: Routen, Flüsse, Import/Export-Bilanzen. */
  trade: ReturnType<typeof createTradeState>;
  /** Staatskasse. Bau-/Unterhaltskosten werden über Actions/Ticks verbucht. */
  treasury: number = SIM_CONFIG.startingTreasury;
  /** Globaler Steuersatz (0..1), über setTaxRate-Action geändert. */
  taxRate = 1;
  /** Restschuld aus Krediten (M7.3). */
  debt = 0;
  /** Kreditlimit: maxDebtPerAdult × Erwachsene (im Intervall aktualisiert). */
  maxDebt = 0;
  /** Bankrott-Flag (M7.4): blockiert Bau-Aktionen. */
  bankrupt = false;
  /** Zeitreihen (M7.5): Sample pro Demografie-Intervall, max 200 Eintraege. */
  history: { tick: number[]; treasury: number[]; residents: number[]; satisfaction: number[] } = {
    tick: [], treasury: [], residents: [], satisfaction: [],
  };
  /** Grund des zuletzt abgelehnten Action-Calls (UI-Anzeige), sonst null. */
  lastRejected: string | null = null;
  /** Angezeigte Route (Snapshot bei Anfragezeit, rev = tileRev dann). Transient, nicht im Savegame. */
  route: { readonly path: readonly number[]; readonly timeTicks: number; readonly rev: number } | null = null;
  /** Vom Tick auszuwertende Routenanfrage (ActionContext-Kontrakt). */
  routeRequest: { from: number; to: number } | null = null;
  /** Laufende Unterhaltskosten pro Tick (wird bei Strassenänderungen neu berechnet). */
  upkeepPerTick = 0;
  /** Erhöht sich bei jeder Änderung an sichtbaren Layerdaten (tiles/roads). */
  tileRev = 0;

  private rng: Rng;
  /** A*-Cache-Instanz (öffentlich: employment liest Reisezeiten). */
  readonly pathfinder = new PathFinder();
  /** Aktuelle Pendler-/Beschäftigungs-Zuweisung (abgeleitet, nicht serialisiert). */
  commute: EmploymentState | null = null;
  private commuteDirty = true;
  /** Gebäudebestand hat sich geändert -> Verschmutzung neu stempeln (M8.3). */
  private pollutionDirty = true;
  /** Straßen/Städte haben sich geändert -> Versorgung neu berechnen (M8.4). */
  private supplyDirty = true;
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
    this.cities = new Cities();
    this.buildings = new Buildings();
    this.zoneType = new Uint8Array(width * height);
    this.zoneCity = new Int16Array(width * height);
    this.buildingIndex = new Int32Array(width * height);
    this.pollution = new Uint8Array(width * height);
    this.supply = new Uint8Array(width * height);
    this.cityZoneTiles = [];
    this.population = new Population();
    this.storage = new Storage();
    this.market = new Market();
    this.trade = createTradeState();
  }

  /** Zonen-Tile-Listen aus den Layern rekonstruieren (Laden, Aktionen pflegen sie sonst). */
  private rebuildCityZoneTiles(): void {
    this.cityZoneTiles = [];
    for (let c = 0; c < this.cities.count; c++) this.cityZoneTiles.push([]);
    for (let idx = 0; idx < this.zoneType.length; idx++) {
      const cityId = this.zoneCity[idx] ?? 0;
      if (cityId === 0) continue;
      if ((this.buildingIndex[idx] ?? 0) !== 0) continue;
      const list = this.cityZoneTiles[cityId - 1];
      if (list !== undefined) list.push(idx);
    }
  }

  /**
   * Gebäude an einer Stelle registrieren (Tick-System M3.4); pflegt den
   * Tile-Index. Wirft, wenn das Tile bereits bebaut ist.
   */
  addBuildingAt(cityId: number, x: number, y: number, type: number, recipe = -1): number {
    const idx = y * this.width + x;
    if ((this.buildingIndex[idx] ?? 0) !== 0) {
      throw new Error(`addBuildingAt: Tile ${x},${y} ist bereits bebaut`);
    }
    const id = this.buildings.add(cityId, x, y, type, recipe);
    this.buildingIndex[idx] = id;
    this.removeFromZoneTiles(cityId, idx);
    this.tileRev++;
    this.commuteDirty = true;
    this.pollutionDirty = true;
    return id;
  }

  private removeFromZoneTiles(cityId: number, idx: number): void {
    const list = this.cityZoneTiles[cityId - 1];
    if (list === undefined) return;
    const at = list.indexOf(idx);
    if (at >= 0) list.splice(at, 1);
  }

  private addToZoneTiles(cityId: number, idx: number): void {
    const list = this.cityZoneTiles[cityId - 1];
    if (list === undefined) return;
    if (!list.includes(idx)) list.push(idx);
  }

  /**
   * Gebäude (0-basierter Array-Index) entfernen und Tile-Index aufräumen.
   * Achtung: Swap-Removal ändert die ID des letzten Gebäudes – der
   * Tile-Index wird entsprechend nachgezogen.
   */
  removeBuildingAt(index: number): void {
    const lastId = this.buildings.count;
    if (index < 0 || index >= lastId) {
      throw new Error(`removeBuildingAt: Index ${index} ausserhalb [0, ${lastId})`);
    }
    const rx = this.buildings.x[index] as number;
    const ry = this.buildings.y[index] as number;
    this.buildingIndex[ry * this.width + rx] = 0;
    if (index !== lastId - 1) {
      const mx = this.buildings.x[lastId - 1] as number;
      const my = this.buildings.y[lastId - 1] as number;
      this.buildingIndex[my * this.width + mx] = index + 1; // neue ID des verschobenen Gebäudes
    }
    this.buildings.removeAt(index);
    // Zone besteht weiter -> Tile wieder als Bauland anbieten
    const zoneCityId = this.zoneCity[ry * this.width + rx] ?? 0;
    if (zoneCityId !== 0 && (this.zoneType[ry * this.width + rx] ?? 0) !== 0) {
      this.addToZoneTiles(zoneCityId, ry * this.width + rx);
    }
    this.tileRev++;
    this.commuteDirty = true;
    this.pollutionDirty = true;
  }

  /** Action einreihen; sie greift zu Beginn des nächsten update(). */
  enqueue(action: GameAction): void {
    this.queue.push(action);
  }

  /** Ein Sim-Tick: Unterhalt für den Bestand, dann Actions, dann Route auswerten. */
  update(): void {
    this.lastRejected = null;
    this.maxDebt = computeMaxDebt(this); // Kreditlimit aktuell halten (Actions!)
    this.treasury -= this.upkeepPerTick; // Bestand zu Tickbeginn, Bautick selbst gratis
    // Bankrott-Prüfung (M7.4): jeder Tick, Kasse unter Grenze -> blockiert Bau
    if (this.treasury < FINANCE.bankruptcyTreasuryLimit) {
      this.bankrupt = true;
    } else if (this.treasury >= 0) {
      this.bankrupt = false;
    }
    let roadsChanged = false;
    let routeDirty = false;
    if (this.queue.length > 0) {
      for (const action of this.queue) {
        applyAction(this, action);
        if (action.kind === 'buildRoad' || action.kind === 'demolishRoad') roadsChanged = true;
        if (action.kind === 'foundCity') {
          this.commuteDirty = true;
          this.supplyDirty = true;
        }
        if (action.kind === 'requestRoute' || action.kind === 'clearRoute') routeDirty = true;
      }
      this.tileRev++;
      this.queue = [];
    }
    if (roadsChanged) {
      this.recomputeUpkeep(); // wirkt ab dem nächsten Tick
      this.commuteDirty = true;
      this.supplyDirty = true;
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
    // M8.4: Versorgung aus Zentren + Straßennetz (nach Actions, vor Wachstum)
    if (this.supplyDirty) {
      recomputeSupply(this);
      this.supplyDirty = false;
    }
    // M8.3: Verschmutzung aus Industriebestand neu stempeln
    if (this.pollutionDirty) {
      recomputePollution(this);
      this.pollutionDirty = false;
    }
    runGrowthTick(this, this.rng);
    if (runDemographicsTick(this, this.rng, this.tick + 1)) { // abschliessender Tick
      runMigration(this, this.rng);
      this.commuteDirty = true;
      runEventTick(this, this.rng); // M8.5: Ereignisse deterministisch im Intervall
    }
    this.syncPopulation();
    // Arbeitsplatz-Zuweisung bei jeder relevanten Änderung (Städte, Gebäude,
    // Bevölkerung, Strassen) – sonst bleibt die letzte Zuweisung stehen.
    if (this.commuteDirty) {
      this.commute = assignWorkers(this);
      this.commuteDirty = false;
    }
    updateMarket(this, runProductionTick(this));
    runTradeTick(this);
    this.tick++;
  }

  /** Hält Bevölkerungs-Vektoren mit der Stadtanzahl synchron (Gründung/Laden). */
  private syncPopulation(): void {
    this.population.ensureCity(this.cities.count);
    this.storage.ensureCity(this.cities.count);
    this.market.ensureCity(this.cities.count);
    ensureTradeSize(this.trade, this.cities.count);
  }

  /**
   * Zuzug: Einwohner als Kohorte ansiedeln (M4.5 Migration nutzt das über
   * Actions-Werte im Tick). Invalidiert die Arbeitsplatz-Zuweisung.
   */
  settleResidents(cityId: number, cohort: number, count: number): void {
    this.population.add(cityId, cohort, count);
    this.commuteDirty = true;
  }

  /** Summiert Unterhaltskosten über alle Strassentiles (nur bei Änderungen). */
  private recomputeUpkeep(): void {
    let upkeep = 0;
    for (let i = 0; i < this.roads.length; i++) {
      const road = ROAD_BY_ID.get(this.roads[i] ?? 0);
      if (road !== undefined) upkeep += road.upkeepPerTick;
    }
    this.upkeepPerTick = upkeep;
  }

  private routeContext(): ActionContext & { rev: number } {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
      water: this.layers.water,
      roads: this.roads,
      cities: this.cities,
      buildings: this.buildings,
      zoneType: this.zoneType,
      zoneCity: this.zoneCity,
      buildingIndex: this.buildingIndex,
      cityZoneTiles: this.cityZoneTiles,
      currentTick: this.currentTick,
      rev: this.tileRev,
      treasury: this.treasury,
      taxRate: this.taxRate,
      debt: this.debt,
      maxDebt: this.maxDebt,
      bankrupt: this.bankrupt,
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

  /** Tick-Nummer, die das laufende update() abschliesst (ActionContext-Kontrakt). */
  get currentTick(): number {
    return this.tick + 1;
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
      taxRate: this.taxRate,
      debt: this.debt,
      bankrupt: this.bankrupt,
      history: JSON.parse(JSON.stringify(this.history)),
      tiles: bytesToBase64(this.tiles),
      roads: bytesToBase64(this.roads),
      cities: this.cities.serialize(),
      buildings: this.buildings.serialize(),
      zoneType: bytesToBase64(this.zoneType),
      zoneCity: bytesToBase64(int16ToBytes(this.zoneCity)),
      population: this.population.serialize(),
      storage: this.storage.serialize(),
      market: this.market.serialize(),
      trade: { exports: this.trade.exports.map((v) => Array.from(v)), imports: this.trade.imports.map((v) => Array.from(v)) },
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
