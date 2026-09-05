import { describe, expect, it } from 'vitest';
import { REGION, resolveSelection, sameSelection, type SelectionSource } from './selection';

/** Minimale Karte: 8x8, zwei Städte, eine gezonte Fläche. */
function source(overrides: Partial<SelectionSource> = {}): SelectionSource {
  const width = 8;
  const height = 8;
  const zoneCity = new Int16Array(width * height);
  zoneCity[3 * width + 5] = 2; // gezontes Tile gehört Stadt 2
  return {
    width,
    height,
    zoneCity,
    cities: { count: 2, x: [1, 6], y: [1, 6] },
    ...overrides,
  };
}

describe('resolveSelection', () => {
  it('liefert region ausserhalb der Karte', () => {
    expect(resolveSelection(source(), -1)).toEqual(REGION);
    expect(resolveSelection(source(), 64)).toEqual(REGION);
    expect(resolveSelection(source(), 1.5)).toEqual(REGION);
  });

  it('wählt die Stadt eines gezonten Tiles', () => {
    expect(resolveSelection(source(), 3 * 8 + 5)).toEqual({ kind: 'city', cityId: 2 });
  });

  it('wählt die Stadt in der Nähe ihres Zentrums', () => {
    // Zentrum Stadt 1 liegt auf (1,1), Klick auf (2,2) ist innerhalb des Radius.
    expect(resolveSelection(source(), 2 * 8 + 2)).toEqual({ kind: 'city', cityId: 1 });
  });

  it('wählt sonst das Tile', () => {
    expect(resolveSelection(source(), 4 * 8 + 0)).toEqual({ kind: 'tile', index: 32 });
  });

  it('ignoriert Zonen-IDs jenseits des Städtebestands', () => {
    const zoneCity = new Int16Array(64);
    zoneCity[40] = 7;
    expect(resolveSelection(source({ zoneCity }), 40)).toEqual({ kind: 'tile', index: 40 });
  });
});

describe('sameSelection', () => {
  it('vergleicht Art und Nutzlast', () => {
    expect(sameSelection(REGION, REGION)).toBe(true);
    expect(sameSelection({ kind: 'city', cityId: 1 }, { kind: 'city', cityId: 1 })).toBe(true);
    expect(sameSelection({ kind: 'city', cityId: 1 }, { kind: 'city', cityId: 2 })).toBe(false);
    expect(sameSelection({ kind: 'tile', index: 3 }, { kind: 'tile', index: 4 })).toBe(false);
    expect(sameSelection(REGION, { kind: 'tile', index: 4 })).toBe(false);
  });
});
