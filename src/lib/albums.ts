import albumData from "@/data/favorite-albums.json"

export type AlbumArtist = {
  name: string
  url: string
}

export type FavoriteAlbum = {
  title: string
  originalTitle?: string
  artist: AlbumArtist
  url: string
  releaseDate: string
  format: "Album" | "EP" | "Compilation"
  label?: string
  genres: string[]
  cover: string
  coverSource: string
}

export const favoriteAlbums = albumData as FavoriteAlbum[]

export const albumDate = (date: string) => new Date(`${date}T00:00:00.000Z`)

export const summarizeFavoriteAlbums = (
  albums: readonly FavoriteAlbum[] = favoriteAlbums,
) => {
  const artists = new Set(albums.map((album) => album.artist.name))
  const genres = new Set(albums.flatMap((album) => album.genres))
  const years = albums.map((album) => Number(album.releaseDate.slice(0, 4)))

  return {
    albums: albums.length,
    artists: artists.size,
    genres: genres.size,
    earliestYear: Math.min(...years),
    latestYear: Math.max(...years),
  }
}
