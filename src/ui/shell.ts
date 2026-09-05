/**
 * Shell (M10.0): baut den App-Frame und liefert die Regionen als benannte
 * Hosts. Die Shell kennt weder Spiel noch Panels – sie besitzt nur das Grid.
 *
 * Regeln:
 * - Der Canvas ist eine Grid-Zelle. Kein `position: fixed`, kein z-index.
 * - Ein-/Ausklappen von Options-Spalte und Dock ändert nur Spaltenbreiten;
 *   kein Panel wechselt dabei seine Region.
 */
import { el } from './widgets';

/** Ab dieser Fensterbreite startet das Dock ausgeklappt. */
export const DOCK_AUTOHIDE_WIDTH = 1100;

export interface ShellRegions {
  readonly root: HTMLDivElement;
  readonly topbar: HTMLElement;
  readonly rail: HTMLElement;
  readonly options: HTMLElement;
  readonly canvasHost: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly dock: HTMLElement;
  readonly status: HTMLElement;
  setOptionsVisible(visible: boolean): void;
  setDockVisible(visible: boolean): void;
  isDockVisible(): boolean;
}

export function createShell(mount: HTMLElement): ShellRegions {
  const root = el('div', 'shell');
  const topbar = el('header', 'shell-topbar');
  const rail = el('nav', 'shell-rail');
  const options = el('aside', 'shell-options');
  const canvasHost = el('main', 'shell-canvas');
  const dock = el('aside', 'shell-dock');
  const status = el('footer', 'shell-status');

  const canvas = el('canvas');
  canvas.id = 'game';
  canvasHost.append(canvas);

  root.append(topbar, rail, options, canvasHost, dock, status);
  mount.replaceChildren(root);

  root.dataset['options'] = 'off';
  root.dataset['dock'] = window.innerWidth >= DOCK_AUTOHIDE_WIDTH ? 'on' : 'off';

  return {
    root,
    topbar,
    rail,
    options,
    canvasHost,
    canvas,
    dock,
    status,
    setOptionsVisible(visible: boolean): void {
      root.dataset['options'] = visible ? 'on' : 'off';
    },
    setDockVisible(visible: boolean): void {
      root.dataset['dock'] = visible ? 'on' : 'off';
    },
    isDockVisible(): boolean {
      return root.dataset['dock'] === 'on';
    },
  };
}
