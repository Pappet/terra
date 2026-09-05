/**
 * Inspektor für ein einzelnes Tile (Kontext `tile`). Macht die abgeleiteten
 * M8-Layer (Verschmutzung, Versorgung) endlich punktgenau ablesbar.
 */
import { ZONE_COLORS } from '../../data/cities';
import { DEPOSIT_DEFS } from '../../data/deposits';
import { RECIPE_BY_ID } from '../../data/goods';
import { ROAD_BY_ID } from '../../data/roads';
import { TILE_TYPES } from '../../data/tiles';
import { formatFixed, formatInt, formatPercent } from '../format';
import { KeyValueList, el, sectionTitle } from '../widgets';
import type { InspectorContext, InspectorTab, TabInstance } from './registry';

const ZONE_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Wohnen'],
  [2, 'Gewerbe'],
  [3, 'Industrie'],
]);

const BUILDING_NAMES: ReadonlyMap<number, string> = new Map([
  [1, 'Wohnhaus'],
  [2, 'Gewerbe'],
  [3, 'Industrie'],
]);

class TileInfo implements TabInstance {
  private readonly terrain = new KeyValueList();
  private readonly usage = new KeyValueList();
  private readonly buildingHost = el('div');

  constructor(host: HTMLElement) {
    host.append(
      sectionTitle('Untergrund'),
      this.terrain.root,
      sectionTitle('Nutzung'),
      this.usage.root,
      this.buildingHost,
    );
  }

  update(ctx: InspectorContext): void {
    if (ctx.selection.kind !== 'tile') return;
    const world = ctx.world;
    const idx = ctx.selection.index;
    if (idx < 0 || idx >= world.width * world.height) return;

    const tileId = world.tiles[idx] ?? 0;
    this.terrain.set('Typ', TILE_TYPES.find((t) => t.id === tileId)?.name ?? String(tileId));
    this.terrain.set('Höhe', formatInt(world.layers.elevation[idx] ?? 0));
    this.terrain.set('Fruchtbarkeit', formatPercent((world.layers.fertility[idx] ?? 0) / 255));
    this.terrain.set('Wald', (world.layers.forest[idx] ?? 0) === 1 ? 'ja' : 'nein');
    this.terrain.set(
      'Wasser',
      (world.layers.river[idx] ?? 0) === 1 ? 'Fluss' : (world.layers.water[idx] ?? 0) === 1 ? 'See/Meer' : 'nein',
    );
    this.terrain.set('Vorkommen', depositNames(world.layers.deposits[idx] ?? 0));

    const road = ROAD_BY_ID.get(world.roads[idx] ?? 0);
    const zone = world.zoneType[idx] ?? 0;
    const zoneCity = world.zoneCity[idx] ?? 0;
    this.usage.set('Position', `${idx % world.width}, ${Math.floor(idx / world.width)}`);
    this.usage.set('Strasse', road?.name ?? '–');
    this.usage.set(
      'Zone',
      zone === 0 ? '–' : `${ZONE_NAMES.get(zone) ?? String(zone)}${zoneCity > 0 ? ` (${world.cities.names[zoneCity - 1] ?? zoneCity})` : ''}`,
    );
    this.usage.set('Verschmutzung', formatPercent((world.pollution[idx] ?? 0) / 255));
    this.usage.set('Versorgung', (world.supply[idx] ?? 0) === 1 ? 'angeschlossen' : 'ohne Netz');

    const zoneColor = ZONE_COLORS.get(zone);
    this.usage.root.style.borderLeft = zoneColor === undefined ? '' : `2px solid ${zoneColor}`;
    this.usage.root.style.paddingLeft = zoneColor === undefined ? '' : '6px';

    this.renderBuilding(ctx, idx);
  }

  private renderBuilding(ctx: InspectorContext, idx: number): void {
    const world = ctx.world;
    const buildingId = world.buildingIndex[idx] ?? 0;
    if (buildingId <= 0) {
      this.buildingHost.replaceChildren();
      return;
    }
    const i = buildingId - 1;
    const kv = new KeyValueList();
    const type = world.buildings.type[i] ?? 0;
    const recipe = world.buildings.recipe[i] ?? -1;
    kv.set('Art', BUILDING_NAMES.get(type) ?? String(type));
    kv.set('Zustand', formatPercent(world.buildings.condition[i] ?? 0));
    kv.set('Stufe', formatFixed(world.buildings.level[i] ?? 1, 0));
    kv.set('Betrieb', recipe < 0 ? '–' : RECIPE_BY_ID.get(recipe)?.name ?? String(recipe));
    this.buildingHost.replaceChildren(sectionTitle('Gebäude'), kv.root);
  }
}

function depositNames(bits: number): string {
  const names = DEPOSIT_DEFS.filter((d) => (bits & d.bit) !== 0).map((d) => d.name);
  return names.length === 0 ? '–' : names.join(', ');
}

export const TILE_TABS: readonly InspectorTab[] = [
  { id: 'tile-info', label: 'Tile', context: 'tile', create: (host) => new TileInfo(host) },
];
