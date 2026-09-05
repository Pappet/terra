/**
 * Savegame-IO: Browser-Speicher (IndexedDB) und Datei-Export/Import.
 * Beide Wege laufen über dasselbe JSON-Format wie World.toJson()/fromJson.
 */
import { World } from '../sim/world';
import { SPEED_STEPS } from '../data/config';
import { idbGet, idbPut } from './idb';

const BROWSER_SLOT = 'auto';

export interface UiState {
  speed?: number;
  overlay?: string;
}

/** UI-Zustand in ein Savegame-JSON einbetten (M7.6). */
export function withUi(json: string, ui: UiState): string {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const validSpeed = SPEED_STEPS.includes(ui.speed as never) ? ui.speed : undefined;
  parsed.ui = { speed: validSpeed, overlay: typeof ui.overlay === 'string' ? ui.overlay : undefined };
  return JSON.stringify(parsed);
}

/** UI-Zustand aus einem Savegame-JSON lesen (optional, fehlt bei alten Ständen). */
export function readUi(json: string): UiState | null {
  try {
    const parsed = JSON.parse(json) as { ui?: { speed?: unknown; overlay?: unknown } };
    if (parsed.ui === undefined || typeof parsed.ui !== 'object') return null;
    const speed = typeof parsed.ui.speed === 'number' ? parsed.ui.speed : undefined;
    const overlay = typeof parsed.ui.overlay === 'string' ? parsed.ui.overlay : undefined;
    return { speed, overlay };
  } catch {
    return null;
  }
}

export async function saveToBrowser(world: World, ui?: UiState): Promise<void> {
  const json = ui === undefined ? world.toJson() : withUi(world.toJson(), ui);
  await idbPut(BROWSER_SLOT, json);
}

/** Wirft, wenn noch nichts gespeichert wurde oder das Savegame defekt ist. */
export async function loadFromBrowser(): Promise<{ world: World; ui: UiState | null }> {
  const json = await idbGet(BROWSER_SLOT);
  if (json === undefined) {
    throw new Error('Kein Savegame im Browser gespeichert');
  }
  return { world: World.fromJson(json), ui: readUi(json) };
}

export function exportToFile(world: World, ui?: UiState): void {
  const json = ui === undefined ? world.toJson() : withUi(world.toJson(), ui);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `terra-save-seed${world.seed}-tick${world.tick}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File): Promise<{ world: World; ui: UiState | null }> {
  const text = await file.text();
  return { world: World.fromJson(text), ui: readUi(text) };
}
