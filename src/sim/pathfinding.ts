/**
 * Pathfinding (M2): A* über das Grid-Graphenmodell.
 *
 * Bewegungsmodell: Kante in ein Nachbarfeld kostet 1/Geschwindigkeit des
 * Zielfelds – Strassentyp schneller als offroad (siehe /src/data/roads.ts),
 * Wasser unpassierbar (Brücken später). Acht Nachbarn, Heuristik: Octile-
 * Distanz × beste Kantenkosten – zulässig, also optimal.
 *
 * Der PathFinder hält einen Ergebnis-Cache, ungültig gemacht über eine
 * Revisionsnummer (World.tileRev): sobald sich Strassen ändern, wird neu
 * gerechnet. DOM-frei und deterministisch (Fester Nachbar- und Tie-Break).
 */
import { MOVEMENT, ROAD_BY_ID, TERRAIN_OFFROAD_FACTOR } from '../data/roads';

export interface PathfindingContext {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  readonly water: Uint8Array;
  readonly roads: Uint8Array;
  /** Änderungsstand der fürs Pathfinding relevanten Daten (z.B. tileRev). */
  readonly rev: number;
}

export interface PathResult {
  readonly path: readonly number[];
  /** Gesamt-Reisezeit in Ticks. */
  readonly timeTicks: number;
  /** A*-Knotenbesuche (0 = aus dem Cache). */
  readonly visited: number;
}

const MAX_CACHE_ENTRIES = 512;

export class PathFinder {
  private readonly cache = new Map<string, PathResult>();
  private gScore = new Float64Array(0);
  private closed = new Uint8Array(0);
  private cameFrom = new Int32Array(0);
  private scratchSize = 0;

  findPath(ctx: PathfindingContext, start: number, goal: number): PathResult | null {
    const cacheKey = `${ctx.rev}:${start}:${goal}`;
    const hit = this.cache.get(cacheKey);
    if (hit !== undefined) {
      // Cache-Treffer: visited=0 signalisiert "nicht gerechnet".
      return { ...hit, visited: 0 };
    }

    const result = this.compute(ctx, start, goal);
    if (this.cache.size >= MAX_CACHE_ENTRIES) this.cache.clear();
    this.cache.set(cacheKey, result);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private ensureScratch(size: number): void {
    if (this.scratchSize === size) return;
    this.gScore = new Float64Array(size);
    this.closed = new Uint8Array(size);
    this.cameFrom = new Int32Array(size);
    this.scratchSize = size;
  }

  private compute(ctx: PathfindingContext, start: number, goal: number): PathResult {
    const { width, height, tiles, water, roads } = ctx;
    const size = width * height;
    this.ensureScratch(size);
    const gScore = this.gScore;
    const closed = this.closed;
    const cameFrom = this.cameFrom;
    gScore.fill(Infinity);
    closed.fill(0);
    cameFrom.fill(-1);

    const bestSpeed = bestRoadSpeed();
    const goalGx = goal % width;
    const goalGy = Math.floor(goal / width);

    // Binär-Heap mit lazy deletion: Einträge [f, idx]
    const heapF: number[] = [];
    const heapIdx: number[] = [];
    let visited = 0;

    const h = (idx: number): number => {
      const x = idx % width;
      const y = Math.floor(idx / width);
      const dx = Math.abs(x - goalGx);
      const dy = Math.abs(y - goalGy);
      const octile = dx > dy ? dx - dy + Math.SQRT2 * dy : dy - dx + Math.SQRT2 * dx;
      return octile / bestSpeed;
    };
    const push = (idx: number, f: number): void => {
      heapF.push(f);
      heapIdx.push(idx);
      let i = heapF.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        // Tie-Break über Index -> deterministische Pop-Reihenfolge
        if (heapF[parent]! < heapF[i]! || (heapF[parent] === heapF[i] && heapIdx[parent]! <= heapIdx[i]!)) break;
        swap(heapF, heapIdx, parent, i);
        i = parent;
      }
    };
    const pop = (): { idx: number; f: number } | null => {
      if (heapF.length === 0) return null;
      const topF = heapF[0] as number;
      const topIdx = heapIdx[0] as number;
      const lastF = heapF.pop() as number;
      const lastIdx = heapIdx.pop() as number;
      if (heapF.length > 0) {
        heapF[0] = lastF;
        heapIdx[0] = lastIdx;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heapF.length && (heapF[l]! < heapF[m]! || (heapF[l] === heapF[m] && heapIdx[l]! < heapIdx[m]!))) m = l;
          if (r < heapF.length && (heapF[r]! < heapF[m]! || (heapF[r] === heapF[m] && heapIdx[r]! < heapIdx[m]!))) m = r;
          if (m === i) break;
          swap(heapF, heapIdx, i, m);
          i = m;
        }
      }
      return { idx: topIdx, f: topF };
    };

    if ((water[start] ?? 0) === 1 || (water[goal] ?? 0) === 1) {
      return { path: [], timeTicks: 0, visited: 0 };
    }
    if (start === goal) {
      return { path: [start], timeTicks: 0, visited: 0 };
    }

    gScore[start] = 0;
    push(start, h(start));

    let found = false;
    while (heapF.length > 0) {
      const current = pop();
      if (current === null) break;
      const cur = current.idx;
      if (closed[cur] === 1) continue; // lazy deletion
      if (current.f > gScore[cur]! + h(cur) + 1e-9) continue; // veralteter Eintrag
      closed[cur] = 1;
      visited++;
      if (cur === goal) {
        found = true;
        break;
      }
      const cx = cur % width;
      const cy = Math.floor(cur / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (closed[n] === 1) continue;
          if ((water[n] ?? 0) === 1) continue;
          const speed = tileSpeed(roads[n] ?? 0, tiles[n] ?? 0);
          const stepCost = 1 / speed;
          const tentative = gScore[cur]! + stepCost;
          if (tentative < gScore[n]!) {
            gScore[n] = tentative;
            cameFrom[n] = cur;
            push(n, tentative + h(n));
          }
        }
      }
    }

    if (!found) {
      return { path: [], timeTicks: 0, visited };
    }

    const path: number[] = [];
    let node = goal;
    while (node !== -1 && node !== start) {
      path.push(node);
      node = cameFrom[node] as number;
    }
    path.push(start);
    path.reverse();
    return { path, timeTicks: gScore[goal] ?? 0, visited };
  }
}

function swap(a: number[], b: number[], i: number, j: number): void {
  const tf = a[i] as number;
  a[i] = a[j] as number;
  a[j] = tf;
  const ti = b[i] as number;
  b[i] = b[j] as number;
  b[j] = ti;
}

export function tileSpeed(roadId: number, tileId = 0): number {
  const road = ROAD_BY_ID.get(roadId);
  if (road !== undefined) return road.speedTilesPerTick;
  const factor = TERRAIN_OFFROAD_FACTOR[tileId] ?? 1;
  return (MOVEMENT.offroadSpeedTilesPerTick as number) * factor;
}

function bestRoadSpeed(): number {
  let best: number = MOVEMENT.offroadSpeedTilesPerTick;
  for (const road of ROAD_BY_ID.values()) {
    if (road.speedTilesPerTick > best) best = road.speedTilesPerTick;
  }
  return best;
}

/** Bequemer Einzelfall ohne Cache-Wiederverwendung (Tests, einfache Aufrufer). */
export function findPath(ctx: PathfindingContext, start: number, goal: number): PathResult | null {
  return new PathFinder().findPath(ctx, start, goal);
}
