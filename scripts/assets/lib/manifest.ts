import { assertSafeAssetPath, type PrivateAsset } from "./r2"

export type MediaAsset = PrivateAsset & {
  group: "build" | "graphics"
}

export type MediaManifest = {
  assets: MediaAsset[]
  version: 1
}

export function parseMediaManifest(value: unknown): MediaManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Private media manifest must be an object")
  }

  const manifest = value as Partial<MediaManifest>
  if (manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error("Unsupported private media manifest")
  }

  const seenPaths = new Set<string>()
  const seenKeys = new Set<string>()
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
    if (seenPaths.has(asset.localPath)) {
      throw new Error(`Duplicate private media path: ${asset.localPath}`)
    }
    if (seenKeys.has(asset.key)) {
      throw new Error(`Duplicate private media key: ${asset.key}`)
    }
    seenPaths.add(asset.localPath)
    seenKeys.add(asset.key)
  }

  return manifest as MediaManifest
}
