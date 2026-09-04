import { describe, expect, it } from 'vitest';
import { Storage } from './storage';
import { GOOD_COUNT, GOODS } from '../data/goods';
import { RECIPES } from '../data/goods';
import { World, equalWorlds } from './world';

describe('Güter/Rezepte (M5.1)', () => {
  it('GOOD-IDs sind kontiguierlich und Deckel passt', () => {
    GOODS.forEach((g, i) => expect(g.id).toBe(i));
    expect(GOOD_COUNT).toBe(GOODS.length);
  });

  it('Rezept-Inputs verweisen auf existierende Güter; I-Rezepte bilden eine Kette', () => {
    for (const recipe of RECIPES) {
      for (const input of recipe.input) {
        expect(input.good).toBeLessThan(GOOD_COUNT);
        expect(input.amount).toBeGreaterThan(0);
      }
      expect(recipe.output.good).toBeLessThan(GOOD_COUNT);
      // Reine Konsumenten (z.B. Markt) dürfen Output 0 haben
      expect(recipe.output.amount).toBeGreaterThanOrEqual(0);
    }
    // Kette: Holz (Rohstoff) -> Bretter (Sägewerk) -> Werkzeug (Werkstatt braucht Bretter+Erz)
    const saw = RECIPES.find((r) => r.name === 'Sägewerk')!;
    expect(saw.input[0]!.good).toBe(GOODS.findIndex((g) => g.name === 'Holz'));
    const tool = RECIPES.find((r) => r.name === 'Werkstatt')!;
    expect(tool.input.some((i) => i.good === saw.output.good)).toBe(true);
  });
});

describe('Storage', () => {
  it('add/take: take liefert nur den Bestand, Bestand bleibt >= 0', () => {
    const s = new Storage();
    s.ensureCity(1);
    s.add(1, 1, 5);
    expect(s.amount(1, 1)).toBe(5);
    expect(s.take(1, 1, 3)).toBe(3);
    expect(s.amount(1, 1)).toBe(2);
    expect(s.take(1, 1, 10)).toBe(2);
    expect(s.amount(1, 1)).toBe(0);
    expect(s.amount(9, 1)).toBe(0); // unbekannte Stadt
  });

  it('Roundtrip über das Savegame (v7)', () => {
    const w = new World(42, 128, 128);
    let spot = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        spot = i;
        break;
      }
    }
    w.enqueue({ kind: 'foundCity', x: spot % w.width, y: Math.floor(spot / w.width), name: 'Aurelia' });
    w.update();
    w.storage.add(1, 0, 12.5);
    w.storage.add(1, 5, 3.25);
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.storage.amount(1, 0)).toBeCloseTo(12.5, 12);
    expect(restored.storage.amount(1, 5)).toBeCloseTo(3.25, 12);
  });

  it('deserialize lehnt kaputte Vektoren ab', () => {
    expect(() => Storage.deserialize([[1, 2]])).toThrow(/Länge/);
    expect(() => Storage.deserialize([[...new Array(GOOD_COUNT - 1).fill(0), -1]])).toThrow(/Lagerwert/);
    expect(() => Storage.deserialize('kaputt')).toThrow(/Array/);
  });
});
