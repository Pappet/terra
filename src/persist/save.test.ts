import { describe, expect, it } from 'vitest';
import { readUi, withUi } from '../persist/save';
import { World } from '../sim/world';

describe('M7.6 UI-State im Savegame', () => {
  it('withUi bettet speed/overlay ein; readUi liest sie zurück', () => {
    const w = new World(42, 8, 8);
    const json = withUi(w.toJson(), { speed: 3, overlay: 'trade' });
    const ui = readUi(json);
    expect(ui).toEqual({ speed: 3, overlay: 'trade' });
    // Der Weltanteil bleibt unberührt lesbar
    expect(World.fromJson(json).tick).toBe(0);
  });

  it('ungültige Werte werden neutralisiert, fehlender ui-Block ergibt null', () => {
    const w = new World(42, 8, 8);
    const bad = withUi(w.toJson(), { speed: 99 as unknown as number, overlay: 42 as unknown as string });
    expect(readUi(bad)).toEqual({ speed: undefined, overlay: undefined });
    expect(readUi(w.toJson())).toBeNull();
    expect(readUi('kaputt')).toBeNull();
  });

  it('Roundtrip über two Stufen: json -> withUi -> readUi -> Welt unverändert', () => {
    const w = new World(7, 8, 8);
    w.enqueue({ kind: 'setTaxRate', rate: 0.5 });
    w.update();
    const json = withUi(w.toJson(), { speed: 10, overlay: 'zones' });
    const restored = World.fromJson(json);
    expect(restored.taxRate).toBe(0.5);
    expect(readUi(json)?.speed).toBe(10);
  });
});
