import { get, set, del } from 'idb-keyval';

const KEY_PREFIX = 'bookfile:';

export async function saveBookFile(file: Blob | ArrayBuffer): Promise<string> {
  const key = KEY_PREFIX + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString());
  const blob = file instanceof Blob ? file : new Blob([file]);
  await set(key, blob);
  return key;
}

export async function getBookFile(keyOrUrl: string): Promise<Blob | undefined> {
  const key = keyOrUrl.startsWith('idb://') ? keyOrUrl.slice('idb://'.length) : keyOrUrl;
  try {
    const blob = await get<Blob>(key);
    return blob ?? undefined;
  } catch {
    return undefined;
  }
}

export async function removeBookFile(keyOrUrl: string): Promise<void> {
  const key = keyOrUrl.startsWith('idb://') ? keyOrUrl.slice('idb://'.length) : keyOrUrl;
  try { await del(key); } catch {}
}
