import { it } from 'vitest';
import { lineWorld } from './fakes';

it('dbg11', () => {
  const w = lineWorld({ width: 9, roadType: 1, production: true });
  w.cities.found('A', 0, 0, 0);
  w.cities.found('B', 8, 0, 0);
  w.population.ensureCity(1);
  w.population.ensureCity(2);
  w.storage.add(1, 1, 100);
  w.storage.add(1, 2, 100);
  for (let t = 0; t < 60; t++) w.update();
  for (const s of [1, 2]) {
    w.storage.take(2, s, w.storage.amount(2, s));
  }
  for (let t = 0; t < 40; t++) {
    w.update();
    const flows = w.trade.flows[0]![1]!;
    const sum = flows.reduce((a, b) => a + (b ?? 0), 0);
    if (sum > 0) {
      console.log(
        't+' + (t + 1),
        'wood', flows[1]?.toFixed(1),
        'stone', flows[2]?.toFixed(1),
        'sum', sum.toFixed(1),
        'routes', w.trade.routes.length,
        'caps', w.trade.routes.map((r) => r.capacity + '/' + r.from + '->' + r.to).join(' '),
        'stockB', w.storage.amount(2, 1).toFixed(1), w.storage.amount(2, 2).toFixed(1),
      );
    }
  }
});
