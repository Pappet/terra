import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';
import { assignWorkers, EMPLOYMENT, jobsOf } from './employment';
import { GROWTH } from '../data/cities';
import { cohortIndex } from './population';
import { Buildings } from './buildings';
import { Cities } from './cities';
import { PathFinder } from './pathfinding';
import { Population } from './population';

function firstLand(w: World): { x: number; y: number } {
  for (let i = 0; i < w.layers.water.length; i++) {
    if (w.layers.water[i] === 0) return { x: i % w.width, y: Math.floor(i / w.width) };
  }
  throw new Error('kein Land');
}

/**
 * Handgebaute 1-Zeilen-Welt für Assignment-Tests: '~' = Wasser, sonst Land.
 * Städte werden direkt in die SoA-Strukturen gesetzt (ohne Gründungs-Abstandsregel).
 */
function lineWorld(cells: string, roadType = 0): World {
  const width = cells.length;
  const water = new Uint8Array(width);
  const roads = new Uint8Array(width);
  const tiles = new Uint8Array(width).fill(1);
  for (let i = 0; i < width; i++) {
    if (cells[i] === '~') water[i] = 1;
    else if (roadType > 0) roads[i] = roadType;
  }
  return {
    width,
    height: 1,
    tiles,
    water,
    roads,
    layers: { water },
    cities: new Cities(),
    buildings: new Buildings(),
    population: new Population(),
    pathfinder: new PathFinder(),
    tileRev: 0,
  } as unknown as World;
}

function addAdults(w: World, cityId: number, count: number): void {
  w.population.ensureCity(cityId);
  w.population.add(cityId, cohortIndex(1, 0, 0), count);
}

