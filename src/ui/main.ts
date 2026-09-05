/**
 * Bootstrap (M10.0): Welt + Loop + Kamera + Renderer + Shell + Eingabe.
 *
 * main verdrahtet nur – die Panels bauen ihr DOM selbst, der Sim-Zugriff läuft
 * ausschliesslich über Actions, und gelesen wird der Weltzustand nur zur
 * Anzeige (siehe ARCHITECTURE.md, Leser/Schreiber-Regel).
 */
import { SIM_CONFIG, VIEW_CONFIG } from '../data/config';
import { OVERLAYS } from '../data/overlays';
import { TILE_TYPES } from '../data/tiles';
import { DEFAULT_TOOL, type ToolId } from '../data/tools';
import { Camera } from '../render/camera';
import { Minimap } from '../render/minimap';
import { Renderer } from '../render/renderer';
import { SimLoop } from '../sim/loop';
import type { GameAction } from '../sim/actions';
import { World } from '../sim/world';
import { exportToFile, importFromFile, loadFromBrowser, saveToBrowser } from '../persist/save';
import { Dock } from './dock';
import { formatFixed, formatInt } from './format';
import { attachInput } from './input';
import { regionMetrics } from './metrics';
import { createShell } from './shell';
import { attachShortcuts } from './shortcuts';
import { StatusBar } from './statusbar';
import { Topbar } from './topbar';
import { ToolOptions } from './tooloptions';
import { ToolRail } from './toolrail';
import { REGION, resolveSelection, sameSelection, type Selection } from './selection';

const SPEED_STEPS: readonly number[] = [0, 1, 3, 10];
const STATUS_INTERVAL_SEC = 0.25;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw !== null && raw !== '') {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return n >>> 0;
  }
  return SIM_CONFIG.defaultSeed;
}

// ---------- Welt, Loop, Ansicht ----------

const shell = createShell(document.getElementById('app') as HTMLElement);
const initialWorld = new World(seedFromUrl(), SIM_CONFIG.map.width, SIM_CONFIG.map.height);
let currentWorld: World = initialWorld;
const loop = new SimLoop(initialWorld, { now: () => performance.now() });
const camera = new Camera();
camera.x = initialWorld.width / 2;
camera.y = initialWorld.height / 2;
const renderer = new Renderer(shell.canvas);
renderer.setWorld(initialWorld);

// ---------- UI-Zustand ----------

let activeTool: ToolId = DEFAULT_TOOL;
let activeOverlay = 'surface';
let activePaintTile = 1;
let activeRoadType = 2;
let activeZone = 1;
let selection: Selection = REGION;
let routeFrom: number | null = null;
let hoverTile = -1;

function dispatch(action: GameAction): void {
  currentWorld.enqueue(action);
  loop.stepOnce();
}

function selectionTitle(sel: Selection): string {
  if (sel.kind === 'city') {
    return currentWorld.cities.names[sel.cityId - 1] ?? `Stadt ${sel.cityId}`;
  }
  if (sel.kind === 'tile') {
    return `Tile ${sel.index % currentWorld.width}, ${Math.floor(sel.index / currentWorld.width)}`;
  }
  return 'Region';
}

function setSelection(next: Selection): void {
  const changedContext = next.kind !== selection.kind;
  const changed = !sameSelection(next, selection);
  selection = next;
  if (changed || changedContext) dock.setSelection(selection, selectionTitle(selection));
}

function applyTool(tool: ToolId): void {
  activeTool = tool;
  rail.setActive(tool);
  routeFrom = null;
  const hasOptions = options.setTool(tool, {
    zone: activeZone,
    road: activeRoadType,
    tile: activePaintTile,
  });
  shell.setOptionsVisible(hasOptions);
}

function applyOverlay(overlayId: string): void {
  activeOverlay = overlayId;
  status.setActiveOverlay(overlayId);
}

function cycleOverlay(): void {
  const idx = OVERLAYS.findIndex((o) => o.id === activeOverlay);
  const next = OVERLAYS[(idx + 1) % OVERLAYS.length];
  if (next !== undefined) applyOverlay(next.id);
}

function applySpeed(speed: number): void {
  loop.setSpeed(speed);
  topbar.setSpeed(loop.speed);
}

