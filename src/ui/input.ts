/**
 * Eingabe auf dem Canvas: Malen/Auswählen (linke Maustaste), Schwenken
 * (rechte/mittlere), Zoom (Rad, +/-), Tastatur-Pan (WASD/Pfeile).
 *
 * Seit M10.0 gehört dem Canvas nur noch die Kartensteuerung; Spiel-Kürzel
 * (Werkzeuge, Geschwindigkeit, Overlay) liegen in shortcuts.ts. Der Viewport
 * wird per ResizeObserver verfolgt, weil der Canvas eine Grid-Zelle ist und
 * beim Ein-/Ausklappen von Panels seine Größe ändert, ohne dass das Fenster
 * sich ändert.
 */
import { VIEW_CONFIG } from '../data/config';
import type { Camera } from '../render/camera';

export interface InputHandler {
  camera: Camera;
  /** Aktuelle Kartengrösse (kann sich durch Laden eines Savegames ändern). */
  getMapSize(): { width: number; height: number };
  /** Malen/Anwenden am Tile-Index (Grenzen wurden bereits geprüft). */
  paintAt(tileIndex: number): void;
  /** Tile unter dem Zeiger (-1 = ausserhalb der Karte). */
  hoverAt(tileIndex: number): void;
}

export interface InputBinding {
  /** Gerichteter Tastatur-Pan in Tiles/Sekunde, für den Frame-Loop. */
  getKeyPanDir(): { dx: number; dy: number };
}

export function attachInput(canvas: HTMLCanvasElement, handler: InputHandler): InputBinding {
  const camera = handler.camera;
  const pressedKeys = new Set<string>();
  const mouse = { painting: false, panning: false, lastX: 0, lastY: 0, lastTile: -1 };
  let viewportW = 1;
  let viewportH = 1;

  const syncViewport = (): void => {
    viewportW = canvas.clientWidth;
    viewportH = canvas.clientHeight;
  };
  new ResizeObserver(syncViewport).observe(canvas);
  syncViewport();

  function tileUnder(ev: MouseEvent): number {
    const rect = canvas.getBoundingClientRect();
    const pos = camera.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const { width, height } = handler.getMapSize();
    if (x < 0 || y < 0 || x >= width || y >= height) return -1;
    return y * width + x;
  }

  function paintUnder(ev: MouseEvent): void {
    const idx = tileUnder(ev);
    if (idx < 0) {
      mouse.lastTile = -1; // Karte verlassen: keine Linie beim Wiedereintritt
      return;
    }
    if (idx === mouse.lastTile) return;
    if (mouse.lastTile >= 0) {
      // Schnelle Züge interpolieren, sonst entstehen löchrige Zonen/Strassen.
      // Invarianten: lastTile und idx sind beide on-board (idx<0 setzt oben
      // lastTile=-1), und Bresenham bleibt in der Bounding-Box seiner End-
      // punkte -> die Linie kann die Karte nicht verlassen. Der Bounds-Check
      // ist reine Verteidigung gegen einen stale lastTile nach Weltwechsel
      // (kleinere Karte geladen, Zeiger noch gedrückt).
      const { width, height } = handler.getMapSize();
      const maxIdx = width * height;
      for (const t of lineTiles(mouse.lastTile, idx, width).slice(1)) {
        if (t >= 0 && t < maxIdx) handler.paintAt(t);
      }
    } else {
      handler.paintAt(idx);
    }
    mouse.lastTile = idx;
  }

  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) {
      mouse.painting = true;
      mouse.lastTile = -1;
      paintUnder(ev);
    } else if (ev.button === 1 || ev.button === 2) {
      mouse.panning = true;
      mouse.lastX = ev.clientX;
      mouse.lastY = ev.clientY;
    }
  });

  // Ziehen (Malen/Schwenken) muss auch ausserhalb des Canvas weiterlaufen,
  // deshalb hängt die Geste am Fenster; die Hover-Anzeige nur am Canvas.
  window.addEventListener('mousemove', (ev) => {
    if (mouse.painting) {
      paintUnder(ev);
    } else if (mouse.panning) {
      camera.panByPixels(ev.clientX - mouse.lastX, ev.clientY - mouse.lastY);
      mouse.lastX = ev.clientX;
      mouse.lastY = ev.clientY;
    }
  });

  canvas.addEventListener('mousemove', (ev) => {
    handler.hoverAt(tileUnder(ev));
  });

  canvas.addEventListener('mouseleave', () => {
    handler.hoverAt(-1);
    mouse.lastTile = -1;
  });

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const factor = ev.deltaY < 0 ? VIEW_CONFIG.wheelZoomFactor : 1 / VIEW_CONFIG.wheelZoomFactor;
    camera.zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, factor);
  }, { passive: false });

  window.addEventListener('mouseup', () => {
    mouse.painting = false;
    mouse.panning = false;
    mouse.lastTile = -1;
  });

  window.addEventListener('keydown', (ev) => {
    if (isTextTarget(ev.target)) return;
    pressedKeys.add(ev.key.toLowerCase());
    switch (ev.key) {
      case '+':
      case '=':
        camera.zoomAt(viewportW / 2, viewportH / 2, VIEW_CONFIG.wheelZoomFactor);
        return;
      case '-':
        camera.zoomAt(viewportW / 2, viewportH / 2, 1 / VIEW_CONFIG.wheelZoomFactor);
        return;
    }
  });

  window.addEventListener('keyup', (ev) => {
    pressedKeys.delete(ev.key.toLowerCase());
  });

  function getKeyPanDir(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) dx -= 1;
    if (pressedKeys.has('d') || pressedKeys.has('arrowright')) dx += 1;
    if (pressedKeys.has('w') || pressedKeys.has('arrowup')) dy -= 1;
    if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) dy += 1;
    return { dx, dy };
  }

  return { getKeyPanDir };
}

/** Tastatur ignorieren, solange ein Eingabefeld den Fokus hat. */
function isTextTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/** Gitterlinien von bis (inklusive beider Enden), Bresenham auf Tile-Basis. */
function lineTiles(from: number, to: number, width: number): number[] {
  const x0 = from % width;
  const y0 = Math.floor(from / width);
  const x1 = to % width;
  const y1 = Math.floor(to / width);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const out: number[] = [];
  for (;;) {
    out.push(y * width + x);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
