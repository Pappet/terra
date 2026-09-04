/**
 * Bootstrap: Welt bauen, Tiles statisch rendern, Klick malt Tiles über die
 * Action-Pipeline. Kamera/Loop/HUD/Persistenz kommen in M0.4–M0.6 dazu.
 */
import { SIM_CONFIG } from '../data/config';
import { TILE_TYPES } from '../data/tiles';
import { World } from '../sim/world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

let world: World;

function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw !== null && raw !== '') {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return n >>> 0;
  }
  return SIM_CONFIG.defaultSeed;
}

function tileIndexFromEvent(ev: MouseEvent): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const zoom = drawInfo.zoom;
  const x = Math.floor((ev.clientX - rect.left - drawInfo.offsetX) / zoom);
  const y = Math.floor((ev.clientY - rect.top - drawInfo.offsetY) / zoom);
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  return { x, y };
}

const drawInfo = { zoom: 8, offsetX: 0, offsetY: 0 };

function draw(): void {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const zoom = Math.max(2, Math.floor(Math.min(cssW / world.width, cssH / world.height)));
  drawInfo.zoom = zoom;
  drawInfo.offsetX = (cssW - world.width * zoom) / 2;
  drawInfo.offsetY = (cssH - world.height * zoom) / 2;

  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, cssW, cssH);

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const tileId = world.tiles[y * world.width + x];
      const tile = tileId === undefined ? undefined : TILE_TYPES[tileId];
      if (tile === undefined) continue;
      ctx.fillStyle = tile.color;
      ctx.fillRect(
        drawInfo.offsetX + x * zoom,
        drawInfo.offsetY + y * zoom,
        zoom,
        zoom,
      );
    }
  }

  statusEl.textContent = `TERRA  Seed ${world.seed}  Tick ${world.tick}\nKlick: Gras malen`;
}

canvas.addEventListener('click', (ev) => {
  const pos = tileIndexFromEvent(ev);
  if (pos === null) return;
  world.enqueue({ kind: 'paintTile', x: pos.x, y: pos.y, tile: 1 });
  world.update();
  draw();
});

window.addEventListener('resize', draw);

world = new World(seedFromUrl(), SIM_CONFIG.map.width, SIM_CONFIG.map.height);
draw();
