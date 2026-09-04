import type { FlatworldSaveV2, FlatworldSaveV3 } from "./types";

const DATABASE = "flatworld-society";
const STORE = "worlds";
const SLOT = "latest";

export type LoadedWorld =
  | { kind: "v3"; save: FlatworldSaveV3 }
  | { kind: "v2"; save: FlatworldSaveV2 }
  | { kind: "legacy" };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Flatland storage could not be opened."));
  });
}

export async function saveWorld(save: FlatworldSaveV3) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(save, SLOT);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Flatland storage rejected the save."));
    });
  } finally {
    database.close();
  }
}

export async function loadWorld(): Promise<LoadedWorld | undefined> {
  const database = await openDatabase();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).get(SLOT);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Flatland storage could not recall the save."));
    });
    if (!value || typeof value !== "object") return undefined;
    const version = (value as { version?: unknown }).version;
    if (!("simulation" in value)) return { kind: "legacy" };
    if (version === 3) return { kind: "v3", save: value as FlatworldSaveV3 };
    if (version === 2) return { kind: "v2", save: value as FlatworldSaveV2 };
    return { kind: "legacy" };
  } finally {
    database.close();
  }
}

export async function clearSavedWorld() {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(SLOT);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Flatland storage could not clear the remembered town."));
    });
  } finally {
    database.close();
  }
}
