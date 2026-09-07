import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { prepareAssets, uploadAssets, verifyRemoteAssets } from "./lib/r2"

import { parseMediaManifest, type MediaManifest } from "./lib/manifest"
import { assetPaths, repoRoot } from "./lib/paths"

const manifestPath = resolve(repoRoot, assetPaths.manifest)
const mediaBucket = process.env.R2_MEDIA_BUCKET ?? "enscribe-media-source"

async function loadManifest(): Promise<MediaManifest> {
  return parseMediaManifest(JSON.parse(await readFile(manifestPath, "utf8")))
}

if (import.meta.main) {
  const mode = process.argv[2]
  const manifest = await loadManifest()

  if (mode === "prepare") {
    await prepareAssets(
      mediaBucket,
      repoRoot,
      manifest.assets.filter((asset) => asset.group === "build"),
    )
  } else if (mode === "prepare-graphics") {
    await prepareAssets(
      mediaBucket,
      repoRoot,
      manifest.assets.filter((asset) => asset.group === "graphics"),
      "keep",
    )
  } else if (mode === "upload") {
    await uploadAssets(mediaBucket, repoRoot, manifest.assets)
  } else if (mode === "verify") {
    await verifyRemoteAssets(mediaBucket, manifest.assets)
  } else {
    throw new Error("Usage: media.ts <prepare|prepare-graphics|upload|verify>")
  }
}
