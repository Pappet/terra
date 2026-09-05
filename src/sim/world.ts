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
 * Serialisierung/Deserialisierung/Gleichheit: siehe worldSerialize.ts.
 */
import type { ActionContext, GameAction } from './actions';
import { Buildings } from './buildings';
import { Cities } from './cities';
import { PathFinder } from './pathfinding';
import { Population } from './population';
import { Rng } from './rng';
import { Storage } from './storage';
import type { EmploymentState } from './employment';
import { Market } from './market';
import { createTradeState, ensureTradeSize } from './trade';
import { SIM_CONFIG } from '../data/config';
import { ROAD_BY_ID } from '../data/roads';
import { generateDeposits } from '../worldgen/deposits';
import { generateDerived, type DerivedLayers } from '../worldgen/derived';
import { generateTerrain } from '../worldgen/terrain';
import { generateSurface } from '../worldgen/surface';
import { deserializeWorld, serializeWorld, type SerializedWorld } from './worldSerialize';
import { runWorldTick } from './worldTick';

/** Alle prozeduralen Layer des WorldState. */
export interface WorldLayers extends DerivedLayers {
  readonly elevation: Uint8Array;
  readonly water: Uint8Array;
  readonly river: Uint8Array;
  readonly deposits: Uint8Array;
}

export type { SerializedWorld };
export { equalWorlds } from './worldSerialize';

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
  /** Globaler Steuersatz (0..1), über setTaxRate-Action geändert.
   *  Start 25 %: 100 % wäre der M7.7-Ruin-Hebel und drückt die Zufriedenheit
   *  unter die Zuzugsschwelle (kein Wachstum, garantiert Bankrott). */
  taxRate = 0.25;
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
  /**
   * Erhöht sich NUR bei Straßenänderungen (M9.2): Cache-Key für
   * Reisezeit-Pfade — Gebäude ändern keine Routen, daher darf der
   * Pfad-Cache von Bauaktivität unberührt bleiben.
   */
  roadRev = 0;

  /** Welt-RNG (Zustand wird im Savegame mitgeführt; @internal für Laden). */
  rng: Rng;
  /** A*-Cache-Instanz (öffentlich: employment liest Reisezeiten). */
  readonly pathfinder = new PathFinder();
  /** Aktuelle Pendler-/Beschäftigungs-Zuweisung (abgeleitet, nicht serialisiert). */
  commute: EmploymentState | null = null;
  /** @internal (Tick-Orchestrierung in worldTick.ts) */
  commuteDirty = true;
  /** Gebäudebestand hat sich geändert -> Verschmutzung neu stempeln (M8.3). */
  /** @internal (Tick-Orchestrierung in worldTick.ts) */
  pollutionDirty = true;
  /** Straßen/Städte haben sich geändert -> Versorgung neu berechnen (M8.4). */
  /** @internal (Tick-Orchestrierung in worldTick.ts) */
  supplyDirty = true;
  /** Profiling-Akkumulator (M9.2, nur Diagnose): null = aus. */
  private profile: Record<string, number> | null = null;
  /** @internal (Tick-Orchestrierung in worldTick.ts) */
  queue: GameAction[] = [];

  /** Subsystem-Zeiten akkumulieren (M9.2 Perf-Gate). */
  startProfiling(): void {
    this.profile = {};
  }

  /** Akkumulierte Subsystem-Zeiten (ms) lesen und Profiling beenden. */
  stopProfiling(): Record<string, number> {
    const p = this.profile ?? {};
    this.profile = null;
    return p;
  }

  /** Misst fn, wenn Profiling an (sonst direkter Aufruf, kein Overhead). */
  measure<T>(key: string, fn: () => T): T {
    if (this.profile === null) return fn();
    const t0 = performance.now();
    const result = fn();
    this.profile[key] = (this.profile[key] ?? 0) + (performance.now() - t0);
    return result;
  }

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
  rebuildCityZoneTiles(): void {
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
    runWorldTick(this);
  }

  /** @internal Hält Bevölkerungs-Vektoren mit der Stadtanzahl synchron (Gründung/Laden). */
  syncPopulation(): void {
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
  recomputeUpkeep(): void {
    let upkeep = 0;
    for (let i = 0; i < this.roads.length; i++) {
      const road = ROAD_BY_ID.get(this.roads[i] ?? 0);
      if (road !== undefined) upkeep += road.upkeepPerTick;
    }
    this.upkeepPerTick = upkeep;
  }

  /** @internal (Route-Auswertung in worldTick.ts) */
  routeContext(): ActionContext & { rev: number } {
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
      rev: this.roadRev, // Cache-Key: nur Straßenänderungen invalidieren Pfade
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
    return serializeWorld(this);
  }

  toJson(): string {
    return JSON.stringify(this.serialize());
  }

  static fromJson(json: string): World {
    return World.deserialize(JSON.parse(json));
  }

  /** Aus beliebigem (untrusted) JSON wiederherstellen; wirft bei Defekten. */
  static deserialize(data: unknown): World {
    return deserializeWorld(data);
  }
}
