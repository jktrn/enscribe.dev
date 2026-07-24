import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { dirname, resolve } from "node:path"

const thumbnailPair =
  /^thumbnail:\s*\n\s+light:\s*['"]([^'"]+)['"]\s*\n\s+dark:\s*['"]([^'"]+)['"]/m

describe("project thumbnails", () => {
  test("uses every authored light and dark asset pair", async () => {
    const authored = new Set<string>()
    const configured = new Set<string>()

    for await (const lightPath of new Glob(
      "src/content/projects/assets/*-light.png",
    ).scan()) {
      authored.add(resolve(lightPath))
      authored.add(resolve(lightPath.replace(/-light\.png$/, "-dark.png")))
    }

    for await (const projectPath of new Glob(
      "src/content/projects/*.md",
    ).scan()) {
      const source = await Bun.file(projectPath).text()
      const match = source.match(thumbnailPair)
      if (!match?.[1] || !match[2]) continue

      configured.add(resolve(dirname(projectPath), match[1]))
      configured.add(resolve(dirname(projectPath), match[2]))
    }

    expect([...configured].sort()).toEqual([...authored].sort())
  })
})
