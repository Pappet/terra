/**
 * M1-Gesamtnachweis: Die ganze Welt (alle Layer, Spielgrösse 512x512) ist
 * reine Funktion des Seeds, Savegame-Roundtrip hält, und die Generierung
 * bleibt im Zeitbudget (Einmalkosten beim Boot/Laden).
 */
import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';

const SIZE = 512;

describe('M1-Reproduzierbarkeit (512x512, alle Layer)', () => {
  it('gleicher Seed -> identische Welt über alle Layer', () => {
    const a = new World(0xc0ffee, SIZE, SIZE);
    const b = new World(0xc0ffee, SIZE, SIZE);
    expect(equalWorlds(a, b)).toBe(true);
  });

  it('unterschiedlicher Seed -> unterschiedliche Welt', () => {
    const a = new World(1, SIZE, SIZE);
    const b = new World(2, SIZE, SIZE);
    expect(equalWorlds(a, b)).toBe(false);
  });

  it('Savegame-Roundtrip der vollen Welt ist identitätsgetreu', () => {
    const a = new World(0xc0ffee, SIZE, SIZE);
    a.enqueue({ kind: 'paintTile', x: 256, y: 256, tile: 4 });
    a.update();
    const restored = World.fromJson(a.toJson());
    expect(equalWorlds(a, restored)).toBe(true);
  });

  it('Zeitbudget: Weltgenerierung 512x512 unter 4 s, Savegame-JSON unter 2 s', () => {
    const t0 = performance.now();
    const world = new World(0xc0ffee, SIZE, SIZE);
    const genMs = performance.now() - t0;
    expect(genMs).toBeLessThan(4000);

    const t1 = performance.now();
    const json = world.toJson();
    World.fromJson(json);
    const saveMs = performance.now() - t1;
    expect(saveMs).toBeLessThan(2000);
  });

  it('alle Layer sind vollständig gefüllt (keine undefinierten Regionen)', () => {
    const world = new World(0xc0ffee, SIZE, SIZE);
    const layers = [
      world.tiles,
      world.layers.elevation,
      world.layers.water,
      world.layers.river,
      world.layers.fertility,
      world.layers.forest,
      world.layers.deposits,
    ];
    for (const layer of layers) {
      expect(layer.length).toBe(SIZE * SIZE);
    }
    // Wasser- und Landanteile in lebensfähigen Bereichen
    let water = 0;
    for (let i = 0; i < world.layers.water.length; i++) water += world.layers.water[i] ?? 0;
    const fraction = water / (SIZE * SIZE);
    expect(fraction).toBeGreaterThan(0.15);
    expect(fraction).toBeLessThan(0.8);
  });
});
