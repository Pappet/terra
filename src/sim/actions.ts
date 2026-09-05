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
import { CITIES } from '../data/cities';
import type { Cities } from './cities';
import type { Buildings } from './buildings';

/** Struktur-Schnittstelle auf dem Weltzustand, den Actions brauchen. */
export interface ActionContext {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  readonly water: Uint8Array;
  readonly roads: Uint8Array;
  readonly cities: Cities;
  readonly buildings: Buildings;
  readonly zoneType: Uint8Array;
  readonly zoneCity: Int16Array;
  /** 0 = kein Gebäude, sonst Gebäude-ID. */
  readonly buildingIndex: Int32Array;
  /** Pro Stadt: gezonte, unbebaute Tiles (pflegt paintZone). */
  readonly cityZoneTiles: number[][];
  /** Tick-Nummer, die dieses Update abschliesst (Aktionen gelten als in diesem Tick passiert). */
  readonly currentTick: number;
  treasury: number;
  /** Grund des letzten abgelehnten Calls (UI-Sichtbar), sonst null. */
  lastRejected: string | null;
  /** Globaler Steuersatz 0..1 (M7). */
  taxRate: number;
  /** Restschuld (Kredite, M7.3). */
  debt: number;
  /** Bankrott-Flag (M7.4): kein Bau, solange gesetzt. */
  bankrupt: boolean;
  /** Kreditlimit (maxDebtPerAdult × Erwachsene). */
  maxDebt: number;
  /** Vom Tick auszuwertende Routenanfrage (Route wird nach den Actions berechnet). */
  routeRequest: { from: number; to: number } | null;
}

export type GameAction =
  /** Ein Tile auf einen Typ setzen (M0: Paint-Werkzeug, bleibt Debug-Editor). */
  | { kind: 'paintTile'; x: number; y: number; tile: number }
  /** Strasse auf einem Land-Tile bauen (oder bestehende ausbauen). */
  | { kind: 'buildRoad'; x: number; y: number; road: number }
  /** Strasse abreissen (keine Erstattung). */
  | { kind: 'demolishRoad'; x: number; y: number }
  /** Route von->to berechnen lassen (Ergebnis: World.route, sichtbar im Overlay). */
  | { kind: 'requestRoute'; from: number; to: number }
  /** Angezeigte Route verwerfen. */
  | { kind: 'clearRoute' }
  /** Stadt gründen (auf Land, Mindestabstand zu anderen Zentren). */
  | { kind: 'foundCity'; x: number; y: number; name: string }
  /** Zone setzen (1=R, 2=C, 3=I) oder aufheben (0), nahe einer Stadt. */
  | { kind: 'paintZone'; x: number; y: number; zone: number }
  /** Globalen Steuersatz setzen (0..1, multipliziert die Steuereinnahmen). */
  | { kind: 'setTaxRate'; rate: number }
  /** Kredit aufnehmen (Zins läuft pro Intervall). */
  | { kind: 'takeLoan'; amount: number }
  /** Schulden tilgen. */
  | { kind: 'repayLoan'; amount: number };

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
      if (ctx.bankrupt) return reject(ctx, 'Bankrott: kein Bau möglich');
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
    case 'requestRoute': {
      const { from, to } = action;
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0) return true;
      ctx.routeRequest = { from, to };
      return true;
    }
    case 'clearRoute': {
      ctx.routeRequest = { from: -1, to: -1 };
      return true;
    }
    case 'takeLoan': {
      const { amount } = action;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return reject(ctx, `Ungültiger Kreditbetrag: ${String(amount)}`);
      }
      if (ctx.debt + amount > ctx.maxDebt) {
        return reject(ctx, `Kreditlimit erreicht (max. Schulden ${ctx.maxDebt})`);
      }
      ctx.debt += amount;
      ctx.treasury += amount;
      return true;
    }
    case 'repayLoan': {
      const { amount } = action;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return reject(ctx, `Ungültiger Tilgungsbetrag: ${String(amount)}`);
      }
      const pay = Math.min(amount, ctx.debt, ctx.treasury);
      if (pay <= 0) {
        return reject(ctx, 'Keine Mittel zur Tilgung');
      }
      ctx.debt -= pay;
      ctx.treasury -= pay;
      return true;
    }
    case 'setTaxRate': {
      const { rate } = action;
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) {
        return reject(ctx, `Ungültiger Steuersatz: ${String(rate)}`);
      }
      ctx.taxRate = rate;
      return true;
    }
    case 'foundCity': {
      const { x, y, name } = action;
      if (!inBounds(ctx, x, y)) return true;
      const idx = y * ctx.width + x;
      if ((ctx.water[idx] ?? 0) === 1) {
        return reject(ctx, `Stadtgründung braucht Land (${x},${y})`);
      }
      if (ctx.cities.distanceToNearest(x, y) < CITIES.minFoundingDistance) {
        return reject(ctx, `Zu nah an bestehender Stadt (min. ${CITIES.minFoundingDistance} Tiles)`);
      }
      ctx.cities.found(name, x, y, ctx.currentTick);
      ctx.cityZoneTiles.push([]);
      return true;
    }
    case 'paintZone': {
      const { x, y, zone } = action;
      if (!Number.isInteger(zone) || zone < 0 || zone > 3) {
        throw new Error(`paintZone: unbekannte Zone ${zone}`);
      }
      if (!inBounds(ctx, x, y)) return true;
      const idx = y * ctx.width + x;
      if ((ctx.water[idx] ?? 0) === 1) {
        return reject(ctx, 'Kein Zonen auf Wasser');
      }
      if ((ctx.roads[idx] ?? 0) !== 0) {
        return reject(ctx, 'Zonen unter Strassen nicht möglich');
      }
      if (ctx.bankrupt) return reject(ctx, 'Bankrott: kein Zonen möglich');
      if ((ctx.buildingIndex[idx] ?? 0) !== 0) {
        return reject(ctx, 'Tile ist bebaut');
      }
      if (zone === 0) {
        const oldCity = ctx.zoneCity[idx] ?? 0;
        ctx.zoneType[idx] = 0;
        ctx.zoneCity[idx] = 0;
        if (oldCity > 0) removeFromZoneList(ctx.cityZoneTiles, oldCity, idx);
        return true;
      }
      const nearest = ctx.cities.nearest(x, y);
      if (nearest === null || nearest.dist > CITIES.maxZoneDistance) {
        return reject(ctx, `Ausserhalb des Stadtgebiets (max. ${CITIES.maxZoneDistance} Tiles)`);
      }
      // Übersonen räumt die alte Zuordnung ab, sonst bleibt der Tile in der
      // alten cityZoneTiles-Liste und die alte Stadt baut dort später "falsch".
      const prevCity = ctx.zoneCity[idx] ?? 0;
      if (prevCity !== nearest.id) {
        if (prevCity > 0) removeFromZoneList(ctx.cityZoneTiles, prevCity, idx);
        addToZoneList(ctx.cityZoneTiles, nearest.id, idx);
      }
      ctx.zoneType[idx] = zone;
      ctx.zoneCity[idx] = nearest.id;
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

function addToZoneList(cityZoneTiles: number[][], cityId: number, idx: number): void {
  const list = cityZoneTiles[cityId - 1];
  if (list === undefined) return;
  if (!list.includes(idx)) list.push(idx);
}

function removeFromZoneList(cityZoneTiles: number[][], cityId: number, idx: number): void {
  const list = cityZoneTiles[cityId - 1];
  if (list === undefined) return;
  const at = list.indexOf(idx);
  if (at >= 0) list.splice(at, 1);
}
