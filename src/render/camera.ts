/**
 * Kamera: reine Transformations- und Zustandslogik, DOM-frei und testbar.
 * Koordinatensystem: Welt in Tiles, Bildschirm in CSS-Pixeln, Ursprung oben links.
 * x/y ist die Kartenposition des Sichtfeld-Zentrums.
 */
import { VIEW_CONFIG } from '../data/config';

export interface CameraOptions {
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

export class Camera {
  x = 0;
  y = 0;
  zoom: number;
  readonly minZoom: number;
  readonly maxZoom: number;

  private viewportW = 0;
  private viewportH = 0;

  constructor(opts: CameraOptions = {}) {
    this.minZoom = opts.minZoom ?? VIEW_CONFIG.minZoom;
    this.maxZoom = opts.maxZoom ?? VIEW_CONFIG.maxZoom;
    this.zoom = clamp(opts.zoom ?? VIEW_CONFIG.defaultZoom, this.minZoom, this.maxZoom);
  }

  setViewport(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
  }

  panByPixels(dxPx: number, dyPx: number): void {
    this.x -= dxPx / this.zoom;
    this.y -= dyPx / this.zoom;
  }

  panByTiles(dxTiles: number, dyTiles: number): void {
    this.x += dxTiles;
    this.y += dyTiles;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewportW / 2) / this.zoom + this.x,
      y: (sy - this.viewportH / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.viewportW / 2,
      y: (wy - this.y) * this.zoom + this.viewportH / 2,
    };
  }

  /** Zoomen um den Punkt unter dem Cursor; dieser bleibt ortsfest. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  /** Sichtfeld-Zentrum innerhalb der Karte halten. */
  clampToMap(mapW: number, mapH: number): void {
    this.x = clamp(this.x, 0, mapW);
    this.y = clamp(this.y, 0, mapH);
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
