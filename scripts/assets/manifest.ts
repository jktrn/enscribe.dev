import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { contentTypeForPath, sha256 } from "./lib/r2"
import {
  parseMediaManifest,
  type MediaAsset,
  type MediaManifest,
} from "./lib/manifest"
import { assetPaths, repoRoot } from "./lib/paths"

type MediaGroup = "build" | "graphics"

type MediaRoot = {
  group: MediaGroup
  include: (path: string) => boolean
  path: string
  keyPrefix: string
}

const roots: MediaRoot[] = [
  {
    group: "build",
    include: (path) => path.includes("/assets/"),
    path: "src/content",
    keyPrefix: "src/content",
  },
  {
    group: "build",
    include: () => true,
    path: "public/blog",
    keyPrefix: "public/blog",
  },
  {
    group: "graphics",
    include: () => true,
    path: assetPaths.graphicsBlog,
    keyPrefix: "graphics/blog",
  },
]

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths: string[] = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...(await walk(path)))
    } else if (entry.isFile()) {
      paths.push(path)
    }
  }
  return paths
}

export async function generateMediaManifest(
  directory = repoRoot,
): Promise<MediaManifest> {
  const previous = parseMediaManifest(
    JSON.parse(await readFile(resolve(directory, assetPaths.manifest), "utf8")),
  )
  const previousKeys = new Map(
    previous.assets.map((asset) => [asset.localPath, asset.key]),
  )
  const assets: MediaAsset[] = []
  for (const root of roots) {
    const rootPath = resolve(directory, root.path)
    for (const absolutePath of await walk(rootPath)) {
      const localPath = relative(directory, absolutePath).replaceAll("\\", "/")
      if (!root.include(localPath)) {
        continue
      }
      const contents = await readFile(absolutePath)
      const relativePath = relative(rootPath, absolutePath).replaceAll(
        "\\",
        "/",
      )
      assets.push({
        contentType: contentTypeForPath(localPath),
        group: root.group,
        key: previousKeys.get(localPath) ?? `${root.keyPrefix}/${relativePath}`,
        localPath,
        sha256: sha256(contents),
        size: contents.byteLength,
      })
    }
  }

  assets.sort((left, right) => left.localPath.localeCompare(right.localPath))
  return parseMediaManifest({ version: 1, assets })
}

if (import.meta.main) {
  const manifest = await generateMediaManifest()
  const outputPath = resolve(repoRoot, assetPaths.manifest)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${manifest.assets.length} assets to ${outputPath}`)
}
