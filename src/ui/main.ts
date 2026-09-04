/**
 * Bootstrap: Welt + Loop + Kamera + Renderer, Eingabe-Bindung, rAF-Frame.
 * HUD-Panels und Persistenz folgen in M0.6.
 */
import { SIM_CONFIG, VIEW_CONFIG } from '../data/config';
import { Camera } from '../render/camera';
import { Renderer } from '../render/renderer';
import { SimLoop } from '../sim/loop';
import { World } from '../sim/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw !== null && raw !== '') {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return n >>> 0;
  }
  return SIM_CONFIG.defaultSeed;
}

const world = new World(seedFromUrl(), SIM_CONFIG.map.width, SIM_CONFIG.map.height);
const loop = new SimLoop(world, { now: () => performance.now() });
const camera = new Camera();
const renderer = new Renderer(canvas);

let viewportW = 1;
let viewportH = 1;

function speedLabel(): string {
  const s = loop.speed;
  return s === 0 ? 'Pause' : `${s}x`;
}

function updateStatus(fps: number): void {
  statusEl.textContent =
    `TERRA  Seed ${world.seed}  Tick ${world.tick}  ${speedLabel()}  ${fps} FPS\n` +
    `Linksklick/Ziehen: malen   Rechtsklick/Mitte: schwenken   Rad: zoomen   WASD/Pfeile: pan   +/-: Zoom   Leertaste: Pause`;
}

// ---------- Eingabe ----------

const pressedKeys = new Set<string>();

function togglePause(): void {
  loop.setSpeed(loop.speed === 0 ? 1 : 0);
}

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const factor = ev.deltaY < 0 ? VIEW_CONFIG.wheelZoomFactor : 1 / VIEW_CONFIG.wheelZoomFactor;
  camera.zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, factor);
}, { passive: false });

const mouse = { painting: false, panning: false, lastX: 0, lastY: 0, lastTile: -1 };

function tileUnder(ev: MouseEvent): number {
  const rect = canvas.getBoundingClientRect();
  const worldPos = camera.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
  const x = Math.floor(worldPos.x);
  const y = Math.floor(worldPos.y);
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return -1;
  return y * world.width + x;
}

canvas.addEventListener('mousedown', (ev) => {
  if (ev.button === 0) {
    mouse.painting = true;
    mouse.lastTile = tileUnder(ev);
    if (mouse.lastTile >= 0) {
      world.enqueue({ kind: 'paintTile', x: mouse.lastTile % world.width, y: Math.floor(mouse.lastTile / world.width), tile: 1 });
      loop.stepOnce();
    }
  } else if (ev.button === 1 || ev.button === 2) {
    mouse.panning = true;
    mouse.lastX = ev.clientX;
    mouse.lastY = ev.clientY;
  }
});

window.addEventListener('mousemove', (ev) => {
  if (mouse.painting) {
    const idx = tileUnder(ev);
    if (idx >= 0 && idx !== mouse.lastTile) {
      mouse.lastTile = idx;
      world.enqueue({ kind: 'paintTile', x: idx % world.width, y: Math.floor(idx / world.width), tile: 1 });
      loop.stepOnce();
    }
  } else if (mouse.panning) {
    camera.panByPixels(ev.clientX - mouse.lastX, ev.clientY - mouse.lastY);
    mouse.lastX = ev.clientX;
    mouse.lastY = ev.clientY;
  }
});

window.addEventListener('mouseup', () => {
  mouse.painting = false;
  mouse.panning = false;
  mouse.lastTile = -1;
});

window.addEventListener('keydown', (ev) => {
  const key = ev.key;
  pressedKeys.add(key.toLowerCase());
  if (key === ' ') {
    ev.preventDefault();
    togglePause();
  } else if (key === '1') {
    loop.setSpeed(1);
  } else if (key === '2') {
    loop.setSpeed(3);
  } else if (key === '3') {
    loop.setSpeed(10);
  } else if (key === '+' || key === '=') {
    camera.zoomAt(viewportW / 2, viewportH / 2, VIEW_CONFIG.wheelZoomFactor);
  } else if (key === '-') {
    camera.zoomAt(viewportW / 2, viewportH / 2, 1 / VIEW_CONFIG.wheelZoomFactor);
  }
});

window.addEventListener('keyup', (ev) => {
  pressedKeys.delete(ev.key.toLowerCase());
});

// ---------- Frame ----------

let lastFrameMs = performance.now();
let fpsCount = 0;
let fpsWindowStart = lastFrameMs;
let fps = 0;
let statusClock = 0;

function handleKeyPan(dtSec: number): void {
  let dx = 0;
  let dy = 0;
  if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) dx -= 1;
  if (pressedKeys.has('d') || pressedKeys.has('arrowright')) dx += 1;
  if (pressedKeys.has('w') || pressedKeys.has('arrowup')) dy -= 1;
  if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) dy += 1;
  if (dx !== 0 || dy !== 0) {
    const dist = VIEW_CONFIG.keyPanTilesPerSecond * dtSec;
    camera.panByTiles(dx * dist, dy * dist);
  }
}

function frame(nowMs: number): void {
  const dtSec = Math.min(0.25, Math.max(0, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;

  loop.update();
  handleKeyPan(dtSec);
  camera.clampToMap(world.width, world.height);
  camera.setViewport(viewportW, viewportH);
  renderer.draw(camera);

  fpsCount++;
  if (nowMs - fpsWindowStart >= 500) {
    fps = Math.round((fpsCount * 1000) / (nowMs - fpsWindowStart));
    fpsCount = 0;
    fpsWindowStart = nowMs;
  }
  statusClock += dtSec;
  if (statusClock >= 0.25) {
    statusClock = 0;
    updateStatus(fps);
  }

  requestAnimationFrame(frame);
}

function resize(): void {
  viewportW = canvas.clientWidth;
  viewportH = canvas.clientHeight;
  camera.setViewport(viewportW, viewportH);
  camera.clampToMap(world.width, world.height);
}

window.addEventListener('resize', resize);
resize();
updateStatus(0);
requestAnimationFrame(frame);
