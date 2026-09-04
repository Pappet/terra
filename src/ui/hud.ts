/**
 * HUD: Statuszeile, Geschwindigkeits-Buttons, Tile-Palette, Savegame-Buttons.
 * Reines DOM mit Callbacks nach unten – keine Spiellogik, kein Sim-Zugriff.
 */
import { TILE_TYPES, type TileType } from '../data/tiles';

export interface HudCallbacks {
  onSpeed(speed: number): void;
  onPaintTile(tileId: number): void;
  onSave(): void;
  onLoad(): void;
  onExport(): void;
  onImport(file: File): void;
}

function button(label: string, onClick: () => void, title?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  if (title !== undefined) b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

export class Hud {
  private readonly info: HTMLDivElement;
  private readonly flashEl: HTMLDivElement;
  private readonly speedButtons = new Map<number, HTMLButtonElement>();
  private readonly paintButtons = new Map<number, HTMLButtonElement>();
  private readonly fileInput: HTMLInputElement;
  private flashTimer: number | undefined;

  constructor(container: HTMLElement, callbacks: HudCallbacks) {
    // Statuszeile oben links
    const statusPanel = document.createElement('div');
    statusPanel.className = 'panel top-left';
    this.info = document.createElement('div');
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'flash';
    statusPanel.append(this.info, this.flashEl);

    // Geschwindigkeit oben rechts
    const speedPanel = document.createElement('div');
    speedPanel.className = 'panel top-right';
    for (const [label, speed] of [
      ['⏸', 0],
      ['1x', 1],
      ['3x', 3],
      ['10x', 10],
    ] as const) {
      const b = button(
        label,
        () => callbacks.onSpeed(speed),
        speed === 0 ? 'Pause (Leertaste)' : `Geschwindigkeit ${label}`,
      );
      this.speedButtons.set(speed, b);
      speedPanel.append(b);
    }

    // Tile-Palette unten links
    const paintPanel = document.createElement('div');
    paintPanel.className = 'panel bottom-left';
    paintPanel.append(hudLabel('Malen:'));
    for (const tile of TILE_TYPES) {
      this.paintButtons.set(tile.id, this.makePaintButton(tile, callbacks));
      paintPanel.append(this.paintButtons.get(tile.id)!);
    }

    // Savegame unten rechts
    const savePanel = document.createElement('div');
    savePanel.className = 'panel bottom-right';
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json,.json';
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      this.fileInput.value = '';
      if (file !== undefined) callbacks.onImport(file);
    });
    savePanel.append(
      button('Speichern', callbacks.onSave, 'Im Browser (IndexedDB) speichern'),
      button('Laden', callbacks.onLoad, 'Aus dem Browser laden'),
      button('Export', callbacks.onExport, 'Als JSON-Datei herunterladen'),
      button('Import', () => this.fileInput.click(), 'JSON-Datei laden'),
      this.fileInput,
    );

    container.append(statusPanel, speedPanel, paintPanel, savePanel);
    this.setActiveSpeed(1);
    this.setActivePaintTile(1);
  }

  private makePaintButton(tile: TileType, callbacks: HudCallbacks): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'paint';
    b.title = tile.name;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = tile.color;
    b.append(swatch, document.createTextNode(tile.name));
    b.addEventListener('click', () => callbacks.onPaintTile(tile.id));
    return b;
  }

  setActiveSpeed(speed: number): void {
    for (const [s, b] of this.speedButtons) {
      b.classList.toggle('active', s === speed);
    }
  }

  setActivePaintTile(tileId: number): void {
    for (const [id, b] of this.paintButtons) {
      b.classList.toggle('active', id === tileId);
    }
  }

  /** Infozeile (Tick/Seed/Speed/FPS) – wird zyklisch vom Frame-Loop gesetzt. */
  setInfo(text: string): void {
    this.info.textContent = text;
  }

  /** Kurzmeldung (z.B. "Gespeichert"), verblasst nach 2.5 s. */
  flash(message: string): void {
    this.flashEl.textContent = message;
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      this.flashEl.textContent = '';
    }, 2500);
  }
}

function hudLabel(text: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'label';
  s.textContent = text;
  return s;
}
