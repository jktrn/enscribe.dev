interface TileCacheStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const storageKey = (key: string) => `tile:${key}`

const readCache = <T>(storage: TileCacheStorage, key: string): T | null => {
  try {
    const raw = storage.getItem(storageKey(key))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const writeCache = (storage: TileCacheStorage, key: string, value: unknown) => {
  try {
    storage.setItem(storageKey(key), JSON.stringify(value))
  } catch {}
}

export const readTileCache = <T>(
  key: string,
  storage: TileCacheStorage = sessionStorage,
): T | null => readCache<T>(storage, key)

export const writeTileCache = (
  key: string,
  value: unknown,
  storage: TileCacheStorage = sessionStorage,
) => writeCache(storage, key, value)

export const readPersistentTileCache = <T>(
  key: string,
  storage: TileCacheStorage = localStorage,
): T | null => readCache<T>(storage, key)

export const writePersistentTileCache = (
  key: string,
  value: unknown,
  storage: TileCacheStorage = localStorage,
) => writeCache(storage, key, value)
