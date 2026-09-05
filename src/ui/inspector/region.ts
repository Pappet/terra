/**
 * Inspektor-Tabs ohne Selektion (Kontext `region`): Übersicht, Budget,
 * Statistik. Zeigt, was für die ganze Karte gilt.
 */
import { FINANCE } from '../../data/cities';
import { AGE_TICK_INTERVAL } from '../../sim/population';
import { drawHistoryChart } from '../chart';
import { formatFixed, formatInt, formatPercent, formatSigned, signClass } from '../format';
import { cityMetrics, regionMetrics } from '../metrics';
import { KeyValueList, button, el, sectionTitle } from '../widgets';
import type { InspectorContext, InspectorTab, TabInstance } from './registry';

const TAX_RATES: readonly number[] = [0, 0.25, 0.5, 0.75, 1];
const LOAN_STEP = 500;

class RegionOverview implements TabInstance {
  private readonly kv = new KeyValueList();
  private readonly list = el('div');

  constructor(host: HTMLElement) {
    host.append(sectionTitle('Region'), this.kv.root, sectionTitle('Städte'), this.list);
  }

  update(ctx: InspectorContext): void {
    const m = regionMetrics(ctx.world);
    this.kv.set('Städte', formatInt(m.cities));
    this.kv.set('Einwohner', formatInt(m.residents));
    this.kv.set('Wohnraum', formatInt(m.capacity));
    this.kv.set('Arbeitsplätze', formatInt(m.jobs));
    this.kv.set('Gebäude', formatInt(m.buildings));
    this.kv.set('Ø Zufriedenheit', formatPercent(m.satisfaction));

    if (ctx.world.cities.count === 0) {
      this.list.replaceChildren(
        el('div', 'empty', 'Noch keine Stadt. Werkzeug „Gründen" [2] wählen und auf Land klicken.'),
      );
      return;
    }

    const rows: HTMLElement[] = [];
    for (let c = 1; c <= ctx.world.cities.count; c++) {
      const city = cityMetrics(ctx.world, c);
      const row = el('div', 'list-row');
      row.append(
        el('span', 'list-main', city.name),
        el('span', 'list-meta', `${formatInt(city.residents)} EW · ${formatPercent(city.satisfaction)}`),
      );
      row.title = 'Klicken: auswählen und Kamera zentrieren';
      row.addEventListener('click', () => {
        ctx.selectCity(c);
        ctx.jumpTo(ctx.world.cities.x[c - 1] ?? 0, ctx.world.cities.y[c - 1] ?? 0);
      });
      rows.push(row);
    }
    this.list.replaceChildren(...rows);
  }
}

class RegionBudget implements TabInstance {
  private readonly kv = new KeyValueList();
  private readonly taxButtons = new Map<number, HTMLButtonElement>();
  private readonly loanRow = el('div', 'button-row');

  constructor(host: HTMLElement) {
    host.append(sectionTitle('Haushalt'), this.kv.root);

    host.append(sectionTitle('Steuersatz'));
    const taxRow = el('div', 'button-row');
    for (const rate of TAX_RATES) {
      const b = button(
        `${Math.round(rate * 100)}%`,
        () => this.onRate?.(rate),
        `Steuereinnahmen auf ${Math.round(rate * 100)} % der Basis`,
      );
      this.taxButtons.set(rate, b);
      taxRow.append(b);
    }
    host.append(taxRow);

    host.append(sectionTitle('Kredit'), this.loanRow);
  }

  /** Wird bei jedem update() neu gesetzt: der Kontext kann wechseln. */
  private onRate: ((rate: number) => void) | null = null;

  update(ctx: InspectorContext): void {
    const world = ctx.world;
    const m = regionMetrics(world);
    this.kv.set('Kasse', formatInt(world.treasury), signClass(world.treasury));
    this.kv.set(`Steuern / ${AGE_TICK_INTERVAL} Ticks`, formatFixed(m.taxIncome, 1));
    this.kv.set('Unterhalt Strassen', `${formatFixed(m.roadUpkeep)}/Tick`);
    this.kv.set('Unterhalt Gebäude', `${formatFixed(m.buildingUpkeep)}/Tick`);
    this.kv.set('Netto', `${formatSigned(m.netPerTick)}/Tick`, signClass(m.netPerTick));
    this.kv.set('Schulden', formatInt(world.debt), world.debt > 0 ? 'warn' : '');
    this.kv.set('Kreditlimit', formatInt(world.maxDebt));
    this.kv.set('Zins', `${formatPercent(FINANCE.loanInterestPerInterval)} / Intervall`);
    this.kv.set('Status', world.bankrupt ? 'BANKROTT' : 'in Ordnung', world.bankrupt ? 'neg' : 'pos');

    this.onRate = (rate) => ctx.dispatch({ kind: 'setTaxRate', rate });
    for (const [rate, b] of this.taxButtons) b.classList.toggle('active', rate === world.taxRate);

    const canBorrow = world.debt + LOAN_STEP <= world.maxDebt;
    const canRepay = world.debt > 0 && world.treasury >= 1;
    const borrow = button(`+${LOAN_STEP} aufnehmen`, () => ctx.dispatch({ kind: 'takeLoan', amount: LOAN_STEP }));
    borrow.disabled = !canBorrow;
    const repay = button(
      `${Math.min(LOAN_STEP, Math.ceil(world.debt))} tilgen`,
      () => ctx.dispatch({ kind: 'repayLoan', amount: Math.min(LOAN_STEP, Math.ceil(world.debt)) }),
    );
    repay.disabled = !canRepay;
    this.loanRow.replaceChildren(borrow, repay);
  }
}

class RegionStats implements TabInstance {
  private readonly canvas = el('canvas', 'chart');

  constructor(host: HTMLElement) {
    this.canvas.width = 300;
    this.canvas.height = 200;
    host.append(sectionTitle('Zeitreihen (letzte 200 Intervalle)'), this.canvas);
    const legend = el('div', 'empty', `Ein Intervall = ${AGE_TICK_INTERVAL} Ticks (10 s bei 1x).`);
    host.append(legend);
  }

  update(ctx: InspectorContext): void {
    drawHistoryChart(this.canvas, ctx.world.history);
  }
}

export const REGION_TABS: readonly InspectorTab[] = [
  { id: 'region-overview', label: 'Übersicht', context: 'region', create: (host) => new RegionOverview(host) },
  { id: 'region-budget', label: 'Budget', context: 'region', create: (host) => new RegionBudget(host) },
  { id: 'region-stats', label: 'Statistik', context: 'region', create: (host) => new RegionStats(host) },
];
