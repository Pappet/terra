import { describe, expect, it } from 'vitest';
import { SimLoop } from './loop';
import { World } from './world';

/** Manuelle Uhr für deterministische Loop-Tests. */
function manualClock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function makeLoop(clock: ReturnType<typeof manualClock>, world: World, ticksPerSecond = 20) {
  const loop = new SimLoop(world, { now: clock.now, ticksPerSecond });
  loop.update(); // Warm-up: erster Aufruf setzt nur die Zeitbasis (First-Frame-Guard)
  return loop;
}

describe('SimLoop', () => {
  it('1x: 1000 ms = ticksPerSecond Ticks', () => {
    const clock = manualClock();
    const world = new World(1, 4, 4);
    const loop = makeLoop(clock, world);
    for (let i = 0; i < 20; i++) {
      clock.advance(50);
      loop.update();
    }
    expect(world.tick).toBe(20);
  });

  it('3x und 10x multiplizieren die Tickrate', () => {
    const clock = manualClock();
    const w3 = new World(1, 4, 4);
    const l3 = makeLoop(clock, w3);
    l3.setSpeed(3);
    clock.advance(50);
    l3.update();
    expect(w3.tick).toBe(3);

    const clock2 = manualClock();
    const w10 = new World(1, 4, 4);
    const l10 = makeLoop(clock2, w10);
    l10.setSpeed(10);
    clock2.advance(1000);
    l10.update();
    expect(w10.tick).toBe(200);
  });

  it('Pause (0x) tickt nicht und staut keine Zeit auf', () => {
    const clock = manualClock();
    const world = new World(1, 4, 4);
    const loop = makeLoop(clock, world);
    loop.setSpeed(0);
    clock.advance(5000);
    loop.update();
    expect(world.tick).toBe(0);

    loop.setSpeed(1);
    clock.advance(50);
    loop.update();
    expect(world.tick).toBe(1); // kein Nachhol-Burst von 100 Ticks
  });

  it('kurze Frames akkumulieren korrekt (Teilticks bleiben erhalten)', () => {
    const clock = manualClock();
    const world = new World(1, 4, 4);
    const loop = makeLoop(clock, world, 10); // 100 ms pro Tick
    clock.advance(40);
    loop.update();
    expect(world.tick).toBe(0);
    clock.advance(40);
    loop.update();
    expect(world.tick).toBe(0);
    clock.advance(40);
    loop.update();
    expect(world.tick).toBe(1); // 120 ms akkumuliert -> 1 Tick, Rest bleibt
    clock.advance(60);
    loop.update();
    expect(world.tick).toBe(1); // 80 ms < 100 ms
    clock.advance(30);
    loop.update();
    expect(world.tick).toBe(2);
  });

  it('Catch-up-Deckel: nach langer Pause nur maxTicksPerFrame, Rest verworfen', () => {
    const clock = manualClock();
    const world = new World(1, 4, 4);
    const loop = new SimLoop(world, { now: clock.now, ticksPerSecond: 20, maxTicksPerFrame: 10 });
    loop.update(); // Warm-up
    clock.advance(10_000);
    loop.update();
    expect(world.tick).toBe(10);

    clock.advance(0);
    loop.update();
    expect(world.tick).toBe(10); // kein gestauter Rest
  });

  it('Actionen laufen über den Loop identisch wie über direkte Ticks', () => {
    const clock = manualClock();
    const world = new World(1, 4, 4);
    const loop = makeLoop(clock, world);
    world.enqueue({ kind: 'paintTile', x: 1, y: 1, tile: 4 });
    clock.advance(50);
    loop.update();
    expect(world.tiles[5]).toBe(4);
    expect(world.tick).toBe(1);
  });

  it('unbekannte Geschwindigkeitsstufe wirft', () => {
    const clock = manualClock();
    const world = new World(1, 4, 4);
    const loop = makeLoop(clock, world);
    expect(() => loop.setSpeed(5)).toThrow(/Geschwindigkeit/);
    expect(() => loop.setSpeed(-1)).toThrow(/Geschwindigkeit/);
  });

  it('zwei Welten mit gleichem Seed und gleichen Stufen sind nach Loop-Lauf identisch', () => {
    const run = (): World => {
      const clock = manualClock();
      const world = new World(9, 8, 8);
      const loop = makeLoop(clock, world);
      const paints: Array<[number, number]> = [[0, 0], [3, 2], [7, 7]];
      let nextPaint = 0;
      for (let frame = 0; frame < 100; frame++) {
        clock.advance(25);
        if (frame % 7 === 0 && nextPaint < paints.length) {
          const [x, y] = paints[nextPaint++]!;
          world.enqueue({ kind: 'paintTile', x, y, tile: (frame % 4) + 1 });
        }
        loop.update();
      }
      return world;
    };
    const a = run();
    const b = run();
    expect(b.toJson()).toBe(a.toJson());
  });
});
