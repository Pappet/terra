/**
 * HUD: Statuszeile, Geschwindigkeits-Buttons, Tile-Palette, Savegame-Buttons.
 * Reines DOM mit Callbacks nach unten – keine Spiellogik, kein Sim-Zugriff.
 */
import { OVERLAYS } from '../data/overlays';
import { ROAD_TYPES } from '../data/roads';
import { TOOLS } from '../data/tools';
import { TILE_TYPES, type TileType } from '../data/tiles';

const ZONE_BUTTONS: ReadonlyArray<{ zone: number; label: string }> = [
  { zone: 1, label: 'Wohnen' },
  { zone: 2, label: 'Gewerbe' },
  { zone: 3, label: 'Industrie' },
  { zone: 0, label: 'Aufheben' },
];

export interface HudCallbacks {
  onSpeed(speed: number): void;
  onTaxRate(rate: number): void;
  onPaintTile(tileId: number): void;
  onOverlay(overlayId: string): void;
  onTool(toolId: string): void;
  onRoadType(roadId: number): void;
  onZoneType(zone: number): void;
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
  private readonly overlayButtons = new Map<string, HTMLButtonElement>();
  private readonly toolButtons = new Map<string, HTMLButtonElement>();
  private readonly roadButtons = new Map<number, HTMLButtonElement>();
  private readonly zoneButtons = new Map<number, HTMLButtonElement>();
  private readonly roadRow: HTMLDivElement;
  private readonly paintRow: HTMLDivElement;
  private readonly zoneRow: HTMLDivElement;
  private readonly taxButtons = new Map<number, HTMLButtonElement>();
  private cityPanel: HTMLDivElement | null = null;
  private budgetEl: HTMLDivElement | null = null;
  private cityListEl: HTMLDivElement | null = null;
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

    // Werkzeuge unten mittig; Kontextzeile (Palette/Strassentypen) unten links
    const toolPanel = document.createElement('div');
    toolPanel.className = 'panel bottom-center';
    for (const tool of TOOLS) {
      const b = button(tool.name, () => callbacks.onTool(tool.id), tool.hint);
      this.toolButtons.set(tool.id, b);
      toolPanel.append(b);
    }

    const paintPanel = document.createElement('div');
    paintPanel.className = 'panel bottom-left';
    this.paintRow = document.createElement('div');
    this.paintRow.className = 'row';
    this.paintRow.append(hudLabel('Malen:'));
    for (const tile of TILE_TYPES) {
      this.paintButtons.set(tile.id, this.makePaintButton(tile, callbacks));
      this.paintRow.append(this.paintButtons.get(tile.id)!);
    }
    this.roadRow = document.createElement('div');
    this.roadRow.className = 'row';
    this.roadRow.append(hudLabel('Bauen:'));
    for (const road of ROAD_TYPES) {
      const b = button(
        `${road.name} ${road.buildCost}`,
        () => callbacks.onRoadType(road.id),
        `Bau ${road.buildCost}, Unterhalt ${road.upkeepPerTick}/Tick, Tempo ${road.speedTilesPerTick}/Tick`,
      );
      this.roadButtons.set(road.id, b);
      this.roadRow.append(b);
    }
    this.zoneRow = document.createElement('div');
    this.zoneRow.className = 'row';
    this.zoneRow.append(hudLabel('Zonen:'));
    for (const zb of ZONE_BUTTONS) {
      const b = button(zb.label, () => callbacks.onZoneType(zb.zone));
      this.zoneButtons.set(zb.zone, b);
      this.zoneRow.append(b);
    }
    paintPanel.append(this.zoneRow, this.roadRow, this.paintRow);

    // Steuersatz: eigene Zeile oben unter den Speed-Buttons
    const taxPanel = document.createElement('div');
    taxPanel.className = 'panel top-right';
    taxPanel.style.top = '48px';
    taxPanel.append(hudLabel('Steuern:'));
    for (const rate of [0, 0.25, 0.5, 0.75, 1] as const) {
      const b = button(
        `${Math.round(rate * 100)}%`,
        () => callbacks.onTaxRate(rate),
        `Steuereinnahmen auf ${Math.round(rate * 100)} % der Basis`,
      );
      this.taxButtons.set(rate, b);
      taxPanel.append(b);
    }

    // Overlay-Umschalter oben mittig
    const overlayPanel = document.createElement('div');
    overlayPanel.className = 'panel top-center';
    overlayPanel.append(hudLabel('Overlay:'));
    for (const overlay of OVERLAYS) {
      const b = button(overlay.name, () => callbacks.onOverlay(overlay.id));
      this.overlayButtons.set(overlay.id, b);
      overlayPanel.append(b);
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

    container.append(statusPanel, speedPanel, taxPanel, overlayPanel, toolPanel, paintPanel, savePanel);
    this.setActiveSpeed(1);
    this.setActivePaintTile(1);
    this.setActiveOverlay('surface');
    this.setActiveTool('found');
    this.setActiveRoadType(2);
    this.setActiveZoneType(1);
    this.setActiveTaxRate(1);
  }

