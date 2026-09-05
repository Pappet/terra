/**
 * Dock (M10.0): rechte Spalte aus Minimap und Inspektor.
 *
 * Der Inspektor zeigt genau einen Tab. Welche Tabs zur Wahl stehen, liefert
 * die Registry aus dem Selektionskontext – das Dock selbst kennt kein
 * einziges Feature-Panel.
 */
import { el } from './widgets';
import type { Selection } from './selection';
import {
  pickTab,
  tabsFor,
  type InspectorContext,
  type InspectorTab,
  type TabInstance,
} from './inspector/registry';

interface MountedTab {
  readonly host: HTMLElement;
  readonly instance: TabInstance;
}

export class Dock {
  readonly minimapHost: HTMLElement;
  private readonly head: HTMLElement;
  private readonly title: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly tabBar: HTMLElement;
  private readonly body: HTMLElement;
  private readonly mounted = new Map<string, MountedTab>();
  private selection: Selection = { kind: 'region' };
  private activeTabId: string | null = null;

  constructor(host: HTMLElement, onClearSelection: () => void) {
    this.minimapHost = el('div', 'dock-minimap');

    const inspector = el('div', 'inspector');
    this.head = el('div', 'inspector-head');
    this.back = el('button', 'inspector-back', '◀');
    this.back.type = 'button';
    this.back.title = 'Auswahl aufheben (ESC)';
    this.back.addEventListener('click', onClearSelection);
    this.title = el('div', 'inspector-title', 'Region');
    this.head.append(this.back, this.title);
    this.tabBar = el('div', 'inspector-tabs');
    this.body = el('div', 'inspector-body');
    inspector.append(this.head, this.tabBar, this.body);

    host.append(this.minimapHost, inspector);
    this.setSelection({ kind: 'region' }, 'Region');
  }

  /** Kontextwechsel: Kopf und Tab-Leiste neu, aktiver Tab bleibt wenn möglich. */
  setSelection(selection: Selection, title: string): void {
    this.selection = selection;
    this.title.textContent = title;
    this.back.hidden = selection.kind === 'region';

    const tabs = tabsFor(selection.kind);
    const active = pickTab(selection.kind, this.activeTabId);
    this.activeTabId = active?.id ?? null;

    const buttons: HTMLElement[] = [];
    for (const tab of tabs) {
      const b = el('button', tab.id === this.activeTabId ? 'active' : undefined, tab.label);
      b.type = 'button';
      b.addEventListener('click', () => this.activate(tab));
      buttons.push(b);
    }
    this.tabBar.replaceChildren(...buttons);
    this.tabBar.hidden = tabs.length <= 1;
    this.showActiveTab();
  }

  /** Zyklisch: rechnet nur für den sichtbaren Tab. */
  update(ctx: InspectorContext): void {
    if (this.activeTabId === null) return;
    this.mounted.get(this.activeTabId)?.instance.update(ctx);
  }

  private activate(tab: InspectorTab): void {
    this.activeTabId = tab.id;
    for (const [i, node] of Array.from(this.tabBar.children).entries()) {
      const tabs = tabsFor(this.selection.kind);
      node.classList.toggle('active', tabs[i]?.id === tab.id);
    }
    this.showActiveTab();
  }

  private showActiveTab(): void {
    const id = this.activeTabId;
    if (id === null) {
      this.body.replaceChildren();
      return;
    }
    let entry = this.mounted.get(id);
    if (entry === undefined) {
      const tab = tabsFor(this.selection.kind).find((t) => t.id === id);
      if (tab === undefined) return;
      const tabHost = el('div');
      entry = { host: tabHost, instance: tab.create(tabHost) };
      this.mounted.set(id, entry);
    }
    this.body.replaceChildren(entry.host);
  }
}
