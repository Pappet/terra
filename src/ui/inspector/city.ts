/**
 * Inspektor-Tabs für eine ausgewählte Stadt (Kontext `city`): Übersicht,
 * Wirtschaft, Bevölkerung.
 */
import { GOODS } from '../../data/goods';
import { averageCommuteTime } from '../../sim/employment';
import { computeLandValue } from '../../sim/landvalue';
import {
  AGE_BRACKETS,
  EDUCATION_LEVELS,
  INCOME_LEVELS,
  cohortIndex,
} from '../../sim/population';
import { exportBalance, importBalance } from '../../sim/trade';
import type { World } from '../../sim/world';
import { formatFixed, formatInt, formatPercent } from '../format';
import { cityMetrics } from '../metrics';
import { KeyValueList, bar, el, sectionTitle } from '../widgets';
import type { InspectorContext, InspectorTab, TabInstance } from './registry';

const AGE_LABELS = ['0–14', '15–39', '40–64', '65+'] as const;
const EDU_LABELS = ['ohne', 'Grundbildung', 'Hochschule'] as const;
const INCOME_LABELS = ['niedrig', 'mittel', 'hoch'] as const;

function selectedCity(ctx: InspectorContext): number {
  return ctx.selection.kind === 'city' ? ctx.selection.cityId : 0;
}

class CityOverview implements TabInstance {
  private readonly kv = new KeyValueList();
  private readonly demand = el('div');

  constructor(host: HTMLElement) {
    host.append(sectionTitle('Stadt'), this.kv.root, sectionTitle('Nachfrage'), this.demand);
  }

  update(ctx: InspectorContext): void {
    const id = selectedCity(ctx);
    if (id === 0) return;
    const m = cityMetrics(ctx.world, id);
    this.kv.set('Einwohner', formatInt(m.residents));
    this.kv.set('Wohnraum', formatInt(m.capacity));
    this.kv.set('Arbeitsplätze', formatInt(m.jobs));
    this.kv.set('Zufriedenheit', formatPercent(m.satisfaction));
    this.kv.set('Bodenwert', formatPercent(computeLandValue(ctx.world, id)));
    this.kv.set('Wohnen / Gewerbe / Industrie', `${m.houses} / ${m.shops} / ${m.factories}`);
    this.kv.set('Gegründet', `Tick ${formatInt(ctx.world.cities.founded[id - 1] ?? 0)}`);

    this.demand.replaceChildren(
      ...demandRow('Wohnen', m.demand.residential, '#63c263'),
      ...demandRow('Gewerbe', m.demand.commercial, '#6f9be8'),
      ...demandRow('Industrie', m.demand.industrial, '#e0a83c'),
    );
  }
}

function demandRow(label: string, value: number, color: string): HTMLElement[] {
  const head = el('div', 'list-row');
  head.style.cursor = 'default';
  head.append(el('span', 'list-main', label), el('span', 'list-meta', formatPercent(value)));
  return [head, bar(value, color)];
}

class CityEconomy implements TabInstance {
  private readonly kv = new KeyValueList();
  private readonly goods = el('div');

  constructor(host: HTMLElement) {
    host.append(sectionTitle('Handelsbilanz'), this.kv.root, sectionTitle('Güter'), this.goods);
  }

  update(ctx: InspectorContext): void {
    const id = selectedCity(ctx);
    if (id === 0) return;
    const world = ctx.world;
    this.kv.set('Export (kumuliert)', formatInt(exportBalance(world, id)));
    this.kv.set('Import (kumuliert)', formatInt(importBalance(world, id)));

    const head = el('div', 'list-row');
    head.style.cursor = 'default';
    head.append(
      el('span', 'list-main muted', 'Gut'),
      el('span', 'list-meta', 'Lager · Preis · P/V'),
    );
    const rows: HTMLElement[] = [head];
    const market = world.market.city(id);
    for (const good of GOODS) {
      const amount = world.storage.amount(id, good.id);
      const price = world.market.price(id, good.id);
      const produced = market?.produced[good.id] ?? 0;
      const consumed = market?.consumed[good.id] ?? 0;
      const row = el('div', 'list-row');
      row.style.cursor = 'default';
      row.title = `Basispreis ${good.basePrice}`;
      row.append(
        el('span', 'list-main', good.name),
        el(
          'span',
          'list-meta',
          `${formatFixed(amount, 0)} · ${formatFixed(price, 1)} · ${formatFixed(produced, 1)}/${formatFixed(consumed, 1)}`,
        ),
      );
      rows.push(row);
    }
    this.goods.replaceChildren(...rows);
  }
}

