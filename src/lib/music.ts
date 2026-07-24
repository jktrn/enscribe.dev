import concertData from "@/data/concerts.json"

export type ConcertArtist = {
  name: string
  url: string
  formerName?: string
  acronymPrefix?: string
  b2bWithNext?: boolean
}

export type Concert = {
  date: string
  event?: string
  genres: string[]
  artists: ConcertArtist[]
  venue: {
    name: string
    city: string
    url: string
  }
  source: {
    label: string
    url: string
  }
}

export type ConcertStats = {
  shows: number
  artistAppearances: number
  artists: number
  venues: number
  cities: number
  genres: number
  showsByYear: Record<string, number>
}

export const concerts = concertData as Concert[]

export const concertDate = (date: string) => new Date(`${date}T00:00:00.000Z`)

export const summarizeConcerts = (
  items: readonly Concert[] = concerts,
): ConcertStats => {
  const artists = new Set<string>()
  const venues = new Set<string>()
  const cities = new Set<string>()
  const genres = new Set<string>()
  const showsByYear: Record<string, number> = {}
  let artistAppearances = 0

  for (const concert of items) {
    const year = concert.date.slice(0, 4)
    showsByYear[year] = (showsByYear[year] ?? 0) + 1
    venues.add(`${concert.venue.name}\u0000${concert.venue.city}`)
    cities.add(concert.venue.city)

    for (const genre of concert.genres) {
      genres.add(genre)
    }

    for (const artist of concert.artists) {
      artists.add(artist.name)
      artistAppearances += 1
    }
  }

  return {
    shows: items.length,
    artistAppearances,
    artists: artists.size,
    venues: venues.size,
    cities: cities.size,
    genres: genres.size,
    showsByYear,
  }
}
