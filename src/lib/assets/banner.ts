import { dirname, resolve } from "node:path"
import type { ImageMetadata } from "astro"
import type { CollectionEntry } from "astro:content"
import { readSvgSource, themeSvgSource } from "./themed-svg"

export function themedBanner(
  entry: CollectionEntry<"blog">,
): { light: string; dark: string } | null {
  const banner = entry.data.banner
  if (!banner || !entry.filePath) return null
  if (!banner.light.endsWith(".svg") || !banner.dark.endsWith(".svg")) {
    return null
  }

  const dir = dirname(resolve(entry.filePath))
  const light = readSvgSource(resolve(dir, banner.light))
  const dark = readSvgSource(resolve(dir, banner.dark))
  if (light.includes("<image") || dark.includes("<image")) {
    throw new Error(
      `${entry.id}: banner SVG pair contains <image> — raster-bearing ` +
        `banners belong in graphics/blog/<post>/; move them there ` +
        `and point frontmatter at the rendered webp pair ` +
        `(see graphics/README.md)`,
    )
  }

  const prefix = `banner-${entry.id.replace(/[^a-zA-Z0-9-]/g, "-")}`
  return {
    light: themeSvgSource(light, "light", prefix),
    dark: themeSvgSource(dark, "dark", prefix),
  }
}

const rasters = import.meta.glob<{ default: ImageMetadata }>(
  "/src/content/blog/*/assets/banner-{light,dark}.webp",
  { eager: true },
)

export type BannerRaster = { light: ImageMetadata; dark: ImageMetadata }

const ogCards = import.meta.glob<{ default: ImageMetadata }>(
  "/src/content/blog/*/assets/banner-og.png",
  { eager: true },
)

export function bannerOgImage(
  entry: CollectionEntry<"blog">,
): ImageMetadata | null {
  const post = entry.id.split("/")[0]
  return (
    ogCards[`/src/content/blog/${post}/assets/banner-og.png`]?.default ?? null
  )
}

export function bannerRaster(
  entry: CollectionEntry<"blog">,
): BannerRaster | null {
  if (!entry.data.banner) return null
  const post = entry.id.split("/")[0]
  const light =
    rasters[`/src/content/blog/${post}/assets/banner-light.webp`]?.default
  const dark =
    rasters[`/src/content/blog/${post}/assets/banner-dark.webp`]?.default
  if (!light || !dark) return null
  return { light, dark }
}
