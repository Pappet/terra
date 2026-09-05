/**
 * Inspektor-Registry (M10.0). Das Dock zeigt genau einen Tab; welche Tabs zur
 * Auswahl stehen, entscheidet allein der Selektionskontext.
 *
 * ERWEITERUNG: Ein neues Feature-Panel ist ein Eintrag in INSPECTOR_TABS –
 * kein Eingriff ins Layout und keine Änderung am Dock.
 */
import type { GameAction } from '../../sim/actions';
import type { World } from '../../sim/world';
import type { Selection } from '../selection';
import { CITY_TABS } from './city';
import { REGION_TABS } from './region';
import { TILE_TABS } from './tile';

export interface InspectorContext {
  readonly world: World;
  readonly selection: Selection;
  /** Stadt auswählen (Listenklick) – setzt die Selektion des Docks. */
  selectCity(cityId: number): void;
  /** Kamera auf eine Kartenposition zentrieren. */
  jumpTo(x: number, y: number): void;
  /** Aktion einreihen und sofort einen Tick abarbeiten lassen. */
  dispatch(action: GameAction): void;
}

export interface TabInstance {
  /** Zyklisch aufgerufen, aber nur für den sichtbaren Tab. */
  update(ctx: InspectorContext): void;
}

export interface InspectorTab {
  readonly id: string;
  readonly label: string;
  readonly context: Selection['kind'];
  create(host: HTMLElement): TabInstance;
}

export const INSPECTOR_TABS: readonly InspectorTab[] = [
  ...REGION_TABS,
  ...CITY_TABS,
  ...TILE_TABS,
];

/** Tabs eines Kontexts in Registrierungsreihenfolge. */
export function tabsFor(kind: Selection['kind']): readonly InspectorTab[] {
  return INSPECTOR_TABS.filter((tab) => tab.context === kind);
}

/** Aktiver Tab nach Kontextwechsel: bisheriger, sonst der erste des Kontexts. */
export function pickTab(kind: Selection['kind'], preferredId: string | null): InspectorTab | null {
  const tabs = tabsFor(kind);
  if (tabs.length === 0) return null;
  const preferred = tabs.find((tab) => tab.id === preferredId);
  return preferred ?? tabs[0] ?? null;
}