class CityPopulation implements TabInstance {
  private readonly kv = new KeyValueList();
  private readonly ages = el('div');
  private readonly education = el('div');
  private readonly income = el('div');

  constructor(host: HTMLElement) {
    host.append(
      sectionTitle('Arbeitsmarkt'),
      this.kv.root,
      sectionTitle('Altersgruppen'),
      this.ages,
      sectionTitle('Bildung'),
      this.education,
      sectionTitle('Einkommen'),
      this.income,
    );
  }

  update(ctx: InspectorContext): void {
    const id = selectedCity(ctx);
    if (id === 0) return;
    const world = ctx.world;
    const m = cityMetrics(world, id);
    this.kv.set('Beschäftigt', formatInt(m.employed));
    this.kv.set('Arbeitslos', formatInt(m.unemployed));
    this.kv.set('Offene Stellen', formatInt(m.openJobs));
    this.kv.set('Ø Pendelzeit', `${formatFixed(averageCommuteTime(world, id), 1)} Ticks`);
    this.kv.set('Auspendler', formatInt(outCommuters(world, id)));

    const vec = world.population.city(id);
    const total = m.residents;
    this.ages.replaceChildren(...distribution(AGE_LABELS, (i) => sumCohort(vec, i, null, null), total));
    this.education.replaceChildren(...distribution(EDU_LABELS, (i) => sumCohort(vec, null, i, null), total));
    this.income.replaceChildren(...distribution(INCOME_LABELS, (i) => sumCohort(vec, null, null, i), total));
  }
}

/** Pendler, die in einer anderen Stadt arbeiten. */
function outCommuters(world: World, cityId: number): number {
  const flows = world.commute?.flows[cityId - 1];
  if (flows === undefined) return 0;
  let sum = 0;
  for (let job = 0; job < flows.length; job++) {
    if (job !== cityId - 1) sum += flows[job] ?? 0;
  }
  return sum;
}

/** Summe über den Kohortenvektor mit festgehaltener Dimension (null = alle). */
function sumCohort(
  vec: Float64Array | null,
  age: number | null,
  education: number | null,
  income: number | null,
): number {
  if (vec === null) return 0;
  let sum = 0;
  for (let a = 0; a < AGE_BRACKETS; a++) {
    if (age !== null && a !== age) continue;
    for (let e = 0; e < EDUCATION_LEVELS; e++) {
      if (education !== null && e !== education) continue;
      for (let i = 0; i < INCOME_LEVELS; i++) {
        if (income !== null && i !== income) continue;
        sum += vec[cohortIndex(a, e, i)] ?? 0;
      }
    }
  }
  return sum;
}

function distribution(
  labels: readonly string[],
  value: (index: number) => number,
  total: number,
): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  for (let i = 0; i < labels.length; i++) {
    const v = value(i);
    const row = el('div', 'list-row');
    row.style.cursor = 'default';
    row.append(
      el('span', 'list-main', labels[i] ?? String(i)),
      el('span', 'list-meta', `${formatInt(v)} · ${formatPercent(total > 0 ? v / total : 0)}`),
    );
    nodes.push(row, bar(total > 0 ? v / total : 0));
  }
  return nodes;
}

export const CITY_TABS: readonly InspectorTab[] = [
  { id: 'city-overview', label: 'Übersicht', context: 'city', create: (host) => new CityOverview(host) },
  { id: 'city-economy', label: 'Wirtschaft', context: 'city', create: (host) => new CityEconomy(host) },
  { id: 'city-population', label: 'Bevölkerung', context: 'city', create: (host) => new CityPopulation(host) },
];
