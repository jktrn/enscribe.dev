import type { ImageMetadata } from "astro"
import galleryData from "@/data/gallery.json"

export type GalleryItem = {
  image: string
  imageDark?: string
  video?: string[]
  videoDark?: string[]
  posterTime?: number
  caption: string
  project: string
  year: number
  link?: string
}

export const galleryItems: GalleryItem[] = galleryData

const images = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/gallery/*.{avif,gif,jpeg,jpg,png,webp}",
  { eager: true },
)

export function galleryImage(filename: string): ImageMetadata {
  const image = images[`/src/assets/gallery/${filename}`]?.default
  if (!image) {
    throw new Error(
      `Missing gallery image src/assets/gallery/${filename} (run bun run media:prepare)`,
    )
  }
  return image
}

const videos = import.meta.glob<string>("/src/assets/gallery/*.{mp4,webm}", {
  eager: true,
  query: "?url",
  import: "default",
})

export function galleryVideo(filename: string): { src: string; type: string } {
  const src = videos[`/src/assets/gallery/${filename}`]
  if (!src) {
    throw new Error(
      `Missing gallery video src/assets/gallery/${filename} (run bun run media:prepare)`,
    )
  }
  return { src, type: filename.endsWith(".webm") ? "video/webm" : "video/mp4" }
}

const cardVideos = import.meta.glob<string>("/src/assets/gallery/card/*.webm", {
  eager: true,
  query: "?url",
  import: "default",
})

export const cardVideoName = (filename: string) =>
  filename.replace(/\.[^.]+$/, ".webm")

export function galleryCardVideo(filename: string): {
  src: string
  type: string
} {
  const name = cardVideoName(filename)
  const src = cardVideos[`/src/assets/gallery/card/${name}`]
  if (!src) {
    throw new Error(
      `Missing card video src/assets/gallery/card/${name} (run bun run gallery:cards)`,
    )
  }
  return { src, type: "video/webm" }
}
