import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  assertSafeAssetPath,
  prepareAssets,
  type PrivateAsset,
  uploadAssets,
  verifyRemoteAssets,
} from "./lib/private-assets"

type MediaAsset = PrivateAsset & {
  group: "build" | "graphics"
}

type MediaManifest = {
  assets: MediaAsset[]
  version: 1
}

const repoRoot = resolve(import.meta.dir, "..")
const manifestPath = resolve(repoRoot, "private-assets/media-manifest.json")
const mediaBucket = process.env.R2_MEDIA_BUCKET ?? "enscribe-media-source"

export function parseMediaManifest(value: unknown): MediaManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Private media manifest must be an object")
  }

  const manifest = value as Partial<MediaManifest>
  if (manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error("Unsupported private media manifest")
  }

  const seenPaths = new Set<string>()
  for (const asset of manifest.assets) {
    if (
      !asset ||
      typeof asset !== "object" ||
      typeof asset.localPath !== "string" ||
      typeof asset.key !== "string" ||
      typeof asset.contentType !== "string" ||
      typeof asset.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 0 ||
      (asset.group !== "build" && asset.group !== "graphics")
    ) {
      throw new Error("Invalid private media manifest entry")
    }
    assertSafeAssetPath(asset.localPath)
    assertSafeAssetPath(asset.key)
    if (asset.key !== asset.localPath) {
      throw new Error(
        `Private media key must match its local path: ${asset.key}`,
      )
    }
    if (seenPaths.has(asset.localPath)) {
      throw new Error(`Duplicate private media path: ${asset.localPath}`)
    }
    seenPaths.add(asset.localPath)
  }

  return manifest as MediaManifest
}

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
    )
  } else if (mode === "upload") {
    await uploadAssets(mediaBucket, repoRoot, manifest.assets)
  } else if (mode === "verify") {
    await verifyRemoteAssets(mediaBucket, manifest.assets)
  } else {
    throw new Error(
      "Usage: manage-private-media.ts <prepare|prepare-graphics|upload|verify>",
    )
  }
}
