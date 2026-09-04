/**
 * Bootstrap: Welt + Loop + Kamera + Renderer + HUD + Eingabe, rAF-Frame.
 * Sim-Zugriff läuft ausschliesslich über Actions; das HUD liest nur Zustand.
 */
import { SIM_CONFIG, VIEW_CONFIG } from '../data/config';
import { Camera } from '../render/camera';
import { Renderer } from '../render/renderer';
import { SimLoop } from '../sim/loop';
import { World } from '../sim/world';
import { exportToFile, importFromFile, loadFromBrowser, saveToBrowser } from '../persist/save';
import { Hud } from './hud';
import { attachInput } from './input';

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw !== null && raw !== '') {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return n >>> 0;
  }
  return SIM_CONFIG.defaultSeed;
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudContainer = document.getElementById('hud') as HTMLDivElement;

const initialWorld = new World(seedFromUrl(), SIM_CONFIG.map.width, SIM_CONFIG.map.height);
let currentWorld: World = initialWorld;
const loop = new SimLoop(initialWorld, { now: () => performance.now() });
const camera = new Camera();
const renderer = new Renderer(canvas);

let activePaintTile = 1;

function speedLabel(): string {
  return loop.speed === 0 ? 'Pause' : `${loop.speed}x`;
}

function applySpeed(speed: number): void {
  loop.setSpeed(speed);
  hud.setActiveSpeed(loop.speed);
}

function applyLoadedWorld(next: World): void {
  loop.setWorld(next);
  renderer.setWorld(next);
  currentWorld = next;
  camera.clampToMap(next.width, next.height);
  hud.flash(`Welt geladen: Seed ${next.seed}, Tick ${next.tick}`);
}

const hud = new Hud(hudContainer, {
  onSpeed: applySpeed,
  onPaintTile: (tileId) => {
    activePaintTile = tileId;
    hud.setActivePaintTile(tileId);
  },
  onSave: () => {
    saveToBrowser(currentWorld)
      .then(() => hud.flash(`Gespeichert (Tick ${currentWorld.tick})`))
      .catch((err: unknown) => hud.flash(`Speichern fehlgeschlagen: ${String(err)}`));
  },
  onLoad: () => {
    loadFromBrowser()
      .then(applyLoadedWorld)
      .catch((err: unknown) => hud.flash(`Laden fehlgeschlagen: ${String(err)}`));
  },
  onExport: () => {
    exportToFile(currentWorld);
    hud.flash('Export gestartet');
  },
  onImport: (file) => {
    importFromFile(file)
      .then(applyLoadedWorld)
      .catch((err: unknown) => hud.flash(`Import fehlgeschlagen: ${String(err)}`));
  },
});

const input = attachInput(canvas, {
  camera,
  getMapSize: () => ({ width: currentWorld.width, height: currentWorld.height }),
  paintAt: (tileIndex) => {
    currentWorld.enqueue({
      kind: 'paintTile',
      x: tileIndex % currentWorld.width,
      y: Math.floor(tileIndex / currentWorld.width),
      tile: activePaintTile,
    });
    loop.stepOnce();
  },
  togglePause: () => applySpeed(loop.speed === 0 ? 1 : 0),
  setSpeed: applySpeed,
});

// ---------- Frame ----------

let lastFrameMs = performance.now();
let fpsCount = 0;
let fpsWindowStart = lastFrameMs;
let fps = 0;
let statusClock = 0;

function frame(nowMs: number): void {
  const dtSec = Math.min(0.25, Math.max(0, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;

  loop.update();

  const { dx, dy } = input.getKeyPanDir();
  if (dx !== 0 || dy !== 0) {
    const dist = VIEW_CONFIG.keyPanTilesPerSecond * dtSec;
    camera.panByTiles(dx * dist, dy * dist);
  }
  camera.clampToMap(currentWorld.width, currentWorld.height);
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
    hud.setInfo(
      `TERRA  Seed ${currentWorld.seed}  Tick ${currentWorld.tick}  ${speedLabel()}  ${fps} FPS`,
    );
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
