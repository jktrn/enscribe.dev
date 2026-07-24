import { describe, expect, test } from "bun:test"
import {
  readPersistentTileCache,
  writePersistentTileCache,
} from "@/lib/tile-cache"

const createMemoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe("persistent tile cache", () => {
  test("round-trips a value through the supplied durable storage", () => {
    const storage = createMemoryStorage()

    writePersistentTileCache("discord", { activity: "Zed" }, storage)

    expect(
      readPersistentTileCache<{ activity: string }>("discord", storage),
    ).toEqual({ activity: "Zed" })
  })

  test("returns null for malformed cached JSON", () => {
    const storage = createMemoryStorage()
    storage.setItem("tile:discord", "not json")

    expect(readPersistentTileCache("discord", storage)).toBeNull()
  })
})
