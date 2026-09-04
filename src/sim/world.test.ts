import { describe, expect, it } from 'vitest';
import { World, equalWorlds } from './world';

function paintedWorld(): World {
  const w = new World(42, 32, 24);
  w.enqueue({ kind: 'paintTile', x: 1, y: 2, tile: 3 });
  w.enqueue({ kind: 'paintTile', x: 4, y: 5, tile: 4 });
  w.update();
  w.update();
  w.update();
  return w;
}

describe('World – Weltgen-Integration', () => {
  it('Konstruktor erzeugt Layer in voller Grösse, Oberfläche konsistent mit Wasser', () => {
    const w = new World(42, 64, 48);
    expect(w.tiles.length).toBe(64 * 48);
    for (const key of ['elevation', 'water', 'river', 'fertility', 'forest', 'deposits'] as const) {
      expect(w.layers[key].length).toBe(64 * 48);
    }
    for (let i = 0; i < w.tiles.length; i++) {
      const isWaterTile = w.tiles[i] === 3;
      const isWaterLayer = w.layers.water[i] === 1;
      expect(isWaterTile).toBe(isWaterLayer);
    }
  });

  it('Spielgrösse (128er und 512er) hat nennenswert Land', () => {
    for (const [seed, size] of [[42, 128], [42, 512]] as const) {
      const w = new World(seed, size, size);
      let land = 0;
      for (let i = 0; i < w.tiles.length; i++) {
        if (w.layers.water[i] === 0) land++;
      }
      expect(land).toBeGreaterThan(size * size * 0.15);
    }
  });

  it('gleicher Seed -> identische Welt inklusive Layern', () => {
    const a = new World(1234, 48, 48);
    const b = new World(1234, 48, 48);
    expect(equalWorlds(a, b)).toBe(true);
  });

  it('unterschiedliche Seeds -> unterschiedliche Welt', () => {
    const a = new World(1, 48, 48);
    const b = new World(2, 48, 48);
    expect(equalWorlds(a, b)).toBe(false);
  });
});

describe('World – Actions', () => {
  it('Actions greifen zu Beginn des nächsten Ticks, nicht sofort', () => {
    const w = new World(1, 8, 8);
    const before = w.tiles[0];
    w.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 2 });
    expect(w.tiles[0]).toBe(before);
    w.update();
    expect(w.tiles[0]).toBe(2);
    expect(w.tick).toBe(1);
  });

  it('mehrere Actions pro Tick, Reihenfolge bleibt erhalten (letzte gewinnt)', () => {
    const w = new World(1, 8, 8);
    w.enqueue({ kind: 'paintTile', x: 2, y: 1, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 2, y: 1, tile: 3 });
    w.update();
    expect(w.tiles[1 * 8 + 2]).toBe(3);
  });

  it('paintTile ausserhalb der Karte wird still ignoriert', () => {
    const w = new World(1, 8, 8);
    const before = Array.from(w.tiles);
    w.enqueue({ kind: 'paintTile', x: -1, y: 0, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 0, y: 8, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 8, y: 0, tile: 1 });
    w.enqueue({ kind: 'paintTile', x: 1.5, y: 0, tile: 1 });
    expect(() => w.update()).not.toThrow();
    expect(Array.from(w.tiles)).toEqual(before);
  });

  it('paintTile mit unbekanntem Tile-Typ wirft', () => {
    const w = new World(1, 8, 8);
    w.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 99 });
    expect(() => w.update()).toThrow(/Tile-Typ/);
  });

  it('tileRev zählt Änderungen, nicht Ticks', () => {
    const w = new World(1, 8, 8);
    w.update();
    w.update();
    expect(w.tileRev).toBe(0);
    w.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 1 });
    w.update();
    expect(w.tileRev).toBe(1);
    w.update();
    expect(w.tileRev).toBe(1);
  });
});

describe('Savegame-Roundtrip (v2, Layer als base64)', () => {
  it('JSON -> Welt -> JSON ist identitätsgetreu inklusive Layern', () => {
    const w = paintedWorld();
    const restored = World.fromJson(w.toJson());
    expect(equalWorlds(w, restored)).toBe(true);
    expect(restored.toJson()).toBe(w.toJson());
  });

  it('Savegame eines 512er-Worlds bleibt kompakt (< 5 MB JSON)', () => {
    const w = new World(42, 512, 512);
    const json = w.toJson();
    expect(json.length).toBeLessThan(5 * 1024 * 1024);
  });

  it('RNG-Zustand überlebt den Roundtrip', () => {
    const w = paintedWorld();
    const restored = World.fromJson(w.toJson());
    expect(restored.rngStateU32).toBe(w.rngStateU32);
  });

  it('deserialize verlangt die aktuelle Savegame-Version', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    data.saveVersion = 999;
    expect(() => World.deserialize(data)).toThrow(/Version/);
  });

  it('deserialize lehnt v1-Savegames (Zahl-Arrays) klar ab', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    data.saveVersion = 1;
    expect(() => World.deserialize(data)).toThrow(/Version/);
  });

  it('deserialize wirft bei korrupten Layern (falsche Länge, Wertebereich, Bits)', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    const layers = data.layers as Record<string, string>;
    layers.elevation = (layers.elevation ?? '').slice(0, 8);
    expect(() => World.deserialize(data)).toThrow(/layers\.elevation/);

    const data2 = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    // water=2 ist kein gültiger Boolescher Layer-Wert
    const layers2 = data2.layers as Record<string, string>;
    const raw = atobLike(layers2.water ?? '');
    raw[3] = 2;
    layers2.water = btoaLike(raw);
    expect(() => World.deserialize(data2)).toThrow(/water/);

    const data3 = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    const layers3 = data3.layers as Record<string, string>;
    const depRaw = atobLike(layers3.deposits ?? '');
    depRaw[5] = 128; // Bit 7 ist kein definiertes Vorkommen
    layers3.deposits = btoaLike(depRaw);
    expect(() => World.deserialize(data3)).toThrow(/deposits/);
  });

  it('deserialize wirft bei kaputten Skalarfeldern', () => {
    const data = JSON.parse(paintedWorld().toJson()) as Record<string, unknown>;
    data.tick = -5;
    expect(() => World.deserialize(data)).toThrow(/tick/);
  });

  it('equalWorlds erkennt Unterschiede', () => {
    const a = paintedWorld();
    const b = paintedWorld();
    expect(equalWorlds(a, b)).toBe(true);
    b.enqueue({ kind: 'paintTile', x: 0, y: 0, tile: 1 });
    b.update();
    expect(equalWorlds(a, b)).toBe(false);
  });
});

// Test-Helfer: kleine base64-Dekodierung/-kodierung, ohne sim-Module zu bemühen
function atobLike(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const n = b64.replace(/=+$/, '').length;
  const out = new Uint8Array(Math.floor(n * 3 / 4));
  let o = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const c = (cs: string): number => chars.indexOf(cs);
    const b0 = c(b64[i] ?? 'A');
    const b1 = c(b64[i + 1] ?? 'A');
    const b2 = b64[i + 2] === '=' ? 0 : c(b64[i + 2] ?? 'A');
    const b3 = b64[i + 3] === '=' ? 0 : c(b64[i + 3] ?? 'A');
    if (o < out.length) out[o++] = (b0 << 2) | (b1 >> 4);
    if (o < out.length) out[o++] = ((b1 & 15) << 4) | (b2 >> 2);
    if (o < out.length) out[o++] = ((b2 & 3) << 6) | b3;
  }
  return out;
}

function btoaLike(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] as number) : undefined;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] as number) : undefined;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 63];
  }
  return out;
}
