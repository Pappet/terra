/**
 * Zentrale Test-Fakes (lineWorld-Muster): deterministische 1-Zeilen-Welten
 * für Handels-/Zuweisungs-/Produktions-Tests ohne Karten-Geographie-Roulette.
 * Bewusst in tests/ und nicht in src/: reine Testinfrastruktur.
 */
import { World } from '../src/sim/world';
import { Buildings } from '../src/sim/buildings';
import { Cities } from '../src/sim/cities';
import { Market } from '../src/sim/market';
import { PathFinder } from '../src/sim/pathfinding';
import { Population } from '../src/sim/population';
import { Storage } from '../src/sim/storage';
import { cohortIndex } from '../src/sim/population';
import { assignWorkers } from '../src/sim/employment';
import { runProductionTick } from '../src/sim/production';
import { updateMarket } from '../src/sim/market';
export interface LineWorldOptions {
  width: number;
  /** Strassentyp auf allen Land-Tiles (0 = keine Strassen). */
  roadType?: number;
  /** Wasser-Spalten (unterbrechen Korridore). */
  waterColumns?: number[];
  /** update()-Pipeline aktivieren: Zuweisung + Produktion + Markt. */
  production?: boolean;
}

/**
 * 1-Zeilen-Welt mit vollständiger SoA-Ausstattung. Mit production=true
 * bekommt das Fake eine schlanke update()-Pipeline (Zuweisung + Produktion
 * + Markt); Demografie/Zonen bleiben außen vor (für die meisten
 * Produktions- und Handelstests irrelevant, via echte World-Tests abgedeckt).
 */
export function lineWorld(opts: LineWorldOptions): World {
  const width = opts.width;
  const water = new Uint8Array(width);
  const roads = new Uint8Array(width);
  const tiles = new Uint8Array(width).fill(1);
  for (const col of opts.waterColumns ?? []) {
    if (col >= 0 && col < width) water[col] = 1;
  }
  if ((opts.roadType ?? 0) > 0) {
    for (let i = 0; i < width; i++) {
      if (water[i] === 0) roads[i] = opts.roadType as number;
    }
  }

  const world = {
    width,
    height: 1,
    tiles,
    water,
    roads,
    layers: { water },
    cities: new Cities(),
    buildings: new Buildings(),
    population: new Population(),
    storage: new Storage(),
    market: new Market(),
    buildingIndex: new Int32Array(width),
    treasury: 500,
    pathfinder: new PathFinder(),
    tileRev: 0,
  } as unknown as World;

  if (opts.production === true) {
    (world as { update: () => void }).update = () => {
      world.commute = assignWorkers(world);
      updateMarket(world, runProductionTick(world));
    };
  }

  // removeBuildingAt (Swap + Tile-Index-Pflege), wie World es macht
  (world as unknown as { removeBuildingAt: (index: number) => void }).removeBuildingAt = (index: number) => {
    const b = world.buildings;
    const lastId = b.count;
    const rx = b.x[index] as number;
    const ry = b.y[index] as number;
    world.buildingIndex[ry * width + rx] = 0;
    if (index !== lastId - 1) {
      const mx = b.x[lastId - 1] as number;
      const my = b.y[lastId - 1] as number;
      world.buildingIndex[my * width + mx] = index + 1;
    }
    b.removeAt(index);
  };

  return world;
}

/** Erwachsene (Altersgruppe 1) in einer Stadt ansiedeln. */
export function addAdults(w: World, cityId: number, count: number): void {
  w.population.ensureCity(cityId);
  w.population.add(cityId, cohortIndex(1, 0, 0), count);
}
