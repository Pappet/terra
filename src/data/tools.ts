/**
 * Werkzeuge (M2, erweitert in M10.0). Rein UI-seitig: das Werkzeug entscheidet,
 * welche Actions aus einer Mausgeste entstehen – die Sim sieht nur Actions.
 *
 * Die Werkzeugleiste rendert direkt aus dieser Tabelle: ein neues Werkzeug ist
 * ein Eintrag mit Symbol und Kürzel, kein Layout-Eingriff.
 */
export type ToolId = 'select' | 'found' | 'zone' | 'road' | 'demolish' | 'route' | 'paint';

export interface ToolDef {
  readonly id: ToolId;
  readonly name: string;
  readonly hint: string;
  /** Symbol für die Rail (ein Zeichen, keine Grafikdatei). */
  readonly icon: string;
  /** Tastenkürzel (Ziffernreihe, in der Reihenfolge dieser Tabelle). */
  readonly shortcut: string;
  /** Trennlinie oberhalb: setzt Debug-Werkzeuge vom Spiel ab. */
  readonly separatorBefore?: boolean;
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', name: 'Auswahl', hint: 'Stadt oder Tile inspizieren (ESC hebt auf)', icon: '↖', shortcut: '1' },
  { id: 'found', name: 'Gründen', hint: 'Stadt gründen (auf Land)', icon: '⚑', shortcut: '2' },
  { id: 'zone', name: 'Zonen', hint: 'Wohnen/Gewerbe/Industrie nahe Städten zonen (ziehbar)', icon: '▦', shortcut: '3' },
  { id: 'road', name: 'Strasse', hint: 'Strassen bauen/ausbauen (ziehbar)', icon: '═', shortcut: '4' },
  { id: 'demolish', name: 'Abriss', hint: 'Strassen abreissen (ziehbar)', icon: '✕', shortcut: '5' },
  { id: 'route', name: 'Route', hint: 'Klicken: Start, zweiter Klick: Ziel', icon: '↦', shortcut: '6' },
  { id: 'paint', name: 'Malen', hint: 'Tiles übermalen (Debug-Editor)', icon: '✎', shortcut: '7', separatorBefore: true },
];

/** Startwerkzeug: inspizieren, nicht bauen. */
export const DEFAULT_TOOL: ToolId = 'select';

export function toolById(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}