function speedStep(delta: number): void {
  const idx = SPEED_STEPS.indexOf(loop.speed);
  const next = SPEED_STEPS[Math.max(0, Math.min(SPEED_STEPS.length - 1, (idx < 0 ? 1 : idx) + delta))];
  if (next !== undefined) applySpeed(next);
}

function applyUi(ui: { speed?: number; overlay?: string } | null): void {
  if (ui === null) return;
  if (typeof ui.speed === 'number') applySpeed(ui.speed);
  if (typeof ui.overlay === 'string') applyOverlay(ui.overlay);
}

function applyLoadedWorld(next: World): void {
  loop.setWorld(next);
  renderer.setWorld(next);
  minimap.setWorld(next);
  currentWorld = next;
  routeFrom = null;
  hoverTile = -1;
  camera.clampToMap(next.width, next.height);
  setSelection(REGION);
  status.flash(`Welt geladen: Seed ${next.seed}, Tick ${next.tick}`);
}

// ---------- Panels ----------

const topbar = new Topbar(shell.topbar, {
  onSpeed: applySpeed,
  onSave: () => {
    saveToBrowser(currentWorld, { speed: loop.speed, overlay: activeOverlay })
      .then(() => status.flash(`Gespeichert (Tick ${currentWorld.tick})`))
      .catch((err: unknown) => status.flash(`Speichern fehlgeschlagen: ${String(err)}`));
  },
  onLoad: () => {
    loadFromBrowser()
      .then(({ world, ui }) => {
        applyLoadedWorld(world);
        applyUi(ui);
      })
      .catch((err: unknown) => status.flash(`Laden fehlgeschlagen: ${String(err)}`));
  },
  onExport: () => {
    exportToFile(currentWorld, { speed: loop.speed, overlay: activeOverlay });
    status.flash('Export gestartet');
  },
  onImport: (file) => {
    importFromFile(file)
      .then(({ world, ui }) => {
        applyLoadedWorld(world);
        applyUi(ui);
      })
      .catch((err: unknown) => status.flash(`Import fehlgeschlagen: ${String(err)}`));
  },
  onToggleDock: () => shell.setDockVisible(!shell.isDockVisible()),
});

const rail = new ToolRail(shell.rail, applyTool);

const options = new ToolOptions(shell.options, {
  onZone: (zone) => {
    activeZone = zone;
    options.setActiveKey(zone);
  },
  onRoad: (roadId) => {
    activeRoadType = roadId;
    options.setActiveKey(roadId);
  },
  onTile: (tileId) => {
    activePaintTile = tileId;
    options.setActiveKey(tileId);
  },
});

const status = new StatusBar(shell.status, applyOverlay);
const dock = new Dock(shell.dock, () => setSelection(REGION));
const minimap = new Minimap(dock.minimapHost, 288);
minimap.setWorld(initialWorld);

applyTool(activeTool);
applyOverlay(activeOverlay);
applySpeed(1);

// Minimap: Klick/Drag zentriert die Kamera.
let minimapDragging = false;
function jumpToPointer(ev: MouseEvent): void {
  const pos = minimap.screenToWorld(ev.clientX, ev.clientY);
  camera.x = pos.x;
  camera.y = pos.y;
  camera.clampToMap(currentWorld.width, currentWorld.height);
}
minimap.canvas.addEventListener('mousedown', (ev) => {
  minimapDragging = true;
  jumpToPointer(ev);
});
window.addEventListener('mousemove', (ev) => {
  if (minimapDragging) jumpToPointer(ev);
});
window.addEventListener('mouseup', () => {
  minimapDragging = false;
});

// ---------- Eingabe ----------

