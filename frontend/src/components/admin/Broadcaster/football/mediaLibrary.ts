export type MediaCategory = "promo" | "fondo";

export interface MediaItem {
  id: string;
  name: string;
  kind: "video" | "image";
  category: MediaCategory;
  blob: Blob;
  createdAt: number;
}

const DB_NAME = "nexus-media-library";
const STORE = "items";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la biblioteca de medios"));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => { resolve(request.result); db.close(); };
    request.onerror = () => { reject(request.error ?? new Error("Error en la biblioteca de medios")); db.close(); };
  });
}

export const listMedia = async (): Promise<MediaItem[]> => {
  const items = await run("readonly", (store) => store.getAll() as IDBRequest<MediaItem[]>);
  return items.sort((a, b) => a.createdAt - b.createdAt);
};

export const saveMedia = (item: MediaItem) => run("readwrite", (store) => store.put(item));
export const deleteMedia = (id: string) => run("readwrite", (store) => store.delete(id));
