/**
 * Topbar (M10.0): global gültiger Zustand – Identität, Kennzahlen,
 * Geschwindigkeit, Dateiaktionen. Liest nichts selbst; `update` bekommt
 * fertige Zahlen aus dem Frame-Loop.
 */
import { formatInt, formatPercent, formatSigned, signClass } from './format';
import { button, el } from './widgets';

export interface TopbarCallbacks {
  onSpeed(speed: number): void;
  onSave(): void;
  onLoad(): void;
  onExport(): void;
  onImport(file: File): void;
  onToggleDock(): void;
}

export interface TopbarMetrics {
  readonly seed: number;
  readonly tick: number;
  readonly treasury: number;
  readonly netPerTick: number;
  readonly residents: number;
  readonly satisfaction: number;
  readonly debt: number;
  readonly bankrupt: boolean;
}

const SPEEDS: ReadonlyArray<[string, number]> = [
  ['⏸', 0],
  ['1x', 1],
  ['3x', 3],
  ['10x', 10],
];

export class Topbar {
  private readonly ident: HTMLElement;
  private readonly treasury: HTMLElement;
  private readonly net: HTMLElement;
  private readonly residents: HTMLElement;
  private readonly satisfaction: HTMLElement;
  private readonly debtWrap: HTMLElement;
  private readonly debt: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly speedButtons = new Map<number, HTMLButtonElement>();
  private readonly fileInput: HTMLInputElement;
  private readonly popover: HTMLElement;

  constructor(host: HTMLElement, callbacks: TopbarCallbacks) {
    const bar = el('div', 'topbar');

    bar.append(el('span', 'topbar-brand', 'TERRA'));
    this.ident = el('span', 'topbar-ident', '–');
    bar.append(this.ident);

    const metrics = el('div', 'topbar-metrics');
    const treasury = metricBlock('Kasse');
    this.treasury = treasury.value;
    this.net = el('span', 'metric-sub');
    treasury.root.append(this.net);
    const residents = metricBlock('Einwohner');
    this.residents = residents.value;
    const satisfaction = metricBlock('Zufrieden');
    this.satisfaction = satisfaction.value;
    const debt = metricBlock('Schulden');
    this.debt = debt.value;
    this.debtWrap = debt.root;
    this.debtWrap.hidden = true;
    this.badge = el('span', 'badge', 'BANKROTT');
    this.badge.hidden = true;
    metrics.append(treasury.root, residents.root, satisfaction.root, this.debtWrap, this.badge);
    bar.append(metrics);

    const segment = el('div', 'segment');
    for (const [label, speed] of SPEEDS) {
      const b = button(label, () => callbacks.onSpeed(speed),
        speed === 0 ? 'Pause (Leertaste)' : `Geschwindigkeit ${label}  ([ / ] wechselt)`);
      this.speedButtons.set(speed, b);
      segment.append(b);
    }
    bar.append(segment);

    // Datei-Menü: transientes Popover an der Topbar, kein Dauer-Panel.
    const menu = el('div', 'menu');
    this.popover = el('div', 'menu-popover');
    this.popover.hidden = true;
    this.fileInput = el('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json,.json';
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      this.fileInput.value = '';
      if (file !== undefined) callbacks.onImport(file);
    });
    const close = (): void => {
      this.popover.hidden = true;
    };
    this.popover.append(
      button('Speichern', () => { close(); callbacks.onSave(); }, 'Im Browser (IndexedDB) speichern'),
      button('Laden', () => { close(); callbacks.onLoad(); }, 'Aus dem Browser laden'),
      button('Export…', () => { close(); callbacks.onExport(); }, 'Als JSON-Datei herunterladen'),
      button('Import…', () => { close(); this.fileInput.click(); }, 'JSON-Datei laden'),
      this.fileInput,
    );
    const menuButton = button('Datei ▾', () => {
      this.popover.hidden = !this.popover.hidden;
    });
    menu.append(menuButton, this.popover);
    bar.append(menu);
    document.addEventListener('click', (ev) => {
      if (!menu.contains(ev.target as Node)) close();
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') close();
    });

    bar.append(button('▤', callbacks.onToggleDock, 'Seitenleiste ein-/ausblenden'));
    host.append(bar);
  }

  setSpeed(speed: number): void {
    for (const [s, b] of this.speedButtons) b.classList.toggle('active', s === speed);
  }

  update(m: TopbarMetrics): void {
    this.ident.textContent = `Seed ${m.seed} · Tick ${formatInt(m.tick)}`;
    this.treasury.textContent = formatInt(m.treasury);
    this.treasury.className = `metric-value ${signClass(m.treasury)}`;
    this.net.textContent = `${formatSigned(m.netPerTick)}/Tick`;
    this.net.className = `metric-sub ${signClass(m.netPerTick)}`;
    this.residents.textContent = formatInt(m.residents);
    this.satisfaction.textContent = formatPercent(m.satisfaction);
    this.debtWrap.hidden = m.debt <= 0;
    this.debt.textContent = formatInt(m.debt);
    this.debt.className = 'metric-value warn';
    this.badge.hidden = !m.bankrupt;
  }
}

function metricBlock(label: string): { root: HTMLElement; value: HTMLElement } {
  const root = el('div', 'metric');
  const value = el('span', 'metric-value', '–');
  root.append(el('span', 'metric-label', label), value);
  return { root, value };
}
