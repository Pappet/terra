import { describe, expect, it } from 'vitest';
import { PathFinder, findPath, type PathfindingContext } from './pathfinding';
import { ROAD_TYPES } from '../data/roads';

/** Handgebaute Mini-Welt: 0=Land, 1=Wasser, sonst Strassentyp auf roads. */
function ctx(
  width: number,
  height: number,
  cells: string,
  rev = 0,
): PathfindingContext {
  const size = width * height;
  const water = new Uint8Array(size);
  const roads = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const c = cells[i];
    if (c === '~') water[i] = 1;
    else if (c !== undefined && c !== '.') roads[i] = Number(c);
  }
  return { width, height, water, roads, rev };
}

const R = ROAD_TYPES[1]!; // Strasse, speed 1.0

describe('findPath (A*)', () => {
  it('gerade Linie über freies Land, Endpunkte korrekt', () => {
    const c = ctx(5, 3, '.....', +0 | 0);
    const result = findPath(c, 0, 4);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toBe(0);
    expect(result!.path[result!.path.length - 1]).toBe(4);
    // Zeit = 4 Schritte offroad à 1/0.25 = 16
    expect(result!.timeTicks).toBeCloseTo(16, 9);
  });

  it('Start = Ziel liefert Pfad der Länge 1 und Zeit 0', () => {
    const c = ctx(3, 3, '.........');
    const result = findPath(c, 4, 4);
    expect(result!.path).toEqual([4]);
    expect(result!.timeTicks).toBe(0);
  });

  it('unüberwindbares Wasser -> null bzw. leerer Pfad', () => {
    // volle Wasserwand über alle drei Zeilen
    const c = ctx(5, 3, '..~..'.repeat(3), 0);
    const result = findPath(c, 0, 4);
    expect(result).not.toBeNull();
    expect(result!.path.length).toBe(0);
  });

  it('Start oder Ziel im Wasser ist unpassierbar', () => {
    const c = ctx(3, 3, '~~~......');
    expect(findPath(c, 0, 5)!.path.length).toBe(0);
  });

  it('A* wählt die Strassenroute (gleich lang, schneller)', () => {
    // 1x7-Korridor: alles Land, aber Felder 1..5 sind Strasse (Typ 2 = "1")
    const c = ctx(7, 1, '.22222.', 0);
    const result = findPath(c, 0, 6);
    // 5 Strassentiles à 1/1.0 = 1, 1 offroad-Ziel à 1/0.25 = 4
    expect(result!.timeTicks).toBeCloseTo(5 * (1 / R.speedTilesPerTick) + 4, 9);
    expect(result!.path.length).toBe(7); // durch den Korridor
  });

  it('A* umgeht Wasser über den kürzesten Landweg', () => {
    // Zeile 0: . ~ . . . | Zeile 1: . ~ . ~ . | Zeile 2: . . . ~ .
    const c2 = ctx(5, 3, '.~...'.concat('.~.~.', '...~.'), 0);
    const result = findPath(c2, 0, 4);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toBe(0);
    expect(result!.path[result!.path.length - 1]).toBe(4);
    for (const idx of result!.path) {
      expect(c2.water[idx]).toBe(0);
    }
  });

  it('ist deterministisch: zweimal derselbe Aufruf, identischer Pfad', () => {
    const c = ctx(9, 5, '...~~.~..'.repeat(5), 0);
    const a = findPath(c, 0, 44);
    const b = findPath(c, 0, 44);
    expect(a).not.toBeNull();
    expect(b!.path).toEqual(a!.path);
    expect(b!.timeTicks).toBe(a!.timeTicks);
  });
});

describe('PathFinder-Cache', () => {
  it('zweiter identischer Call kommt aus dem Cache (visited 0)', () => {
    const pf = new PathFinder();
    const c = ctx(5, 5, '.................', 7);
    const first = pf.findPath(c, 0, 24);
    expect(first!.visited).toBeGreaterThan(0);
    const second = pf.findPath(c, 0, 24);
    expect(second!.visited).toBe(0);
    expect(second!.path).toEqual(first!.path);
  });

  it('rev-Sprung invalidiert den Cache und berechnet neu', () => {
    const pf = new PathFinder();
    const water = new Uint8Array(25);
    const roads = new Uint8Array(25);
    const c1: PathfindingContext = { width: 5, height: 5, water, roads, rev: 1 };
    const first = pf.findPath(c1, 0, 24);
    expect(first!.visited).toBeGreaterThan(0);

    const c1Again: PathfindingContext = { width: 5, height: 5, water, roads, rev: 1 };
    expect(pf.findPath(c1Again, 0, 24)!.visited).toBe(0);

    // Neue Strasse -> neue rev -> Neuverbuchung mit anderem Ergebnis (schneller)
    roads.fill(R.id);
    const c2: PathfindingContext = { width: 5, height: 5, water, roads, rev: 2 };
    const recomputed = pf.findPath(c2, 0, 24);
    expect(recomputed!.visited).toBeGreaterThan(0);
    expect(recomputed!.timeTicks).toBeLessThan(first!.timeTicks);
  });

  it('Cache-Wiederverwendung liefert bei geänderten Daten KEINE alten Ergebnisse', () => {
    const pf = new PathFinder();
    const water = new Uint8Array(25);
    const roads = new Uint8Array(25);
    const c1: PathfindingContext = { width: 5, height: 5, water, roads, rev: 1 };
    const slow = pf.findPath(c1, 0, 24)!;
    roads.fill(R.id);
    const c2: PathfindingContext = { width: 5, height: 5, water, roads, rev: 2 };
    const fast = pf.findPath(c2, 0, 24)!;
    expect(fast.timeTicks).toBeLessThan(slow.timeTicks);
  });
});
