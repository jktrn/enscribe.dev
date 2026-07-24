import { describe, expect, test } from "bun:test"
import albumData from "@/data/favorite-albums.json"
import { type FavoriteAlbum, summarizeFavoriteAlbums } from "@/lib/albums"

const albums = albumData as FavoriteAlbum[]

describe("favorite album data", () => {
  test("preserves the ranked top ten", () => {
    expect(albums).toHaveLength(10)
    expect(albums.map((album) => album.title)).toEqual([
      "Ordinary Corrupt Human Love",
      "In This World",
      "Portal of I",
      "Sunbather",
      "Nurture",
      "『無職転生』Theme Song Collection",
      "♡",
      "Fête de la Vanille",
      "we had good times together, don’t forget that",
      "Tokyo Utopia Tsushin",
    ])
  })

  test("keeps complete, usable metadata", () => {
    for (const album of albums) {
      expect(new URL(album.url).protocol).toBe("https:")
      expect(new URL(album.artist.url).protocol).toBe("https:")
      const coverSource = new URL(album.coverSource)
      expect(coverSource.protocol).toBe("https:")
      expect([
        "cdn.sonemic.net",
        "f4.bcbits.com",
        "is1-ssl.mzstatic.com",
        "mushokutensei.jp",
        "upload.wikimedia.org",
      ]).toContain(coverSource.hostname)
      if (coverSource.hostname === "cdn.sonemic.net") {
        expect(coverSource.pathname).toStartWith("/i/600/")
      }
      expect(album.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(album.genres.length).toBeGreaterThanOrEqual(3)
      expect(album.cover).toMatch(/\.(?:jpe?g|png|webp)$/)
    }
  })

  test("summarizes the ranking from structured data", () => {
    expect(summarizeFavoriteAlbums(albums)).toEqual({
      albums: 10,
      artists: 9,
      genres: 28,
      earliestYear: 2009,
      latestYear: 2025,
    })
  })
})
