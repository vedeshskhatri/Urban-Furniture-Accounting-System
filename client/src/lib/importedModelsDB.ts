/**
 * importedModelsDB.ts
 * Persists user-imported .glb models in IndexedDB so they survive page refreshes.
 * No server calls, fully offline-first.
 */

const DB_NAME = 'urban_studio_imports';
const STORE_NAME = 'models';
const DB_VERSION = 1;

export interface StoredImportedModel {
  id: string;          // unique key e.g. "imported_1693000000000_My Chair.glb"
  filename: string;
  displayName: string;
  sizeBytes: number;
  data: ArrayBuffer;   // raw GLB bytes
  importedAt: number;  // timestamp
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a GLB file's ArrayBuffer to IndexedDB. */
export async function saveImportedModel(model: StoredImportedModel): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(model);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Load all saved imported models from IndexedDB. */
export async function loadAllImportedModels(): Promise<StoredImportedModel[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as StoredImportedModel[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Delete a specific model by its id. */
export async function deleteImportedModel(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Create a fresh Blob URL from stored ArrayBuffer (call this on every page load). */
export function createBlobUrlFromBuffer(data: ArrayBuffer): string {
  const blob = new Blob([data], { type: 'model/gltf-binary' });
  return URL.createObjectURL(blob);
}
