import { it } from 'vitest';
import { World } from '../src/sim/world';
import { FINANCE } from '../src/data/cities';
import { cohortIndex, AGE_TICK_INTERVAL } from '../src/sim/population';
import { computeSatisfaction } from '../src/sim/demographics';

it('dbg6', () => {
  const w = new World(42, 128, 128);
  let center = -1;
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.layers.water[i] === 0) { center = i; break; }
  }
  const cx = center % w.width;
  const cy = Math.floor(center / w.width);
  w.enqueue({ kind: 'foundCity', x: cx, y: cy, name: 'T' });
  w.update();
  const spots: Array<{ x: number; y: number }> = [];
  for (let dy = -3; dy <= 3 && spots.length < 6; dy++) {
    for (let dx = -3; dx <= 3 && spots.length < 6; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w.width - 1 || y >= w.height - 1) continue;
      const idx = y * w.width + x;
      const below = idx + w.width;
      if (w.layers.water[idx] === 0 && w.layers.water[below] === 0) spots.push({ x, y });
    }
  }
  console.log('spots', spots.length);
  for (const [n, s2] of spots.entries()) {
    const type = n === 5 ? 2 : 1;
    w.addBuildingAt(1, s2.x, s2.y, type, -1);
    w.enqueue({ kind: 'buildRoad', x: s2.x, y: s2.y + 1, road: 2 });
  }
  w.update();
  w.settleResidents(1, cohortIndex(1, 0, 0), 20);
  const before = w.treasury;
  console.log('before', before.toFixed(2), 'tick', w.tick, 'sat', computeSatisfaction(w, 1).toFixed(3), 'res', w.population.total(1));
  let lastTreasury = before;
  let lastTick = w.tick;
  for (let t = 0; t < 200; t++) {
    w.update();
    if (w.tick % AGE_TICK_INTERVAL === 0) {
      console.log('interval at tick', w.tick, 'delta since last', (w.treasury - lastTreasury).toFixed(2), 'taxes≈', (w.treasury - lastTreasury - w.upkeepPerTick * (w.tick - lastTick)).toFixed(2), 'res', w.population.total(1).toFixed(1), 'sat', computeSatisfaction(w, 1).toFixed(3), 'employed', w.commute?.employed[0]);
      lastTreasury = w.treasury;
      lastTick = w.tick;
    }
  }
  console.log('end', w.treasury.toFixed(2), 'upkeep', w.upkeepPerTick.toFixed(3), 'config tax', FINANCE.taxPerAdultPerInterval);
  void FINANCE;
});
