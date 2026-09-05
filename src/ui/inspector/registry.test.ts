import { describe, expect, it } from 'vitest';
import { INSPECTOR_TABS, pickTab, tabsFor } from './registry';

describe('Inspektor-Registry', () => {
  it('vergibt eindeutige Tab-IDs', () => {
    const ids = INSPECTOR_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deckt jeden Selektionskontext ab', () => {
    expect(tabsFor('region').length).toBeGreaterThan(0);
    expect(tabsFor('city').length).toBeGreaterThan(0);
    expect(tabsFor('tile').length).toBeGreaterThan(0);
  });

  it('filtert strikt nach Kontext', () => {
    for (const kind of ['region', 'city', 'tile'] as const) {
      for (const tab of tabsFor(kind)) expect(tab.context).toBe(kind);
    }
  });

  it('behält den bevorzugten Tab, wenn er im Kontext existiert', () => {
    const preferred = tabsFor('region')[1];
    expect(preferred).toBeDefined();
    expect(pickTab('region', preferred!.id)?.id).toBe(preferred!.id);
  });

  it('fällt auf den ersten Tab des Kontexts zurück', () => {
    // Ein Tab aus einem anderen Kontext ist keine gültige Vorauswahl.
    const cityTab = tabsFor('city')[0];
    expect(pickTab('region', cityTab?.id ?? null)?.id).toBe(tabsFor('region')[0]?.id);
    expect(pickTab('tile', null)?.id).toBe(tabsFor('tile')[0]?.id);
  });
});
