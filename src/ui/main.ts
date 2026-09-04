/**
 * Bootstrap: Welt + Loop + Kamera + Renderer + HUD + Eingabe, rAF-Frame.
 * Sim-Zugriff läuft ausschliesslich über Actions; das HUD liest nur Zustand.
 */
import { SIM_CONFIG, VIEW_CONFIG } from '../data/config';
import { OVERLAYS } from '../data/overlays';
import { Camera } from '../render/camera';
import { Minimap } from '../render/minimap';
import { Renderer } from '../render/renderer';
import { SimLoop } from '../sim/loop';
import { World } from '../sim/world';
import { exportToFile, importFromFile, loadFromBrowser, saveToBrowser } from '../persist/save';
import { Hud } from './hud';
import { attachInput } from './input';

type ToolId = 'paint' | 'road' | 'demolish' | 'route' | 'zone';

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
const minimap = new Minimap(document.body);
minimap.setWorld(initialWorld);

let activePaintTile = 1;
let activeOverlay = 'surface';
let activeTool: ToolId = 'road';
let activeRoadType = 2;
let activeZone = 1;
let routeFrom: number | null = null;

// Minimap: Klick/Drag zentriert die Kamera
let minimapDragging = false;
function jumpTo(ev: MouseEvent): void {
  const pos = minimap.screenToWorld(ev.clientX, ev.clientY);
  camera.x = pos.x;
  camera.y = pos.y;
  camera.clampToMap(currentWorld.width, currentWorld.height);
}
minimap.canvas.addEventListener('mousedown', (ev) => {
  minimapDragging = true;
  jumpTo(ev);
});
window.addEventListener('mousemove', (ev) => {
  if (minimapDragging) jumpTo(ev);
});
window.addEventListener('mouseup', () => {
  minimapDragging = false;
});

function cycleOverlay(): void {
  const idx = OVERLAYS.findIndex((o) => o.id === activeOverlay);
  const next = OVERLAYS[(idx + 1) % OVERLAYS.length] as (typeof OVERLAYS)[number];
  applyOverlay(next.id);
}

function applyOverlay(overlayId: string): void {
  activeOverlay = overlayId;
  hud.setActiveOverlay(overlayId);
}

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
  minimap.setWorld(next);
  currentWorld = next;
  routeFrom = null;
  camera.clampToMap(next.width, next.height);
  hud.flash(`Welt geladen: Seed ${next.seed}, Tick ${next.tick}`);
}

const hud = new Hud(hudContainer, {
  onSpeed: applySpeed,
  onOverlay: applyOverlay,
  onTool: (toolId) => {
    activeTool = toolId as ToolId;
    hud.setActiveTool(toolId);
    routeFrom = null;
  },
  onRoadType: (roadId) => {
    activeRoadType = roadId;
    hud.setActiveRoadType(roadId);
  },
  onZoneType: (zone) => {
    activeZone = zone;
    hud.setActiveZoneType(zone);
  },
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
    const x = tileIndex % currentWorld.width;
    const y = Math.floor(tileIndex / currentWorld.width);
    switch (activeTool) {
      case 'paint':
        currentWorld.enqueue({ kind: 'paintTile', x, y, tile: activePaintTile });
        break;
      case 'road':
        currentWorld.enqueue({ kind: 'buildRoad', x, y, road: activeRoadType });
        break;
      case 'zone':
        currentWorld.enqueue({ kind: 'paintZone', x, y, zone: activeZone });
        break;
      case 'demolish':
        currentWorld.enqueue({ kind: 'demolishRoad', x, y });
        break;
      case 'route': {
        if (routeFrom === null) {
          routeFrom = tileIndex;
          currentWorld.enqueue({ kind: 'clearRoute' });
        } else {
          currentWorld.enqueue({ kind: 'requestRoute', from: routeFrom, to: tileIndex });
          routeFrom = null;
        }
        break;
      }
    }
    loop.stepOnce();
  },
  togglePause: () => applySpeed(loop.speed === 0 ? 1 : 0),
  setSpeed: applySpeed,
});

window.addEventListener('keydown', (ev) => {
  if (ev.key === 'o' || ev.key === 'O') cycleOverlay();
});

// ---------- Frame ----------

let lastFrameMs = performance.now();
let fpsCount = 0;
let fpsWindowStart = lastFrameMs;
let fps = 0;
let statusClock = 0;
let lastShownRejected: string | null = null;

function routeInfoText(): string {
  const route = currentWorld.route;
  const finance = `Kasse ${Math.floor(currentWorld.treasury)} (Unterhalt ${currentWorld.upkeepPerTick.toFixed(2)}/Tick)`;
  if (route === null) return `  |  ${finance}`;
  const seconds = Math.round((route.timeTicks / 20) * 10) / 10;
  return `  |  ${finance}  |  Route: ${route.path.length} Tiles, ${route.timeTicks.toFixed(1)} Ticks (~${seconds} s bei 1x)`;
}

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
  renderer.draw(camera, activeOverlay);
  minimap.draw(camera, activeOverlay);

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
      `TERRA  Seed ${currentWorld.seed}  Tick ${currentWorld.tick}  ${speedLabel()}  ${fps} FPS` +
        routeInfoText(),
    );
  }
  if (currentWorld.lastRejected !== lastShownRejected) {
    lastShownRejected = currentWorld.lastRejected;
    if (lastShownRejected !== null) hud.flash(lastShownRejected);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
