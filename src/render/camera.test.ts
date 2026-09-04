import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

function camera(): Camera {
  const c = new Camera();
  c.setViewport(800, 600);
  return c;
}

describe('Camera', () => {
  it('worldToScreen und screenToWorld sind zueinander invers', () => {
    const c = camera();
    c.x = 42.5;
    c.y = -13.25;
    c.zoom = 7;
    const world = c.screenToWorld(300, 210);
    const screen = c.worldToScreen(world.x, world.y);
    expect(screen.x).toBeCloseTo(300, 9);
    expect(screen.y).toBeCloseTo(210, 9);
  });

  it('Sichtfeld-Zentrum liegt in der Bildschirmmitte', () => {
    const c = camera();
    const center = c.worldToScreen(c.x, c.y);
    expect(center.x).toBe(400);
    expect(center.y).toBe(300);
  });

  it('zoomAt hält den Punkt unterm Cursor ortsfest', () => {
    const c = camera();
    c.x = 30;
    c.y = 30;
    c.zoom = 4;
    const sx = 650;
    const sy = 120;
    const before = c.screenToWorld(sx, sy);
    c.zoomAt(sx, sy, 2);
    const after = c.screenToWorld(sx, sy);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(c.zoom).toBe(8);
  });

  it('zoomAt respektiert die Zoomgrenzen', () => {
    const c = camera();
    c.zoomAt(400, 300, 1_000_000);
    expect(c.zoom).toBe(c.maxZoom);
    c.zoomAt(400, 300, 1 / 1_000_000);
    expect(c.zoom).toBe(c.minZoom);
  });

  it('panByPixels bewegt die Kamera gegenläufig zum Ziehen', () => {
    const c = camera();
    c.zoom = 4;
    c.panByPixels(40, -20);
    expect(c.x).toBeCloseTo(-10);
    expect(c.y).toBeCloseTo(5);
  });

  it('clampToMap hält das Zentrum innerhalb der Karte', () => {
    const c = camera();
    c.x = -50;
    c.y = 9999;
    c.clampToMap(128, 128);
    expect(c.x).toBe(0);
    expect(c.y).toBe(128);
  });
});
