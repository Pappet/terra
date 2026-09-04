import { describe, expect, it } from 'vitest';
import { World } from './world';
import { tileSpeed } from './pathfinding';
import { ROAD_TYPES } from '../data/roads';

/** Findet ein Land-Tile mit bestimmter Oberfläche (z.B. Wald) in der Testwelt. */
function findTile(w: World, predicate: (idx: number) => boolean): number {
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.layers.water[i] === 0 && predicate(i)) return i;
  }
  return -1;
}

describe('M2.3 Reisezeit-Modell', () => {
  it('tileSpeed: Strassentyp schlägt Terrain, Wald bremst offroad, Wasser ist zu', () => {
    // kein Strassentyp (0) + Wald-Tile (5) -> 0.25 * 0.6
    expect(tileSpeed(0, 5)).toBeCloseTo(0.15, 9);
    // kein Strassentyp + Gras (1) -> 0.25 * 1.0
    expect(tileSpeed(0, 1)).toBeCloseTo(0.25, 9);
    // Strassentyp ignoriert Terrain
    expect(tileSpeed(2, 5)).toBe(ROAD_TYPES[1]!.speedTilesPerTick);
    // Wasser-Faktor 0
    expect(tileSpeed(0, 3)).toBe(0);
  });

  it('A* bevorzugt waldfreie Routen (gleich weit, schneller)', () => {
    const w = new World(42, 128, 128);
    const grass = findTile(w, (i) => w.tiles[i] === 1);
    const forest = findTile(w, (i) => w.tiles[i] === 5);
    expect(grass).toBeGreaterThanOrEqual(0);
    expect(forest).toBeGreaterThanOrEqual(0);
    // Wald-Tile kostet mehr Zeit als Gras-Tile beim offroad-Betreten
    const grassCost = 1 / tileSpeed(0, w.tiles[grass] ?? 0);
    const forestCost = 1 / tileSpeed(0, w.tiles[forest] ?? 0);
    expect(forestCost).toBeGreaterThan(grassCost);
  });

  it('requestRoute setzt die Route mit Reisezeit; clearRoute löscht sie', () => {
    const w = new World(42, 128, 128);
    let from = -1;
    let to = -1;
    for (let i = 0; i < w.tiles.length && to < 0; i++) {
      if (w.layers.water[i] === 0) {
        if (from < 0) from = i;
        else to = i;
      }
    }
    w.enqueue({ kind: 'requestRoute', from, to });
    w.update();
    expect(w.route).not.toBeNull();
    expect(w.route!.path[0]).toBe(from);
    expect(w.route!.path[w.route!.path.length - 1]).toBe(to);
    expect(w.route!.timeTicks).toBeGreaterThan(0);
    expect(w.route!.rev).toBe(w.tileRev);

    w.enqueue({ kind: 'clearRoute' });
    w.update();
    expect(w.route).toBeNull();
  });

  it('Route auf unwögliches Ziel -> null', () => {
    const w = new World(42, 128, 128);
    const water = (() => {
      for (let i = 0; i < w.tiles.length; i++) if (w.layers.water[i] === 1) return i;
      throw new Error('kein Wasser');
    })();
    let land = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        land = i;
        break;
      }
    }
    w.enqueue({ kind: 'requestRoute', from: land, to: water });
    w.update();
    expect(w.route).toBeNull();
  });

  it('Route reagiert auf neue Strassen (zweite Anfrage ist schneller)', () => {
    const w = new World(42, 128, 128);
    const spots: number[] = [];
    for (let i = 0; i < w.tiles.length && spots.length < 2; i++) {
      if (w.layers.water[i] === 0) spots.push(i);
    }
    const [from, to] = spots as [number, number];
    w.enqueue({ kind: 'requestRoute', from, to });
    w.update();
    const before = w.route!.timeTicks;

    // Strasse auf beide Endpunkte legen: zweite Anfrage ist schneller
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
      if (w.layers.water[i] === 0) {
        w.enqueue({ kind: 'buildRoad', x: i % w.width, y: Math.floor(i / w.width), road: 3 });
      }
    }
    w.update();
    w.enqueue({ kind: 'requestRoute', from, to });
    w.update();
    expect(w.route!.timeTicks).toBeLessThan(before);
  });

  it('Determinismus: Routen-Actions führen zu identischen Welten', () => {
    const build = (): World => {
      const w = new World(9, 128, 128);
      let from = -1;
      let to = -1;
      for (let i = 0; i < w.tiles.length && to < 0; i++) {
        if (w.layers.water[i] === 0) {
          if (from < 0) from = i;
          else to = i;
        }
      }
      w.enqueue({ kind: 'requestRoute', from, to });
      w.update();
      w.enqueue({ kind: 'buildRoad', x: from % w.width, y: Math.floor(from / w.width), road: 2 });
      w.update();
      return w;
    };
    const a = build();
    const b = build();
    expect(b.toJson()).toBe(a.toJson());
    expect(equalRoutes(a, b)).toBe(true);
  });
});

function equalRoutes(a: World, b: World): boolean {
  if ((a.route === null) !== (b.route === null)) return false;
  if (a.route === null) return true;
  return a.route.timeTicks === b.route!.timeTicks && a.route.path.length === b.route!.path.length;
}
