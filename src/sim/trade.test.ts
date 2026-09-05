import { describe, expect, it } from 'vitest';
import { World } from './world';
import { exportBalance, importBalance } from './trade';
import { GOODS } from '../data/goods';
import { lineWorld, addAdults } from '../../tests/fakes';
import { cohortIndex } from './population';

const WOOD = 1; // Holz

describe('M6 Handel', () => {
  it('Preisdifferenz erzeugt Handel: Überschuss wandert zum teuren Lager', () => {
    // Stadt A produziert Holz (Holzfäller), Stadt B verbraucht nichts ->
    // A-Preis fällt auf Klemme, B-Preis bleibt auf Basis -> Arbitrage.
    const w = lineWorld({ width: 9, roadType: 2, production: true });
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    w.buildings.add(1, 1, 0, 3, 0); // Holzfäller in A
    addAdults(w, 1, 10); // Arbeiter für den Holzfäller
    w.update();

    const before = w.storage.amount(2, WOOD);
    for (let t = 0; t < 100; t++) w.update();
    expect(w.storage.amount(2, WOOD)).toBeGreaterThan(before); // Holz geflossen
    expect(exportBalance(w, 1)).toBeGreaterThan(0);
    expect(importBalance(w, 2)).toBeGreaterThan(0);
  });

  it('ohne Preisdifferenz wird nicht gehandelt', () => {
    const w = lineWorld({ width: 9, roadType: 2, production: true });
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    // Beide Lager identisch befüllt -> Preise identisch, keine Marge
    for (const c of [1, 2]) {
      for (const g of GOODS) w.storage.add(c, g.id, 20);
    }
    w.update();
    const exportsBefore = exportBalance(w, 1);
    for (let t = 0; t < 50; t++) w.update();
    expect(exportBalance(w, 1)).toBe(exportsBefore); // kein Handel
  });

  it('Korridorkapazität deckelt die Summe der Güter (Verstopfung)', () => {
    // Pfad (Kapazität 10): zwei Güter mit Marge teilen sich den Korridor
    const w = lineWorld({ width: 9, roadType: 1, production: true });
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    // A voller Holz und Stein, B leer -> Preise in B hoch, A niedrig
    w.storage.add(1, WOOD, 100);
    w.storage.add(1, 2, 100);
    // Preise konvergieren lassen (A fällt Richtung Klemme, B steigt)
    for (let t = 0; t < 60; t++) w.update();
    // B entleeren: Absorptionskapazität maximal
    for (const s of [1, 2]) {
      w.storage.take(2, s, w.storage.amount(2, s));
    }

    // 40 Ticks beobachten: Wann immer Güter fließen, gilt die Korridorkapazität 10
    let activeTicks = 0;
    let maxSum = 0;
    for (let t = 0; t < 40; t++) {
      w.update();
      let sum = 0;
      for (let g = 0; g < GOODS.length; g++) sum += w.trade.flows[0]![1]![g] ?? 0;
      if (sum > 0) {
        activeTicks++;
        maxSum = Math.max(maxSum, sum);
      }
    }
    expect(activeTicks).toBeGreaterThan(0);
    expect(maxSum).toBeLessThanOrEqual(10);
    expect(exportBalance(w, 1)).toBeGreaterThan(0);
  });

  it('Wasser trennt: kein Handel', () => {
    const w = lineWorld({ width: 9, roadType: 2, waterColumns: [1, 2, 3, 5, 6, 7], production: true });
    w.cities.found('A', 0, 0, 0);
    w.cities.found('B', 8, 0, 0);
    w.population.ensureCity(1);
    w.population.ensureCity(2);
    w.storage.add(1, WOOD, 100);
    w.update();
    for (let t = 0; t < 20; t++) w.update();
    expect(exportBalance(w, 1)).toBe(0);
  });

  it('Handelsbilanzen überleben das Savegame (v9)', () => {
    // Echte Welt: Geographie egal — es geht nur um die Persistenz der Bilanzen.
    const w = new World(42, 128, 128);
    let first = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        first = i;
        break;
      }
    }
    w.enqueue({ kind: 'foundCity', x: first % w.width, y: Math.floor(first / w.width), name: 'A' });
    w.update();
    w.trade.exports[0]![WOOD] = 55;
    w.trade.imports[0]![WOOD] = 12;
    const restored = World.fromJson(w.toJson());
    expect(exportBalance(restored, 1)).toBe(55);
    expect(importBalance(restored, 1)).toBe(12);
  });

  it('Handel ist deterministisch', () => {
    const run = (): World => {
      const w = lineWorld({ width: 9, roadType: 2, production: true });
      w.cities.found('A', 0, 0, 0);
      w.cities.found('B', 8, 0, 0);
      w.population.ensureCity(1);
      w.population.ensureCity(2);
      w.buildings.add(1, 1, 0, 3, 0);
      addAdults(w, 1, 10);
      w.population.add(1, cohortIndex(1, 1, 1), 5);
      for (let t = 0; t < 80; t++) w.update();
      return w;
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a.trade.exports.map((v) => Array.from(v)))).toBe(
      JSON.stringify(b.trade.exports.map((v) => Array.from(v))),
    );
    expect(JSON.stringify(a.storage.serialize())).toBe(JSON.stringify(b.storage.serialize()));
  });
});
