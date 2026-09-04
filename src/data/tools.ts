/**
 * Werkzeuge (M2). Rein UI-Seitig: das Werkzeug entscheidet, welche Actions
 * aus einer Mausgeste entstehen – die Sim sieht nur Actions.
 */
export interface ToolDef {
  readonly id: 'paint' | 'road' | 'demolish' | 'route';
  readonly name: string;
  readonly hint: string;
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'paint', name: 'Malen', hint: 'Tiles übermalen (Debug-Editor)' },
  { id: 'road', name: 'Strasse', hint: 'Strassen bauen/ausbauen (ziehbar)' },
  { id: 'demolish', name: 'Abriss', hint: 'Strassen abreissen (ziehbar)' },
  { id: 'route', name: 'Route', hint: 'Klicken: Start, zweiter Klick: Ziel' },
];
