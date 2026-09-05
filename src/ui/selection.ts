/**
 * Selektionsmodell des Inspektors (M10.0).
 *
 * `region` ist der Rückfallzustand (nichts ausgewählt). Ein Klick auf die
 * Karte wählt die Stadt, wenn das Tile ihr zugeordnet ist (Zonenlayer oder
 * Nähe zum Stadtzentrum), sonst das einzelne Tile.
 *
 * Bewusst strukturell typisiert statt gegen World – so bleibt die Auflösung
 * ohne DOM und ohne Weltgenerierung testbar (Muster wie ActionContext).
 */

export type Selection =
  | { readonly kind: 'region' }
  | { readonly kind: 'city'; readonly cityId: number }
  | { readonly kind: 'tile'; readonly index: number };

export const REGION: Selection = { kind: 'region' };

/** Radius um das Stadtzentrum, in dem ein ungezontes Tile noch die Stadt meint. */
export const CENTER_PICK_RADIUS = 2;

export interface SelectionSource {
  readonly width: number;
  readonly height: number;
  /** Stadt-ID der Zone pro Tile (0 = keine Zone). */
  readonly zoneCity: { readonly [index: number]: number | undefined; readonly length: number };
  readonly cities: {
    readonly count: number;
    readonly x: readonly number[];
    readonly y: readonly number[];
  };
}

/**
 * Löst einen Klick auf den Tile-Index in eine Selektion auf.
 * Ein Index ausserhalb der Karte (< 0 oder >= width*height) ergibt `region`.
 */
export function resolveSelection(source: SelectionSource, tileIndex: number): Selection {
  const tiles = source.width * source.height;
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= tiles) return REGION;

  const zoneCity = source.zoneCity[tileIndex] ?? 0;
  if (zoneCity > 0 && zoneCity <= source.cities.count) return { kind: 'city', cityId: zoneCity };

  const x = tileIndex % source.width;
  const y = Math.floor(tileIndex / source.width);
  for (let id = 1; id <= source.cities.count; id++) {
    const cx = source.cities.x[id - 1];
    const cy = source.cities.y[id - 1];
    if (cx === undefined || cy === undefined) continue;
    if (Math.abs(cx - x) <= CENTER_PICK_RADIUS && Math.abs(cy - y) <= CENTER_PICK_RADIUS) {
      return { kind: 'city', cityId: id };
    }
  }

  return { kind: 'tile', index: tileIndex };
}

/** Gleichheit zweier Selektionen (für "muss der Inspektor neu aufgebaut werden?"). */
export function sameSelection(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'city' && b.kind === 'city') return a.cityId === b.cityId;
  if (a.kind === 'tile' && b.kind === 'tile') return a.index === b.index;
  return true;
}
