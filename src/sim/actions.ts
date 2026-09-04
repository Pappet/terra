/**
 * Spielaktionen – die EINZIGE legitime Art, wie sich der Weltzustand ändert.
 * UI/Renderer reichen Actions an die Warteschlange weiter; ausgeführt werden
 * sie ausschliesslich im Sim-Tick (Determinismus-Grenze, siehe DECISIONS D003).
 *
 * applyAction erhält einen ActionContext (strukturell erfüllt von World) statt
 * das ganze World-Objekt zu importieren – so bleibt die Abhängigkeit einseitig.
 */
import { ROAD_BY_ID } from '../data/roads';
import { TILE_TYPES } from '../data/tiles';

/** Struktur-Schnittstelle auf dem Weltzustand, den Actions brauchen. */
export interface ActionContext {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  readonly water: Uint8Array;
  readonly roads: Uint8Array;
  treasury: number;
  /** Grund des letzten abgelehnten Calls (UI-Sichtbar), sonst null. */
  lastRejected: string | null;
}

export type GameAction =
  /** Ein Tile auf einen Typ setzen (M0: Paint-Werkzeug, bleibt Debug-Editor). */
  | { kind: 'paintTile'; x: number; y: number; tile: number }
  /** Strasse auf einem Land-Tile bauen (oder bestehende ausbauen). */
  | { kind: 'buildRoad'; x: number; y: number; road: number }
  /** Strasse abreissen (keine Erstattung). */
  | { kind: 'demolishRoad'; x: number; y: number };

/**
 * Action anwenden. Liefert true, wenn sie ausgeführt wurde.
 * Out-of-Bounds wird still ignoriert (true: nichts zu tun); abgelehnte
 * Ausführungen (Wasser, zu teuer, unbekannter Typ) liefern false und setzen
 * ctx.lastRejected.
 */
export function applyAction(ctx: ActionContext, action: GameAction): boolean {
  switch (action.kind) {
    case 'paintTile': {
      const { x, y, tile } = action;
      if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_TYPES.length) {
        throw new Error(`paintTile: unbekannter Tile-Typ ${tile}`);
      }
      if (!inBounds(ctx, x, y)) return true;
      ctx.tiles[y * ctx.width + x] = tile;
      return true;
    }
    case 'buildRoad': {
      const { x, y, road } = action;
      const type = ROAD_BY_ID.get(road);
      if (type === undefined) {
        throw new Error(`buildRoad: unbekannter Strassentyp ${road}`);
      }
      if (!inBounds(ctx, x, y)) return true;
      const idx = y * ctx.width + x;
      if ((ctx.water[idx] ?? 0) === 1) {
        return reject(ctx, `Kein Strassenbau auf Wasser bei ${x},${y}`);
      }
      if ((ctx.roads[idx] ?? 0) === road) return true; // bereits so gebaut
      if (ctx.treasury < type.buildCost) {
        return reject(ctx, `Zu wenig Kasse für ${type.name} (${type.buildCost})`);
      }
      ctx.treasury -= type.buildCost;
      ctx.roads[idx] = road;
      return true;
    }
    case 'demolishRoad': {
      const { x, y } = action;
      if (!inBounds(ctx, x, y)) return true;
      ctx.roads[y * ctx.width + x] = 0;
      return true;
    }
    default: {
      // Kompilierzeit-Exhaustiveness greift erst ab dem zweiten Union-Member
      // mit unbehandelten Kinds; der Runtime-Throw fängt Reste ab.
      const unknown = action as { kind?: string };
      throw new Error(`applyAction: unbekannte Action ${JSON.stringify(unknown)}`);
    }
  }
}

function inBounds(ctx: ActionContext, x: number, y: number): boolean {
  return (
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < ctx.width && y < ctx.height
  );
}

function reject(ctx: ActionContext, reason: string): false {
  ctx.lastRejected = reason;
  return false;
}
