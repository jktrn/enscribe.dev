import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import {
  assertSafeAssetPath,
  contentTypeForPath,
  sha256,
} from "./lib/private-assets"

type MediaGroup = "build" | "graphics"

type MediaRoot = {
  group: MediaGroup
  include: (path: string) => boolean
  path: string
}

const repoRoot = resolve(import.meta.dir, "..")
const outputPath = resolve(repoRoot, "private-assets/media-manifest.json")
const roots: MediaRoot[] = [
  {
    group: "build",
    include: (path) => path.includes("/assets/"),
    path: "src/content",
  },
  { group: "build", include: () => true, path: "public/blog" },
  { group: "graphics", include: () => true, path: "graphics/blog" },
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

const assets = []
for (const root of roots) {
  const rootPath = resolve(repoRoot, root.path)
  for (const absolutePath of await walk(rootPath)) {
    const localPath = relative(repoRoot, absolutePath).replaceAll("\\", "/")
    if (!root.include(localPath)) {
      continue
    }
    assertSafeAssetPath(localPath)
    const contents = await readFile(absolutePath)
    assets.push({
      contentType: contentTypeForPath(localPath),
      group: root.group,
      key: localPath,
      localPath,
      sha256: sha256(contents),
      size: contents.byteLength,
    })
  }
}

assets.sort((left, right) => left.localPath.localeCompare(right.localPath))
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(
  outputPath,
  `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
)
console.log(`Wrote ${assets.length} assets to ${outputPath}`)
