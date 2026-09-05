/**
 * Tastenkürzel des Spiels (M10.0). Bewusst getrennt von input.ts: dort liegt
 * die Kartensteuerung (Pan/Zoom/Ziehen), hier die Bedienung der Oberfläche.
 *
 * Belegung:
 *   1…7        Werkzeug (Reihenfolge aus data/tools.ts)
 *   Leertaste  Pause an/aus
 *   [ / ]      Geschwindigkeit langsamer/schneller
 *   O          nächstes Overlay
 *   ESC        Auswahl aufheben
 * WASD/Pfeile schwenken – deshalb liegt die Statistik seit M10.0 im Dock und
 * nicht mehr auf `S`.
 */
import { TOOLS, type ToolId } from '../data/tools';

export interface ShortcutHandlers {
  onTool(id: ToolId): void;
  onTogglePause(): void;
  onSpeedStep(delta: number): void;
  onCycleOverlay(): void;
  onClearSelection(): void;
}

export function attachShortcuts(handlers: ShortcutHandlers): void {
  window.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

    const tool = TOOLS.find((t) => t.shortcut === ev.key);
    if (tool !== undefined) {
      ev.preventDefault();
      handlers.onTool(tool.id);
      return;
    }

    switch (ev.key) {
      case ' ':
        // Sonst löst die Leertaste zusätzlich den fokussierten Button aus.
        ev.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        handlers.onTogglePause();
        return;
      case '[':
        handlers.onSpeedStep(-1);
        return;
      case ']':
        handlers.onSpeedStep(1);
        return;
      case 'o':
      case 'O':
        handlers.onCycleOverlay();
        return;
      case 'Escape':
        handlers.onClearSelection();
        return;
    }
  });
}
