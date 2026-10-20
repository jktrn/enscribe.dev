import { describe, expect, test } from "bun:test"
import { readdir, stat } from "node:fs/promises"
import galleryData from "@/data/gallery.json"
import type { GalleryItem } from "@/lib/gallery"

const items: GalleryItem[] = galleryData
const videos = items.flatMap((item) => [
  ...(item.video ?? []),
  ...(item.videoDark ?? []),
])

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
}

describe("gallery data", () => {
  test("references exactly the files in src/assets/gallery", async () => {
    const images = items.flatMap((item) =>
      item.imageDark ? [item.image, item.imageDark] : [item.image],
    )
    const referenced = new Set([...images, ...videos])

    expect([...referenced].sort()).toEqual(
      (await filesIn("src/assets/gallery")).sort(),
    )
  })

  test("has exactly one card video per gallery video", async () => {
    const expected = [
      ...new Set(videos.map((name) => name.replace(/\.[^.]+$/, ".webm"))),
    ]

    expect((await filesIn("src/assets/gallery/card")).sort()).toEqual(
      expected.sort(),
    )
  })

  test("keeps videos under Cloudflare's 25 MiB per-file limit", async () => {
    const oversized: string[] = []
    for (const directory of ["src/assets/gallery", "src/assets/gallery/card"]) {
      for (const name of await filesIn(directory)) {
        if (!/\.(mp4|webm)$/.test(name)) continue
        const { size } = await stat(`${directory}/${name}`)
        if (size > 25 * 1024 ** 2) oversized.push(`${directory}/${name}`)
      }
    }

    expect(oversized).toEqual([])
  })
})