  setActiveTaxRate(rate: number): void {
    for (const [r, b] of this.taxButtons) {
      b.classList.toggle('active', r === rate);
    }
  }

  /**
   * Stadt-Panel (links): Liste aller Städte mit Bevölkerung/Zonen/Gebäuden.
   * Klick auf eine Stadt -> onJump(cityId).
   */
  /**
   * Budget-Panel (links, unter den Städten): Kasse, Einnahmen pro Intervall,
   * Ausgaben pro Tick (Straßen + Gebäude), Netto und Schulden.
   */
  updateBudget(entry: {
    treasury: number;
    taxIncome: number;
    roadUpkeep: number;
    buildingUpkeep: number;
    debt: number;
    bankrupt: boolean;
  }): void {
    if (this.budgetEl === null) {
      this.budgetEl = document.createElement('div');
      this.budgetEl.className = 'panel budget-panel';
      document.body.append(this.budgetEl);
    }
    const netPerTick = entry.taxIncome / 200 - entry.roadUpkeep - entry.buildingUpkeep;
    this.budgetEl.textContent =
      `BUDGET  Kasse ${Math.floor(entry.treasury)}` +
      (entry.bankrupt ? ' [BANKROTT]' : '') +
      `
Steuern: ${entry.taxIncome.toFixed(1)}/Intervall` +
      `
Unterhalt: ${(entry.roadUpkeep + entry.buildingUpkeep).toFixed(2)}/Tick` +
      ` (Str ${entry.roadUpkeep.toFixed(2)} + Bld ${entry.buildingUpkeep.toFixed(2)})` +
      `
Netto: ${netPerTick >= 0 ? '+' : ''}${netPerTick.toFixed(2)}/Tick` +
      (entry.debt > 0 ? `
Schulden: ${Math.round(entry.debt)}` : '');
  }

  updateCities(
    entries: ReadonlyArray<{
      id: number;
      name: string;
      residents: number;
      jobs: number;
      satisfaction: number;
      exports: number;
      imports: number;
      residential: number;
      commercial: number;
      industrial: number;
      houses: number;
      shops: number;
      factories: number;
    }>,
    onJump: (cityId: number) => void,
  ): void {
    if (this.cityPanel === null) {
      this.cityPanel = document.createElement('div');
      this.cityPanel.className = 'panel city-panel';
      this.cityListEl = document.createElement('div');
      this.cityPanel.append(this.cityListEl);
      document.body.append(this.cityPanel);
    }
    const el = this.cityListEl as HTMLDivElement;
    if (entries.length === 0) {
      this.cityPanel.style.display = 'none';
      return;
    }
    this.cityPanel.style.display = '';
    el.replaceChildren(
      ...entries.map((entry) => {
        const row = document.createElement('div');
        row.className = 'city-row';
        row.textContent =
          `${entry.name}: ${entry.residents} EW, ${entry.jobs} Jobs, Zf ${Math.round(entry.satisfaction * 100)}% | ` +
          `R${entry.houses} C${entry.shops} I${entry.factories} | ` +
          `Nf ${Math.round(entry.residential * 100)}/${Math.round(entry.commercial * 100)}/${Math.round(entry.industrial * 100)}% | ` +
          `X ${Math.round(entry.exports)} / M ${Math.round(entry.imports)}`;
        row.title = 'Klicken: Kamera auf das Stadtzentrum';
        row.addEventListener('click', () => onJump(entry.id));
        return row;
      }),
    );
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

  setActiveOverlay(overlayId: string): void {
    for (const [id, b] of this.overlayButtons) {
      b.classList.toggle('active', id === overlayId);
    }
  }

  setActiveTool(toolId: string): void {
    for (const [id, b] of this.toolButtons) {
      b.classList.toggle('active', id === toolId);
    }
    this.paintRow.style.display = toolId === 'paint' ? '' : 'none';
    this.roadRow.style.display = toolId === 'road' ? '' : 'none';
    this.zoneRow.style.display = toolId === 'zone' ? '' : 'none';
  }

  setActiveRoadType(roadId: number): void {
    for (const [id, b] of this.roadButtons) {
      b.classList.toggle('active', id === roadId);
    }
  }

  setActiveZoneType(zone: number): void {
    for (const [id, b] of this.zoneButtons) {
      b.classList.toggle('active', id === zone);
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
