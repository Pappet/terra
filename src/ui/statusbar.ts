/**
 * Statusleiste (M10.0): Overlay-Wahl links, Kurzmeldungen in der Mitte,
 * Live-Informationen rechts (Tile unter der Maus, Route, FPS).
 *
 * Die früheren schwebenden Toasts landen hier im Meldungs-Slot.
 */
import { OVERLAYS } from '../data/overlays';
import { el } from './widgets';

const MESSAGE_MS = 2500;

export class StatusBar {
  private readonly chips = new Map<string, HTMLButtonElement>();
  private readonly message: HTMLElement;
  private readonly info: HTMLElement;
  private messageTimer: number | undefined;

  constructor(host: HTMLElement, onOverlay: (id: string) => void) {
    const bar = el('div', 'statusbar');

    const chips = el('div', 'overlay-chips');
    chips.append(el('span', 'muted', 'Ansicht'));
    for (const overlay of OVERLAYS) {
      const b = el('button', undefined, overlay.name);
      b.type = 'button';
      b.title = `Overlay ${overlay.name} (O wechselt weiter)`;
      b.addEventListener('click', () => onOverlay(overlay.id));
      this.chips.set(overlay.id, b);
      chips.append(b);
    }
    bar.append(chips);

    this.message = el('div', 'status-message');
    this.info = el('div', 'status-info');
    bar.append(this.message, this.info);
    host.append(bar);
  }

  setActiveOverlay(id: string): void {
    for (const [overlayId, b] of this.chips) b.classList.toggle('active', overlayId === id);
  }

  /** Rechte Spalte: wird vom Frame-Loop zyklisch gesetzt. */
  setInfo(text: string): void {
    this.info.textContent = text;
  }

  /** Kurzmeldung (z.B. "Gespeichert"), verblasst nach 2.5 s. */
  flash(text: string): void {
    this.message.textContent = text;
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => {
      this.message.textContent = '';
    }, MESSAGE_MS);
  }
}
