import { resolve } from "node:path"

export const repoRoot = resolve(import.meta.dir, "../../..")

export const assetPaths = {
  manifest: "scripts/assets/media-manifest.json",
  graphicsBlog: "scripts/assets/sources/blog",
  graphicsFonts: "scripts/assets/sources/fonts",
} as const
