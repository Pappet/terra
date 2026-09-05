import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { World, equalWorlds } from './world';
import { cohortIndex } from './population';

/**
 * M9.1 Golden Master: Regressionsnetz über die ganze Simulation. Fester Seed,
 * feste Aktionsliste, 1200 Ticks (6 Demografie-Intervalle) — Wachstum,
 * Demografie, Produktion, Preise und Handel feuern alle wiederholt. Der
 * Serialisierungs-Hash des Endzustands wird gegen die Referenzdatei
 * golden-master.json verglichen.
 *
 * Regel: Der Hash darf sich nur ändern, wenn eine Task die Verhaltensänderung
 * ausdrücklich verlangt — dann Referenz in eigenem Commit neu erzeugen und im
 * JOURNAL begründen. Mit GOLDEN_WRITE=1 wird die Referenz (neu) geschrieben.
 */

const REFERENCE_PATH = fileURLToPath(new URL('./golden-master.json', import.meta.url));
const GOLDEN_SEED = 1337;
const GOLDEN_TICKS = 1200;

/** FNV-1a 64-bit über den Serialisierungs-JSON (hex, deterministisch). */
export function goldenHash(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/** Erstes Landtile mit Randabstand, ab dem n horizontale Tiles Land sind. */
function landRun(w: World, from: number, n: number): number {
  const m = 16;
  for (let y = m; y < w.height - m; y++) {
    for (let x = m; x < w.width - m - n; x++) {
      const idx = y * w.width + x;
      if (idx < from) continue;
      let ok = true;
      for (let k = 0; k < n && ok; k++) {
        if (w.layers.water[idx + k] !== 0) ok = false;
      }
      if (ok) return idx;
    }
  }
  throw new Error('Golden Master: kein passendes Land');
}

/** Feste, deterministische Szene: drei Städte mit Zonen, Straßen, Produktion. */
export function runGoldenScenario(): World {
  const w = new World(GOLDEN_SEED, 128, 128);
  let searchFrom = 0;
  const centers: number[] = [];
  for (let c = 0; c < 3; c++) {
    const idx = landRun(w, searchFrom, 8);
    centers.push(idx);
    searchFrom = idx + 24; // Mindestabstand zwischen den Städtezentren
    w.enqueue({ kind: 'foundCity', x: idx % w.width, y: Math.floor(idx / w.width), name: `Golden ${c + 1}` });
  }
  w.update();

  for (const [c, idx] of centers.entries()) {
    const cityId = c + 1;
    const cx = idx % w.width;
    const cy = Math.floor(idx / w.width);
    // Straßenzeile + 2 Reihen Zonen (2 R, 1 C, 2 I pro Stadt)
    for (let k = 0; k < 5; k++) w.enqueue({ kind: 'buildRoad', x: cx + k, y: cy + 1, road: k === 4 ? 2 : 2 });
    for (let k = 0; k < 5; k++) {
      const zone = k < 2 ? 1 : k < 3 ? 2 : 3;
      w.enqueue({ kind: 'paintZone', x: cx + k, y: cy, zone });
      w.enqueue({ kind: 'paintZone', x: cx + k, y: cy + 2, zone });
    }
    // Produktion garantiert anwerfen: Farm + Markt + Holzfäller + Sägewerk
    w.addBuildingAt(cityId, cx, cy + 4, 3, 3); // Farm (Rezept prüft Fruchtbarkeit nicht erneut)
    w.addBuildingAt(cityId, cx + 1, cy + 4, 2, 6); // Markt
    w.addBuildingAt(cityId, cx + 2, cy + 4, 3, 0); // Holzfäller
    w.addBuildingAt(cityId, cx + 3, cy + 4, 3, 4); // Sägewerk
    w.addBuildingAt(cityId, cx + 2, cy, 1); // Wohnhaus
    w.settleResidents(cityId, cohortIndex(1, 0, 0), 24);
  }
  w.enqueue({ kind: 'setTaxRate', rate: 0.25 });
  w.update();

  for (let t = 0; t < GOLDEN_TICKS; t++) w.update();
  return w;
}

describe('M9.1 Golden Master', () => {
  it('Endzustand der Golden-Szene ist unverändert (Referenz-Hash)', () => {
    const w = runGoldenScenario();
    const json = w.toJson();
    const hash = goldenHash(json);

    if (process.env.GOLDEN_WRITE === '1') {
      writeFileSync(
        REFERENCE_PATH,
        JSON.stringify(
          { seed: GOLDEN_SEED, ticks: GOLDEN_TICKS, map: '128x128', note: 'M9.1 Golden Master — Referenz nur mit JOURNAL-Begründung neu erzeugen', hash },
          null,
          2,
        ) + '\n',
      );
      console.log(`[golden] Referenz geschrieben: ${hash}`);
      return;
    }

    const reference = JSON.parse(readFileSync(REFERENCE_PATH, 'utf8')) as { hash: string };
    expect(reference.hash).toEqual(hash);
  });

  it('Savegame-Roundtrip des Golden-Endzustands ist identitätsgetreu', () => {
    const w = runGoldenScenario();
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.toJson()).toBe(w.toJson());
  });
});
