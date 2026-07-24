import type { ImageMetadata } from "astro"

const covers = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/music/albums/*.{jpg,png,webp}",
  { eager: true },
)

export function albumCover(filename: string): ImageMetadata {
  const cover = covers[`/src/assets/music/albums/${filename}`]?.default
  if (!cover) throw new Error(`Missing favorite album cover: ${filename}`)
  return cover
}
