/**
 * Savegame-IO: Browser-Speicher (IndexedDB) und Datei-Export/Import.
 * Beide Wege laufen über dasselbe JSON-Format wie World.toJson()/fromJson.
 */
import { World } from '../sim/world';
import { idbGet, idbPut } from './idb';

const BROWSER_SLOT = 'auto';

export async function saveToBrowser(world: World): Promise<void> {
  await idbPut(BROWSER_SLOT, world.toJson());
}

/** Wirft, wenn noch nichts gespeichert wurde oder das Savegame defekt ist. */
export async function loadFromBrowser(): Promise<World> {
  const json = await idbGet(BROWSER_SLOT);
  if (json === undefined) {
    throw new Error('Kein Savegame im Browser gespeichert');
  }
  return World.fromJson(json);
}

export function exportToFile(world: World): void {
  const blob = new Blob([world.toJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `terra-save-seed${world.seed}-tick${world.tick}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File): Promise<World> {
  const text = await file.text();
  return World.fromJson(text);
}
