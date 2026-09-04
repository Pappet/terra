import { describe, expect, it } from 'vitest';
import { Cities } from './cities';
import { World, equalWorlds } from './world';
import { CITIES } from '../data/cities';

function firstLand(w: World): { x: number; y: number } {
  for (let i = 0; i < w.layers.water.length; i++) {
    if (w.layers.water[i] === 0) return { x: i % w.width, y: Math.floor(i / w.width) };
  }
  throw new Error('kein Land');
}

function farLand(w: World, minDistance: number): { x: number; y: number } {
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.layers.water[i] !== 0) continue;
    const x = i % w.width;
    const y = Math.floor(i / w.width);
    if (w.cities.distanceToNearest(x, y) >= minDistance) return { x, y };
  }
  throw new Error('kein entferntes Land');
}

function waterTile(w: World): { x: number; y: number } {
  for (let i = 0; i < w.layers.water.length; i++) {
    if (w.layers.water[i] === 1) return { x: i % w.width, y: Math.floor(i / w.width) };
  }
  throw new Error('kein Wasser');
}

describe('M3.1 Städte', () => {
  it('neue Welt hat keine Stadt', () => {
    const w = new World(42, 128, 128);
    expect(w.cities.count).toBe(0);
  });

  it('foundCity auf Land gründet mit ID >= 1, Name und Tick', () => {
    const w = new World(42, 128, 128);
    const spot = firstLand(w);
    w.enqueue({ kind: 'foundCity', x: spot.x, y: spot.y, name: 'Aurelia' });
    w.update();
    expect(w.cities.count).toBe(1);
    expect(w.cities.names[0]).toBe('Aurelia');
    expect(w.cities.x[0]).toBe(spot.x);
    expect(w.cities.y[0]).toBe(spot.y);
    expect(w.cities.founded[0]).toBe(1);
  });

  it('Gründung auf Wasser wird abgelehnt', () => {
    const w = new World(42, 128, 128);
    const spot = waterTile(w);
    w.enqueue({ kind: 'foundCity', x: spot.x, y: spot.y, name: 'Nasse' });
    w.update();
    expect(w.cities.count).toBe(0);
    expect(w.lastRejected).toMatch(/Land/);
  });

  it('Mindestabstand zu bestehenden Städten wird erzwungen', () => {
    const w = new World(42, 128, 128);
    const spot = firstLand(w);
    w.enqueue({ kind: 'foundCity', x: spot.x, y: spot.y, name: 'Erste' });
    w.update();
    // Zwei Tiles daneben ist zu nah
    w.enqueue({ kind: 'foundCity', x: Math.min(w.width - 1, spot.x + 2), y: spot.y, name: 'Zweite' });
    w.update();
    expect(w.cities.count).toBe(1);
    expect(w.lastRejected).toMatch(/Zu nah/);

    // Ausreichender Abstand klappt
    const far = farLand(w, CITIES.minFoundingDistance);
    w.enqueue({ kind: 'foundCity', x: far.x, y: far.y, name: 'Dritte' });
    w.update();
    expect(w.cities.count).toBe(2);
  });

  it('Städte überleben den Savegame-Roundtrip', () => {
    const w = new World(42, 128, 128);
    const spot = firstLand(w);
    w.enqueue({ kind: 'foundCity', x: spot.x, y: spot.y, name: 'Aurelia' });
    w.update();
    const far = farLand(w, CITIES.minFoundingDistance);
    w.enqueue({ kind: 'foundCity', x: far.x, y: far.y, name: 'Borealis' });
    w.update();
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.cities.names).toEqual(['Aurelia', 'Borealis']);
  });

  it('Cities.deserialize lehnt kaputte Savegames ab', () => {
    expect(() => {
      Cities.deserialize({ count: 2, names: ['nur eins'], x: [0, 0], y: [0, 0], founded: [0, 0] });
    }).toThrow(/names/);
    expect(() => {
      Cities.deserialize({ count: 1, names: 'kaputt', x: [0], y: [0], founded: [0] });
    }).toThrow(/names/);
  });

  it('Determinismus: Gründungsliste führt zu identischen Welten', () => {
    const build = (): World => {
      const w = new World(9, 128, 128);
      let placed = 0;
      for (let i = 0; i < w.tiles.length && placed < 3; i++) {
        if (w.layers.water[i] === 0) {
          const x = i % w.width;
          const y = Math.floor(i / w.width);
          if (w.cities.distanceToNearest(x, y) >= CITIES.minFoundingDistance) {
            w.enqueue({ kind: 'foundCity', x, y, name: `Stadt ${placed + 1}` });
            placed++;
            w.update();
          }
        }
      }
      return w;
    };
    expect(build().toJson()).toBe(build().toJson());
  });
});