describe('M4.3 Arbeitsplätze', () => {
  it('Jobs stammen aus C+I-Gebäuden mit Substanz', () => {
    const w = new World(42, 128, 128);
    const spot = firstLand(w);
    foundCity(w, spot.x, spot.y, 'A');
    w.addBuildingAt(1, spot.x + 1, spot.y, 2); // Gewerbe
    w.addBuildingAt(1, spot.x + 2, spot.y, 3); // Industrie
    w.addBuildingAt(1, spot.x + 3, spot.y, 1); // Wohnen: kein Job
    expect(jobsOf(w, 1)).toBe(2 * GROWTH.jobsPerBuilding);
  });

  it('eine Stadt weist ihre Erwerbstätigen auf eigene Jobs zu', () => {
    const w = new World(42, 128, 128);
    const spot = firstLand(w);
    foundCity(w, spot.x, spot.y, 'A');
    w.addBuildingAt(1, spot.x + 1, spot.y, 2); // 4 Jobs
    // 10 Erwerbsfähige
    w.population.add(1, cohortIndex(1, 0, 0), 6);
    w.population.add(1, cohortIndex(2, 1, 1), 4);
    w.commute = assignWorkers(w);
    const workforce = 10 * EMPLOYMENT.participationRate;
    expect(w.commute!.flows[0]![0]).toBeCloseTo(Math.min(4, workforce), 9);
    expect(w.commute!.employed[0]).toBeCloseTo(Math.min(4, workforce), 9);
    expect(w.commute!.unemployed[0]).toBeCloseTo(workforce - 4, 9);
  });

  it('Überzählige Arbeitskräfte bleiben arbeitslos (Jobs erschöpft)', () => {
    const w = new World(42, 128, 128);
    const spot = firstLand(w);
    foundCity(w, spot.x, spot.y, 'A');
    w.population.add(1, cohortIndex(1, 0, 0), 100);
    w.commute = assignWorkers(w);
    expect(w.commute!.employed[0]).toBe(0);
    expect(w.commute!.unemployed[0]).toBeCloseTo(100 * EMPLOYMENT.participationRate, 9);
  });

  it('Pendeln über Stadtgrenzen: Arbeiter füllen die Jobs der verbundenen Nachbarstadt', () => {
    // 9 Tiles: A bei 0, B bei 8, alles Land verbunden
    const w = lineWorld('A.......B', 2); // Strasse (Kapazität 40)
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    w.buildings.add(2, 8, 0, 2); // 4 Jobs in B
    addAdults(w, 1, 20); // 12 Erwerbstätige in A, keine in B

    const result = assignWorkers(w);
    expect(result.flows[0]![1]).toBe(GROWTH.jobsPerBuilding);
    expect(result.employed[0]).toBe(GROWTH.jobsPerBuilding);
    expect(result.openJobs[1]).toBe(0);
  });

  it('Wasser trennt: keine Pendler, niemand beschäftigt', () => {
    // vollaufende Wasserwand zwischen A und B
    const w = lineWorld('A~~~.~~~B');
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    w.buildings.add(2, 8, 0, 2); // 4 Jobs in B
    addAdults(w, 1, 20);

    const result = assignWorkers(w);
    expect(result.flows[0]![1]).toBe(0);
    expect(result.employed[0]).toBe(0);
    expect(result.unemployed[0]).toBeCloseTo(20 * EMPLOYMENT.participationRate, 9);
  });

  it('kürzere Reisezeit gewinnt bei Konkurrenz um Jobs', () => {
    // A Mitte, B links (2 Tiles), C rechts (3 Tiles) — beide Jobs, A pendelt zu B zuerst
    const w = lineWorld('B.A..C', 3); // Chaussee (Kapazität 120)
    w.cities.found('A', 2, 0, 0);
    w.cities.found('B', 0, 0, 0);
    w.cities.found('C', 5, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    w.population.ensureCity(3);
    w.buildings.add(2, 0, 0, 2); // 4 Jobs in B (Distanz 2)
    w.buildings.add(3, 5, 0, 2); // 4 Jobs in C (Distanz 3)
    addAdults(w, 1, 4); // 2.4 Erwerbstätige

    const result = assignWorkers(w);
    // Alle gehen nach B (näher); C bleibt unbedient
    expect(result.flows[0]![1]).toBeCloseTo(2.4, 9);
    expect(result.flows[0]![2]).toBe(0);
  });

  it('Stau/Kapazität: Korridor deckelt den Pendlerfluss, Überlauf bleibt arbeitslos', () => {
    // Pfad (Kapazität 10), 80 Jobs in B, 200 Erwachsene in A -> 120 Erwerbstätige
    const w = lineWorld('A.......B', 1);
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    for (let b = 0; b < 20; b++) w.buildings.add(2, 8, 0, 2); // 80 Jobs
    addAdults(w, 1, 200);

    const result = assignWorkers(w);
    expect(result.flows[0]![1]).toBe(10); // Korridorkapazität Pfad
    expect(result.openJobs[1]).toBe(70);
    expect(result.employed[0]).toBe(10);
    expect(result.unemployed[0]).toBeCloseTo(110, 9);
  });

  it('bessere Strasse erhöht die Korridorkapazität (Reaktivität)', () => {
    const build = (roadType: number): number => {
      const w = lineWorld('A.......B', roadType);
      w.cities.found('A', 0, 0, 0);
      w.cities.found('B', 8, 0, 0);
      w.population.ensureCity(1);
      w.population.ensureCity(2);
      for (let b = 0; b < 20; b++) w.buildings.add(2, 8, 0, 2);
      addAdults(w, 1, 200);
      return assignWorkers(w).flows[0]![1] ?? 0;
    };
    const dirt = build(1); // Pfad: Kapazität 10
    const paved = build(3); // Chaussee: Kapazität 120
    expect(paved).toBeGreaterThan(dirt);
    expect(paved).toBe(80); // jetzt joblimitiert statt korridorlimitiert
  });

  it('offroad-Korridor trägt fast nichts (Trampelpfad)', () => {
    const w = lineWorld('A.......B', 0); // keine Strassen
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    for (let b = 0; b < 5; b++) w.buildings.add(2, 8, 0, 2); // 20 Jobs
    addAdults(w, 1, 100);

    const result = assignWorkers(w);
    expect(result.flows[0]![1]).toBe(2); // MOVEMENT.offroadCapacity
  });

  it('Zuweisung ist deterministisch und update-getrieben (Intervall + Strassenwechsel)', () => {
    const build = (): World => {
      const w = new World(9, 128, 128);
      const spot = firstLand(w);
      foundCity(w, spot.x, spot.y, 'A');
      w.addBuildingAt(1, spot.x + 1, spot.y, 2);
      w.population.add(1, cohortIndex(1, 0, 0), 10);
      w.enqueue({ kind: 'buildRoad', x: spot.x + 1, y: spot.y + 1, road: 2 });
      w.update();
      for (let t = 0; t < 210; t++) w.update(); // über das Demografie-Intervall
      return w;
    };
    const a = build();
    const b = build();
    expect(equalWorlds(a, b)).toBe(true);
    expect(a.commute).not.toBeNull();
  });
});

function foundCity(w: World, x: number, y: number, name: string): void {
  w.enqueue({ kind: 'foundCity', x, y, name });
  w.update();
}
