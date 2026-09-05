/**
 * Canvas2D-Renderer mit Layer-Caching: Die Karte wird 1px-pro-Tile als
 * ImageData gerendert (Overlay-abhängig) und auf eine Cache-Canvas in
 * Gerätepixel-Auflösung skaliert; pro Frame wird nur geblittet plus billige
 * Overlays (Gitter, Kartenrand).
 *
 * Cache-Auflösung ist gekappt (Gerätepixel pro Tile), damit grosse Zoomwerte
 * den Speicher nicht sprengen. Bei grösseren Karten/Zoom wird das durch
 * Chunk-Caching ersetzt (BACKLOG).
 */
import { VIEW_CONFIG } from '../data/config';
import { CITIES } from '../data/cities';
import type { World } from '../sim/world';
import { Camera } from './camera';
import { fillTileColors } from './overlay';

const CACHE_MAX_PX_PER_TILE = 16;
const CACHE_MIN_PX_PER_TILE = 2;

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** 1px pro Tile – die Native-Auflösung der Kartendarstellung. */
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly mapCtx: CanvasRenderingContext2D;
  private readonly cache: HTMLCanvasElement;
  private readonly cacheCtx: CanvasRenderingContext2D;
  private world: World | null = null;
  private cacheKey = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('Canvas2D-Kontext nicht verfügbar');
    this.ctx = ctx;
    this.mapCanvas = document.createElement('canvas');
    const mapCtx = this.mapCanvas.getContext('2d');
    if (mapCtx === null) throw new Error('Map-Kontext nicht verfügbar');
    this.mapCtx = mapCtx;
    this.cache = document.createElement('canvas');
    const cacheCtx = this.cache.getContext('2d');
    if (cacheCtx === null) throw new Error('Offscreen-Kontext nicht verfügbar');
    this.cacheCtx = cacheCtx;
  }

  setWorld(world: World): void {
    this.world = world;
    this.mapCanvas.width = world.width;
    this.mapCanvas.height = world.height;
    this.cacheKey = '';
  }

  draw(camera: Camera, overlayId: string): void {
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
    const key = `${overlayId}|${scale}|${world.tileRev}|${world.width}x${world.height}`;
    if (key !== this.cacheKey) {
      this.rebuildCache(world, overlayId, scale);
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
    this.drawCityMarkers(camera, world);
    if (overlayId === 'commute') {
      this.drawCommuteLines(camera, world);
    }
    if (overlayId === 'trade') {
      this.drawTradeArrows(camera, world);
    }
    ctx.strokeStyle = '#3d4652';
    ctx.lineWidth = 1;
    ctx.strokeRect(topLeft.x - 0.5, topLeft.y - 0.5, mapWpx + 1, mapHpx + 1);
  }

  /** Handelsflüsse als Pfeile zwischen Stadtzentren; Strichstärke ∞ Mengen. */
  private drawTradeArrows(camera: Camera, world: World): void {
    const ctx = this.ctx;
    for (const route of world.trade.routes) {
      // Summe der Güter auf diesem Paar (letzte Tick-Flüsse, beide Richtungen)
      const rowAB = world.trade.flows[route.from - 1]?.[route.to - 1];
      const rowBA = world.trade.flows[route.to - 1]?.[route.from - 1];
      let total = 0;
      for (const row of [rowAB, rowBA]) {
        if (row === undefined) continue;
        for (const v of row) total += v ?? 0;
      }
      if (total <= 0) continue;
      const from = camera.worldToScreen(
        (world.cities.x[route.from - 1] ?? 0) + 0.5,
        (world.cities.y[route.from - 1] ?? 0) + 0.5,
      );
      const to = camera.worldToScreen(
        (world.cities.x[route.to - 1] ?? 0) + 0.5,
        (world.cities.y[route.to - 1] ?? 0) + 0.5,
      );
      ctx.strokeStyle = 'rgba(154, 200, 120, 0.8)';
      ctx.lineWidth = Math.min(8, Math.max(1, Math.log2(1 + total) * 1.5));
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }

  /** Pendlerflüsse als Linien zwischen Stadtzentren; Strichstärke ∝ Fluss. */
  private drawCommuteLines(camera: Camera, world: World): void {
    const ctx = this.ctx;
    const flows = world.commute?.flows;
    if (flows === undefined) return;
    for (let home = 1; home <= world.cities.count; home++) {
      const row = flows[home - 1];
      if (row === undefined) continue;
      for (let job = 1; job <= world.cities.count; job++) {
        const flow = row[job - 1] ?? 0;
        if (flow <= 0 || home === job) continue;
        const from = camera.worldToScreen(
          (world.cities.x[home - 1] ?? 0) + 0.5,
          (world.cities.y[home - 1] ?? 0) + 0.5,
        );
        const to = camera.worldToScreen(
          (world.cities.x[job - 1] ?? 0) + 0.5,
          (world.cities.y[job - 1] ?? 0) + 0.5,
        );
        ctx.strokeStyle = 'rgba(224, 138, 60, 0.75)';
        ctx.lineWidth = Math.min(8, Math.max(1, Math.log2(1 + flow) * 1.5));
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
  }

  /** Stadtzentren als Marker über dem Kartenbild. */
  private drawCityMarkers(camera: Camera, world: World): void {
    const ctx = this.ctx;
    const radius = Math.max(3, camera.zoom * 0.8);
    for (let i = 0; i < world.cities.count; i++) {
      const center = camera.worldToScreen((world.cities.x[i] ?? 0) + 0.5, (world.cities.y[i] ?? 0) + 0.5);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = CITIES.markerColor;
      ctx.fill();
      ctx.strokeStyle = CITIES.markerBorderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
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

  private rebuildCache(world: World, overlayId: string, scale: number): void {
    const imageData = this.mapCtx.createImageData(world.width, world.height);
    fillTileColors(world, overlayId, imageData.data);
    this.mapCtx.putImageData(imageData, 0, 0);

    const w = world.width * scale;
    const h = world.height * scale;
    if (this.cache.width !== w) this.cache.width = w;
    if (this.cache.height !== h) this.cache.height = h;
    this.cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.cacheCtx.imageSmoothingEnabled = false;
    this.cacheCtx.clearRect(0, 0, w, h);
    this.cacheCtx.drawImage(this.mapCanvas, 0, 0, w, h);
  }
}
