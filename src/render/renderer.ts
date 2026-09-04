/**
 * Canvas2D-Renderer mit Layer-Caching: Die Tile-Ebene wird einmal pro
 * (tileRev, Cache-Aufloesung) in eine Offscreen-Canvas gerendert; pro Frame
 * wird nur geblittet plus billige Overlay-Elemente (Gitter, Kartenrand).
 *
 * Cache-Aufloesung ist gekappt (Gerätepixel pro Tile), damit grosse Zoomwerte
 * den Speicher nicht sprengen – flächige Tiles vertragen Nearest-Neighbor-
 * Upscaling ohne sichtbaren Qualitätsverlust. Bei 512x512-Karten wird das
 * durch Chunk-Caching ersetzt (BACKLOG).
 */
import { VIEW_CONFIG } from '../data/config';
import { TILE_TYPES } from '../data/tiles';
import type { World } from '../sim/world';
import { Camera } from './camera';

const CACHE_MAX_PX_PER_TILE = 16;
const CACHE_MIN_PX_PER_TILE = 2;

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cache: HTMLCanvasElement;
  private readonly cacheCtx: CanvasRenderingContext2D;
  private world: World | null = null;
  private cacheKey = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Canvas2D-Kontext nicht verfügbar');
    this.ctx = ctx;
    this.cache = document.createElement('canvas');
    const cacheCtx = this.cache.getContext('2d');
    if (cacheCtx === null) throw new Error('Offscreen-Kontext nicht verfügbar');
    this.cacheCtx = cacheCtx;
  }

  setWorld(world: World): void {
    this.world = world;
    this.cacheKey = '';
  }

  draw(camera: Camera): void {
    const world = this.world;
    if (world === null) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    const targetW = Math.max(1, Math.round(cssW * dpr));
    const targetH = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    camera.setViewport(cssW, cssH);

    const scale = Math.round(
      Math.min(
        CACHE_MAX_PX_PER_TILE,
        Math.max(CACHE_MIN_PX_PER_TILE, camera.zoom * dpr),
      ),
    );
    const key = `${world.tileRev}|${scale}|${world.width}x${world.height}`;
    if (key !== this.cacheKey) {
      this.rebuildCache(world, scale);
      this.cacheKey = key;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, cssW, cssH);

    const topLeft = camera.worldToScreen(0, 0);
    const mapWpx = world.width * camera.zoom;
    const mapHpx = world.height * camera.zoom;
    ctx.drawImage(this.cache, topLeft.x, topLeft.y, mapWpx, mapHpx);

    if (camera.zoom >= VIEW_CONFIG.gridLineMinZoom) {
      this.drawGrid(camera, world, topLeft.x, topLeft.y, mapWpx, mapHpx);
    }
    ctx.strokeStyle = '#3d4652';
    ctx.lineWidth = 1;
    ctx.strokeRect(topLeft.x - 0.5, topLeft.y - 0.5, mapWpx + 1, mapHpx + 1);
  }

  private drawGrid(
    camera: Camera,
    world: World,
    topLeftX: number,
    topLeftY: number,
    mapWpx: number,
    mapHpx: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(topLeftX, topLeftY, mapWpx, mapHpx);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const firstTile = camera.screenToWorld(0, 0);
    const lastTile = camera.screenToWorld(this.canvas.clientWidth, this.canvas.clientHeight);
    const x0 = Math.max(0, Math.floor(firstTile.x));
    const x1 = Math.min(world.width, Math.ceil(lastTile.x));
    const y0 = Math.max(0, Math.floor(firstTile.y));
    const y1 = Math.min(world.height, Math.ceil(lastTile.y));
    for (let x = x0; x <= x1; x++) {
      const sx = Math.round(camera.worldToScreen(x, 0).x) + 0.5;
      ctx.moveTo(sx, topLeftY);
      ctx.lineTo(sx, topLeftY + mapHpx);
    }
    for (let y = y0; y <= y1; y++) {
      const sy = Math.round(camera.worldToScreen(0, y).y) + 0.5;
      ctx.moveTo(topLeftX, sy);
      ctx.lineTo(topLeftX + mapWpx, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  private rebuildCache(world: World, scale: number): void {
    const w = world.width * scale;
    const h = world.height * scale;
    if (this.cache.width !== w) this.cache.width = w;
    if (this.cache.height !== h) this.cache.height = h;
    const ctx = this.cacheCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    // Zeichnen in Tile-Einheiten; leichtes Überzeichnen gegen Kantenritze.
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const eps = 0.02;
    for (let y = 0; y < world.height; y++) {
      const row = y * world.width;
      for (let x = 0; x < world.width; x++) {
        const tileId = world.tiles[row + x];
        const tile = tileId === undefined ? undefined : TILE_TYPES[tileId];
        if (tile === undefined) continue;
        ctx.fillStyle = tile.color;
        ctx.fillRect(x, y, 1 + eps, 1 + eps);
      }
    }
  }
}
