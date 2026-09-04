/**
 * Werkzeuge (M2). Rein UI-Seitig: das Werkzeug entscheidet, welche Actions
 * aus einer Mausgeste entstehen – die Sim sieht nur Actions.
 */
export interface ToolDef {
  readonly id: 'paint' | 'road' | 'zone' | 'demolish' | 'route' | 'found';
  readonly name: string;
  readonly hint: string;
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'found', name: 'Gründen', hint: 'Stadt gründen (auf Land)' },
  { id: 'paint', name: 'Malen', hint: 'Tiles übermalen (Debug-Editor)' },
  { id: 'road', name: 'Strasse', hint: 'Strassen bauen/ausbauen (ziehbar)' },
  { id: 'zone', name: 'Zonen', hint: 'Wohnen/Gewerbe/Industrie nahe Städten zonen (ziehbar)' },
  { id: 'demolish', name: 'Abriss', hint: 'Strassen abreissen (ziehbar)' },
  { id: 'route', name: 'Route', hint: 'Klicken: Start, zweiter Klick: Ziel' },
];
