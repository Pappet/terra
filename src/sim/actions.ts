/**
 * Spielaktionen – die EINZIGE legitime Art, wie sich der Weltzustand ändert.
 * UI/Renderer reichen Actions an die Warteschlange weiter; ausgeführt werden
 * sie ausschliesslich im Sim-Tick (Determinismus-Grenze, siehe DECISIONS D003).
 */
import { TILE_TYPES } from '../data/tiles';

export type GameAction =
  /** Ein Tile auf einen Typ setzen (M0: Paint-Werkzeug, bleibt Debug-Editor). */
  | { kind: 'paintTile'; x: number; y: number; tile: number };

/**
 * Action auf den Weltzustand anwenden. Reine Funktion auf den Rohdaten –
 * kein DOM, kein Rendering, voll deterministisch.
 *
 * Out-of-Bounds-Koordinaten werden still ignoriert (UI kann beim Ziehen über
 * den Kartenrand hinaus geraten); ungültige Tile-IDs sind ein Programmfehler
 * und werfen.
 */
export function applyAction(
  tiles: Uint8Array,
  width: number,
  height: number,
  action: GameAction,
): void {
  switch (action.kind) {
    case 'paintTile': {
      const { x, y, tile } = action;
      if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_TYPES.length) {
        throw new Error(`paintTile: unbekannter Tile-Typ ${tile}`);
      }
      if (
        !Number.isInteger(x) || !Number.isInteger(y) ||
        x < 0 || y < 0 || x >= width || y >= height
      ) {
        return;
      }
      tiles[y * width + x] = tile;
      return;
    }
    default: {
      // Kompilierzeit-Exhaustiveness greift erst ab dem zweiten Union-Member
      // (TS subtrahiert bei Ein-Member-Unionen nicht bis never, siehe Test).
      // Bis dahin fängt der Runtime-Throw unbekannte Kinds ab.
      throw new Error(`applyAction: unbekannte Action ${JSON.stringify(action)}`);
    }
  }
}
