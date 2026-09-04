import { it, expect } from 'vitest';
import { World, equalWorlds } from '../src/sim/world';
import { ROAD_TYPES } from '../src/data/roads';

it('debug roundtrip', () => {
  const w = new World(42, 128, 128);
  let placed = 0;
  for (const road of ROAD_TYPES) {
    for (let i = 0; i < w.layers.water.length; i++) {
      if (w.layers.water[i] === 0 && w.roads[i] === 0) {
        w.enqueue({ kind: 'buildRoad', x: i % w.width, y: Math.floor(i / w.width), road: road.id });
        placed++;
        break;
      }
    }
  }
  w.update();
  const restored = World.fromJson(w.toJson());
  console.log('placed', placed, 'tick', w.tick, restored.tick, 'treasury', w.treasury, restored.treasury);
  console.log('roads equal', Array.from(w.roads).join() === Array.from(restored.roads).join());
  console.log('tiles equal', Array.from(w.tiles).join() === Array.from(restored.tiles).join());
  console.log('equalWorlds', equalWorlds(w, restored));
  for (const k of ['elevation', 'water', 'river', 'fertility', 'forest', 'deposits'] as const) {
    const a = w.layers[k];
    const b = restored.layers[k];
    let diff = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diff = i;
        break;
      }
    }
    console.log('layer', k, 'first diff at', diff);
  }
  expect(true).toBe(true);
});