const input = attachInput(shell.canvas, {
  camera,
  getMapSize: () => ({ width: currentWorld.width, height: currentWorld.height }),
  hoverAt: (tileIndex) => {
    hoverTile = tileIndex;
  },
  paintAt: (tileIndex) => {
    const x = tileIndex % currentWorld.width;
    const y = Math.floor(tileIndex / currentWorld.width);
    switch (activeTool) {
      case 'select':
        setSelection(resolveSelection(currentWorld, tileIndex));
        return;
      case 'paint':
        dispatch({ kind: 'paintTile', x, y, tile: activePaintTile });
        return;
      case 'road':
        dispatch({ kind: 'buildRoad', x, y, road: activeRoadType });
        return;
      case 'zone':
        dispatch({ kind: 'paintZone', x, y, zone: activeZone });
        return;
      case 'found':
        dispatch({ kind: 'foundCity', x, y, name: `Stadt ${currentWorld.cities.count + 1}` });
        return;
      case 'demolish':
        dispatch({ kind: 'demolishRoad', x, y });
        return;
      case 'route':
        if (routeFrom === null) {
          routeFrom = tileIndex;
          dispatch({ kind: 'clearRoute' });
        } else {
          dispatch({ kind: 'requestRoute', from: routeFrom, to: tileIndex });
          routeFrom = null;
        }
        return;
    }
  },
});

attachShortcuts({
  onTool: applyTool,
  onTogglePause: () => applySpeed(loop.speed === 0 ? 1 : 0),
  onSpeedStep: speedStep,
  onCycleOverlay: cycleOverlay,
  onClearSelection: () => setSelection(REGION),
});

// ---------- Frame ----------

let lastFrameMs = performance.now();
let fpsCount = 0;
let fpsWindowStart = lastFrameMs;
let fps = 0;
let statusClock = STATUS_INTERVAL_SEC;
let lastShownRejected: string | null = null;

function hoverText(): string {
  if (hoverTile < 0 || hoverTile >= currentWorld.width * currentWorld.height) return '–';
  const x = hoverTile % currentWorld.width;
  const y = Math.floor(hoverTile / currentWorld.width);
  const tile = TILE_TYPES.find((t) => t.id === (currentWorld.tiles[hoverTile] ?? 0));
  const road = currentWorld.roads[hoverTile] ?? 0;
  const zone = currentWorld.zoneType[hoverTile] ?? 0;
  return (
    `${x},${y} · ${tile?.name ?? '?'}` +
    (zone > 0 ? ` · Zone ${zone}` : '') +
    (road > 0 ? ` · Strasse ${road}` : '')
  );
}

function routeText(): string {
  const route = currentWorld.route;
  if (route === null) return '';
  const seconds = Math.round((route.timeTicks / 20) * 10) / 10;
  return `  ·  Route ${route.path.length} Tiles / ${formatFixed(route.timeTicks, 1)} Ticks (~${seconds} s)`;
}

function updatePanels(): void {
  const m = regionMetrics(currentWorld);
  topbar.update({
    seed: currentWorld.seed,
    tick: currentWorld.tick,
    treasury: currentWorld.treasury,
    netPerTick: m.netPerTick,
    residents: m.residents,
    satisfaction: m.satisfaction,
    debt: currentWorld.debt,
    bankrupt: currentWorld.bankrupt,
  });
  status.setInfo(`${hoverText()}${routeText()}  ·  ${formatInt(fps)} FPS`);

  // Eine gelöschte/geladene Welt kann die Selektion ungültig machen.
  if (selection.kind === 'city' && selection.cityId > currentWorld.cities.count) {
    setSelection(REGION);
  }
  dock.update({
    world: currentWorld,
    selection,
    selectCity: (cityId) => setSelection({ kind: 'city', cityId }),
    jumpTo: (x, y) => {
      camera.x = x;
      camera.y = y;
      camera.clampToMap(currentWorld.width, currentWorld.height);
    },
    dispatch,
  });
}

function frame(nowMs: number): void {
  const dtSec = Math.min(0.25, Math.max(0, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;

  loop.update();

  const { dx, dy } = input.getKeyPanDir();
  if (dx !== 0 || dy !== 0) {
    camera.panByTiles(dx * VIEW_CONFIG.keyPanTilesPerSecond * dtSec, dy * VIEW_CONFIG.keyPanTilesPerSecond * dtSec);
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
  if (statusClock >= STATUS_INTERVAL_SEC) {
    statusClock = 0;
    updatePanels();
  }

  if (currentWorld.lastRejected !== lastShownRejected) {
    lastShownRejected = currentWorld.lastRejected;
    if (lastShownRejected !== null) status.flash(lastShownRejected);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
