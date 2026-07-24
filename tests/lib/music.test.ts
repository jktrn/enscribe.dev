import { describe, expect, test } from "bun:test"
import { concertDate, concerts, summarizeConcerts } from "@/lib/music"
import { renderConcertEntry } from "@/lib/music-render"

describe("structured concert data", () => {
  test("keeps the complete concert history in reverse chronological order", () => {
    expect(concerts).toHaveLength(24)
    expect(concerts[0]?.date).toBe("2026-07-19")
    expect(concerts.at(-1)?.date).toBe("2023-10-20")

    const timestamps = concerts.map(({ date }) => concertDate(date).getTime())
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a))
  })

  test("stores links and display metadata as data instead of markup", () => {
    for (const concert of concerts) {
      expect(concert.artists.length).toBeGreaterThan(0)
      expect(concert.genres.length).toBeGreaterThan(0)
      expect(new Set(concert.genres).size).toBe(concert.genres.length)
      expect(concert.venue.name.length).toBeGreaterThan(0)
      expect(concert.venue.city.length).toBeGreaterThan(0)
      expect(new URL(concert.venue.url).hostname).toBe("www.google.com")
      expect(new URL(concert.source.url).protocol).toBe("https:")

      for (const [index, artist] of concert.artists.entries()) {
        expect(artist.name.length).toBeGreaterThan(0)
        expect(new URL(artist.url).protocol).toBe("https:")
        if (artist.acronymPrefix) {
          expect(artist.name.startsWith(artist.acronymPrefix)).toBe(true)
        }
        if (artist.b2bWithNext) {
          expect(index).toBeLessThan(concert.artists.length - 1)
        }
      }
    }
  })

  test("renders the established typography and punctuation from the data", async () => {
    const niteharts = concerts.find(({ event }) => event === "Niteharts")
    const taxi = concerts.find(({ date }) => date === "2025-08-29")
    expect(niteharts).toBeDefined()
    expect(taxi).toBeDefined()

    const nitehartsHtml = await renderConcertEntry(niteharts!)
    const taxiHtml = await renderConcertEntry(taxi!)

    expect(nitehartsHtml).toContain("Niteharts: <a")
    expect(nitehartsHtml).toContain('<span data-acronym="">ISO</span>xo')
    expect(nitehartsHtml).toContain(
      '<span data-acronym="">WINK</span><span aria-hidden="true" data-favicon=""',
    )
    expect(nitehartsHtml).toContain(
      '</a> <abbr title="back to back">b2b</abbr> <a',
    )
    expect(nitehartsHtml).not.toContain("</a> ,")
    expect(taxiHtml).toContain('data-favicon-icon="simple-bandcamp.svg"')
    expect(taxiHtml).toContain(
      'data-favicon-icon="phosphor-instagram-logo.svg"',
    )
    expect(taxiHtml).toContain(
      "</a><span data-music-separator>,</span> <span data-music-city>San Francisco</span>",
    )
    expect(taxiHtml).toContain(
      "<br><span data-music-genres>emo, indie rock</span>",
    )
    expect(taxiHtml.match(/<br>/gu)).toHaveLength(2)
  })

  test("derives statistics without parsing rendered prose", () => {
    expect(summarizeConcerts(concerts)).toMatchObject({
      shows: 24,
      artistAppearances: 79,
      artists: 65,
      venues: 18,
      cities: 6,
      genres: 43,
      showsByYear: { "2023": 2, "2024": 6, "2025": 12, "2026": 4 },
    })
  })
})
