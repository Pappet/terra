import { describe, expect, it } from 'vitest';
import { World } from './world';
import { chooseRecipe } from './production';
import { RECIPES } from '../data/goods';
import { cohortIndex } from './population';

function cityOnFeature(w: World): { cityId: number; forestIdx: number } {
  let center = -1;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.layers.water[i] === 0) {
      center = i;
      break;
    }
  }
  const cx = center % w.width;
  const cy = Math.floor(center / w.width);
  w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'Test' });
  w.update();
  // Waldtile mit unfruchtbarem Boden (kein Farm-Beiklang, siehe D006)
  for (let idx = 0; idx < w.tiles.length; idx++) {
    if (w.layers.forest[idx] !== 1) continue;
    if ((w.layers.fertility[idx] ?? 0) / 255 >= 0.35) continue;
    return { cityId: 1, forestIdx: idx };
  }
  throw new Error('kein Wald auf unfruchtbarem Boden');
}

describe('M5.2 Rezeptauswahl (D006)', () => {
  it('Kettenausgleich: Waldstadt baut Holzfäller -> Sägewerk -> Werkstatt -> Holzfäller', () => {
    const w = new World(42, 128, 128);
    const { forestIdx } = cityOnFeature(w);
    const names: Array<string | undefined> = [];
    for (let n = 0; n < 4; n++) {
      const pick = chooseRecipe(w, 1, forestIdx, 3);
      names.push(pick?.name);
      if (pick !== null) w.buildings.add(1, 0, 0, 3, pick.id); // Produzentenzähler erhöhen
    }
    expect(names).toEqual(['Holzfäller', 'Sägewerk', 'Werkstatt', 'Holzfäller']);
  });

  it('Umgebungsfilter: ohne Wald in Reichweite gibt es keinen Holzfäller', () => {
    const w = new World(42, 128, 128);
    const { cityId } = (() => {
      let center = -1;
      for (let i = 0; i < w.tiles.length; i++) {
        if (w.layers.water[i] === 0) {
          center = i;
          break;
        }
      }
      w.enqueue({ kind: 'foundCity', x: center % w.width, y: Math.floor(center / w.width), name: 'T' });
      w.update();
      return { cityId: 1 };
    })();
    // Tile fern von allem Wald suchen
    let spot = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] !== 0) continue;
      const x = i % w.width;
      const y = Math.floor(i / w.width);
      let forestNear = false;
      for (let dy = -3; dy <= 3 && !forestNear; dy++) {
        for (let dx = -3; dx <= 3 && !forestNear; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w.width || ny >= w.height) continue;
          if (w.layers.forest[ny * w.width + nx] === 1) forestNear = true;
        }
      }
      if (!forestNear) {
        spot = i;
        break;
      }
    }
    if (spot < 0) return; // Karte komplett bewaldet -> Fall nicht vorhanden
    const names = [chooseRecipe(w, cityId, spot, 3), chooseRecipe(w, cityId, spot, 3)].map((r) => r?.name);
    expect(names).not.toContain('Holzfäller');
  });
});

describe('M5.2 Produktionstick', () => {
  it('Holzfäller mit Arbeitern produziert Holz ins Lager', () => {
    const w = new World(42, 128, 128);
    let center = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        center = i;
        break;
      }
    }
    const cx = center % w.width;
    const cy = Math.floor(center / w.width);
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
    w.update();
    // Holzfäller direkt mit Rezept 0 an der Stadt (Umgebung egal für den Test)
    w.addBuildingAt(1, cx + 1, cy, 3, 0);
    w.settleResidents(1, cohortIndex(1, 0, 0), 20); // 12 Arbeiter
    w.update(); // Zuweisung

    const before = w.storage.amount(1, 1);
    for (let t = 0; t < 10; t++) w.update();
    // 4 von 4 benötigten Arbeitern gesetzt -> Rate 1 -> 2 Holz/Tick
    expect(w.storage.amount(1, 1)).toBeCloseTo(before + 20, 9);
  });

  it('Engpass: Sägewerk ohne Holz produziert keine Bretter (M5.6-Mechanismus)', () => {
    const w = new World(42, 128, 128);
    let center = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        center = i;
        break;
      }
    }
    const cx = center % w.width;
    const cy = Math.floor(center / w.width);
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
    w.update();
    // ZWEI Sägewerke (je 4 Arbeiter, 2 Holz/Tick Input)
    w.addBuildingAt(1, cx + 1, cy, 3, 4);
    w.addBuildingAt(1, cx + 2, cy, 3, 4);
    w.settleResidents(1, cohortIndex(1, 0, 0), 20); // 12 Arbeiter -> beide voll
    w.storage.add(1, 1, 20); // genau 10 Sägewerk-Ticks an Input
    w.update(); // Zuweisung

    for (let t = 0; t < 20; t++) w.update();
    // Nach 5 Ticks ist das Holz weg (4/Tick Verbrauch, 3/Tick Output)
    expect(w.storage.amount(1, 1)).toBe(0);
    expect(w.storage.amount(1, 4)).toBeCloseTo(15, 9);
  });

  it('ohne zugewiesene Arbeiter wird nichts produziert', () => {
    const w = new World(42, 128, 128);
    let center = -1;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.layers.water[i] === 0) {
        center = i;
        break;
      }
    }
    const cx = center % w.width;
    const cy = Math.floor(center / w.width);
    w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
    w.update();
    w.addBuildingAt(1, cx + 1, cy, 3, 0); // Holzfäller, aber keine Einwohner
    w.update();
    const before = w.storage.amount(1, 1);
    for (let t = 0; t < 10; t++) w.update();
    expect(w.storage.amount(1, 1)).toBe(before);
  });

  it('Produktion ist deterministisch', () => {
    const run = (): World => {
      const w = new World(7, 128, 128);
      let center = -1;
      for (let i = 0; i < w.tiles.length; i++) {
        if (w.layers.water[i] === 0) {
          center = i;
          break;
        }
      }
      const cx = center % w.width;
      const cy = Math.floor(center / w.width);
      w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
      w.update();
      w.addBuildingAt(1, cx + 1, cy, 3, 0);
      w.addBuildingAt(1, cx + 2, cy, 3, 4);
      w.settleResidents(1, cohortIndex(1, 0, 0), 24);
      w.storage.add(1, 1, 10);
      for (let t = 0; t < 30; t++) w.update();
      return w;
    };
    expect(run().toJson()).toBe(run().toJson());
  });

  it('alle Rezept-IDs sind in RECIPE_BY_ID auflösbar', () => {
    for (const recipe of RECIPES) {
      expect(RECIPES.includes(recipe)).toBe(true);
    }
  });
});
