/**
 * Minimale IndexedDB-Hülle: Key-Value-Store für Savegame-JSON-Strings.
 * Bewusst klein gehalten – Versionierung/Schema-Felder kommen erst, wenn
 * es mehrere Slots gibt (BACKLOG).
 */
const DB_NAME = 'terra';
const STORE = 'saves';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB konnte nicht geöffnet werden'));
  });
}

export async function idbPut(key: string, value: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Schreiben fehlgeschlagen'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Schreiben abgebrochen'));
    });
  } finally {
    db.close();
  }
}

export async function idbGet(key: string): Promise<string | undefined> {
  const db = await openDb();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : undefined);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB-Lesen fehlgeschlagen'));
    });
  } finally {
    db.close();
  }
}
