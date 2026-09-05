/**
 * Minimap (M1): zeigt die Karte im aktuellen Overlay-Modus, zeichnet das
 * Sichtfeld-Rechteck und springt bei Klick/Drag an die entsprechende Stelle.
 */
import type { World } from '../sim/world';
import type { Camera } from './camera';
import { fillTileColors } from './overlay';

export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly mapCtx: CanvasRenderingContext2D;
  private world: World | null = null;
  private key = '';

  constructor(parent: HTMLElement, private readonly sizePx = 176) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = sizePx;
    this.canvas.height = sizePx;
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('Minimap-Kontext nicht verfügbar');
    this.ctx = ctx;
    this.mapCanvas = document.createElement('canvas');
    const mapCtx = this.mapCanvas.getContext('2d');
    if (mapCtx === null) throw new Error('Minimap-Map-Kontext nicht verfügbar');
    this.mapCtx = mapCtx;
    parent.append(this.canvas);
  }

  setWorld(world: World): void {
    this.world = world;
    this.mapCanvas.width = world.width;
    this.mapCanvas.height = world.height;
    this.key = '';
  }

  /** Pro Frame aufrufen; rendert nur bei Änderungen neu, Rechteck immer. */
  draw(camera: Camera, overlayId: string): void {
    const world = this.world;
    if (world === null) return;

    const key = `${overlayId}|${world.tileRev}`;
    if (key !== this.key) {
      const imageData = this.mapCtx.createImageData(world.width, world.height);
      fillTileColors(world, overlayId, imageData.data);
      this.mapCtx.putImageData(imageData, 0, 0);
      this.key = key;
    }

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.sizePx, this.sizePx);
    ctx.drawImage(this.mapCanvas, 0, 0, this.sizePx, this.sizePx);

    // Sichtfeld-Rechteck (Grösse des Haupt-Viewports, nicht der Minimap)
    const sx = this.sizePx / world.width;
    const sy = this.sizePx / world.height;
    const view = camera.viewSize;
    if (view.width <= 0 || view.height <= 0) return;
    const topLeft = camera.screenToWorld(0, 0);
    const bottomRight = camera.screenToWorld(view.width, view.height);
    const rx = topLeft.x * sx;
    const ry = topLeft.y * sy;
    const rw = (bottomRight.x - topLeft.x) * sx;
    const rh = (bottomRight.y - topLeft.y) * sy;
    ctx.strokeStyle = '#e8e4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(2, rw), Math.max(2, rh));
  }

  /** Bildschirmposition im Element -> Weltkoordinaten (Klick-Sprung). */
  screenToWorld(px: number, py: number): { x: number; y: number } {
    const world = this.world;
    if (world === null) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((px - rect.left) / rect.width) * world.width,
      y: ((py - rect.top) / rect.height) * world.height,
    };
  }
}
