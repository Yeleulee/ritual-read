import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CacheDB extends DBSchema {
  files: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      timestamp: number;
      fileType: string;
      size: number;
      /** Pinned entries are the only copy of a locally stored book; they never expire. */
      pinned?: boolean;
    };
  };
  metadata: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
    };
  };
}

const DB_NAME = 'ritual-read-cache';
const DB_VERSION = 1;
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

let dbPromise: Promise<IDBPDatabase<CacheDB>> | null = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheFile(id: string, blob: Blob, fileType: string, options: { pinned?: boolean } = {}): Promise<void> {
  try {
    const db = await getDB();
    await db.put('files', {
      id,
      blob,
      timestamp: Date.now(),
      fileType,
      size: blob.size,
      pinned: options.pinned || undefined,
    });
    console.log(`File cached: ${id}, size: ${blob.size} bytes`);
  } catch (error) {
    console.error('Failed to cache file:', error);
    // Pinned entries have no other copy, so the caller must know the write failed
    if (options.pinned) throw error;
  }
}

export async function deleteCachedFile(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('files', id);
  } catch (error) {
    console.error('Failed to delete cached file:', error);
  }
}

export async function getCachedFile(id: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    const cached = await db.get('files', id);
    
    if (!cached) {
      console.log(`Cache miss for: ${id}`);
      return null;
    }

    // Check if cache is expired
    const age = Date.now() - cached.timestamp;
    if (!cached.pinned && age > CACHE_EXPIRY) {
      console.log(`Cache expired for: ${id}`);
      await db.delete('files', id);
      return null;
    }

    console.log(`Cache hit for: ${id}, age: ${Math.round(age / 1000 / 60)} minutes`);
    return cached.blob;
  } catch (error) {
    console.error('Failed to get cached file:', error);
    return null;
  }
}

export async function cacheMetadata(id: string, data: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('metadata', {
      id,
      data,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to cache metadata:', error);
  }
}

export async function getCachedMetadata(id: string): Promise<any | null> {
  try {
    const db = await getDB();
    const cached = await db.get('metadata', id);
    
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_EXPIRY) {
      await db.delete('metadata', id);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('Failed to get cached metadata:', error);
    return null;
  }
}

export async function clearExpiredCache(): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();
    
    // Clear expired files
    const files = await db.getAll('files');
    for (const file of files) {
      if (!file.pinned && now - file.timestamp > CACHE_EXPIRY) {
        await db.delete('files', file.id);
      }
    }
    
    // Clear expired metadata
    const metadata = await db.getAll('metadata');
    for (const meta of metadata) {
      if (now - meta.timestamp > CACHE_EXPIRY) {
        await db.delete('metadata', meta.id);
      }
    }
    
    console.log('Expired cache cleared');
  } catch (error) {
    console.error('Failed to clear expired cache:', error);
  }
}

export async function getCacheSize(): Promise<number> {
  try {
    const db = await getDB();
    const files = await db.getAll('files');
    return files.reduce((total, file) => total + file.size, 0);
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return 0;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    // Keep pinned files: they are locally stored books, not a re-downloadable cache
    const files = await db.getAll('files');
    for (const file of files) if (!file.pinned) await db.delete('files', file.id);
    await db.clear('metadata');
    console.log('Cache cleared');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

// Initialize cache cleanup on module load
if (typeof window !== 'undefined') {
  clearExpiredCache();
}
