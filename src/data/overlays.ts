/**
 * Debug-/Ansichts-Overlays (M1): welche Ebene sichtbar ist und wie sie
 * dargestellt wird. Nur Daten – die Farblogik liegt in render/overlay.ts.
 */
export type OverlayKind = 'surface' | 'gradient' | 'boolean' | 'water' | 'bitmask';

export interface OverlayDef {
  readonly id: string;
  readonly name: string;
  readonly kind: OverlayKind;
  /** Für gradient/boolean: der Layer, aus dem gelesen wird. */
  readonly layer?: 'elevation' | 'fertility' | 'forest';
  /** gradient: Farbrampen-Enden (layer 0 -> min, 255 -> max). */
  readonly min?: string;
  readonly max?: string;
  /** boolean: Farben für 0/1. */
  readonly falseColor?: string;
  readonly trueColor?: string;
}

export const OVERLAYS: readonly OverlayDef[] = [
  { id: 'surface', name: 'Oberfläche', kind: 'surface' },
  { id: 'elevation', name: 'Höhe', kind: 'gradient', layer: 'elevation', min: '#0a0d12', max: '#e8e4d8' },
  { id: 'water', name: 'Wasser', kind: 'water' },
  { id: 'fertility', name: 'Fruchtbarkeit', kind: 'gradient', layer: 'fertility', min: '#5a3a1e', max: '#4ea44e' },
  { id: 'forest', name: 'Wald', kind: 'boolean', layer: 'forest', falseColor: '#141a12', trueColor: '#3f8f3f' },
  { id: 'deposits', name: 'Vorkommen', kind: 'bitmask' },
];

/** Farben der Vorkommen-Bits (Reihenfolge wie DEPOSIT_DEFS). */
export const DEPOSIT_COLORS: ReadonlyMap<number, [number, number, number]> = new Map([
  [1, [154, 154, 144]], // Stein
  [2, [194, 163, 107]], // Ton
  [4, [70, 70, 88]], // Kohle
  [8, [168, 100, 80]], // Eisen
  [16, [64, 56, 104]], // Öl
]);

export function overlayById(id: string): OverlayDef | undefined {
  return OVERLAYS.find((o) => o.id === id);
}
