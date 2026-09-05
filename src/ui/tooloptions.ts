/**
 * Werkzeug-Optionen (M10.0): die Spalte rechts neben der Rail. Sie zeigt die
 * Varianten des aktiven Werkzeugs (Zonentyp, Strassentyp, Tile-Palette) und
 * ist leer – und damit eingeklappt –, wenn das Werkzeug keine hat.
 *
 * Ersetzt die alte Kontextzeile am unteren Rand: ein Werkzeugwechsel ändert
 * eine Spaltenbreite, nicht die Position anderer Panels.
 */
import { ZONE_COLORS } from '../data/cities';
import { ROAD_TYPES } from '../data/roads';
import { TILE_TYPES } from '../data/tiles';
import type { ToolId } from '../data/tools';
import { el, hint, swatch } from './widgets';

export interface ToolOptionsCallbacks {
  onZone(zone: number): void;
  onRoad(roadId: number): void;
  onTile(tileId: number): void;
}

const ZONES: ReadonlyArray<{ zone: number; label: string }> = [
  { zone: 1, label: 'Wohnen' },
  { zone: 2, label: 'Gewerbe' },
  { zone: 3, label: 'Industrie' },
  { zone: 0, label: 'Aufheben' },
];

export interface ToolSelections {
  readonly zone: number;
  readonly road: number;
  readonly tile: number;
}

export class ToolOptions {
  private readonly root: HTMLDivElement;
  private active = new Map<number, HTMLButtonElement>();

  constructor(
    host: HTMLElement,
    private readonly callbacks: ToolOptionsCallbacks,
  ) {
    this.root = el('div', 'options');
    host.append(this.root);
  }

  /** Baut die Optionen des Werkzeugs; liefert false, wenn es keine gibt. */
  setTool(tool: ToolId, selections: ToolSelections): boolean {
    this.active = new Map();
    switch (tool) {
      case 'zone':
        this.render('Zonentyp', ZONES.map((z) => ({
          key: z.zone,
          label: z.label,
          color: ZONE_COLORS.get(z.zone),
          meta: '',
          title: z.zone === 0 ? 'Zone entfernen' : `${z.label} zonen`,
          onPick: () => this.callbacks.onZone(z.zone),
        })), selections.zone,
        'Zonen nur im Umkreis einer Stadt. Bebaut wird nur mit Strassenanschluss.');
        return true;
      case 'road':
        this.render('Strassentyp', ROAD_TYPES.map((r) => ({
          key: r.id,
          label: r.name,
          color: undefined,
          meta: String(r.buildCost),
          title: `Bau ${r.buildCost}, Unterhalt ${r.upkeepPerTick}/Tick, Tempo ${r.speedTilesPerTick}/Tick`,
          onPick: () => this.callbacks.onRoad(r.id),
        })), selections.road,
        'Zahl rechts: Baukosten pro Tile. Ziehen baut eine Linie.');
        return true;
      case 'paint':
        this.render('Tile (Debug)', TILE_TYPES.map((t) => ({
          key: t.id,
          label: t.name,
          color: t.color,
          meta: '',
          title: t.name,
          onPick: () => this.callbacks.onTile(t.id),
        })), selections.tile,
        'Debug-Editor: überschreibt den generierten Untergrund.');
        return true;
      default:
        this.root.replaceChildren();
        return false;
    }
  }

  setActiveKey(key: number): void {
    for (const [k, b] of this.active) b.classList.toggle('active', k === key);
  }

  private render(
    title: string,
    entries: ReadonlyArray<{
      key: number;
      label: string;
      color: string | undefined;
      meta: string;
      title: string;
      onPick: () => void;
    }>,
    activeKey: number,
    footer: string,
  ): void {
    const nodes: HTMLElement[] = [el('div', 'options-title', title)];
    for (const entry of entries) {
      const b = el('button', 'option');
      b.type = 'button';
      b.title = entry.title;
      if (entry.color !== undefined) b.append(swatch(entry.color));
      b.append(el('span', undefined, entry.label));
      if (entry.meta !== '') b.append(el('span', 'option-meta', entry.meta));
      b.addEventListener('click', entry.onPick);
      this.active.set(entry.key, b);
      nodes.push(b);
    }
    nodes.push(hint(footer));
    this.root.replaceChildren(...nodes);
    this.setActiveKey(activeKey);
  }
}
