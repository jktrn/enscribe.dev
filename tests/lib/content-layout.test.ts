import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

const unsafeFractionalTracks =
  /grid-template-columns\s*:\s*repeat\(\s*(?:[2-9]|\d{2,})\s*,\s*1fr\s*\)/

describe("content layout safety", () => {
  test("multi-column content grids use shrinkable tracks", async () => {
    const offenders: string[] = []
    const contentFiles = new Glob("src/content/**/*.md")

    for await (const path of contentFiles.scan()) {
      const source = await readFile(path, "utf8")
      if (unsafeFractionalTracks.test(source)) offenders.push(path)
    }

    expect(offenders).toEqual([])
  })

  test("desktop pages without a table of contents do not reserve its rail", async () => {
    const layout = await readFile("src/layouts/Layout.astro", "utf8")

    expect(layout).toMatch(
      /page-grid:not\(\[data-toc\]\) page-content:not\(\[data-wide\]\)\s*\{\s*grid-column:\s*3\s*\/\s*13;\s*max-inline-size:\s*var\(--measure\);/,
    )
  })

  test("table-of-contents observation starts below the anchor scroll inset", async () => {
    const toc = await readFile("src/components/TableOfContents.astro", "utf8")

    expect(toc).toContain(
      "getComputedStyle(document.documentElement).scrollPaddingBlockStart",
    )
    expect(toc).toContain("getComputedStyle(target).scrollMarginBlockStart")
    expect(toc).toContain("rootMargin: `${-topInset}px 0px 0px`,")
  })

  test("metadata separators can target dates rendered by a child component", async () => {
    const metadataSelectors = [
      {
        path: "src/components/BlogCard.astro",
        selector: "entry-authors ~ :global(time)::before",
      },
      {
        path: "src/pages/blog/[...id].astro",
        selector: "post-authors ~ :global(time)::before",
      },
    ]

    for (const { path, selector } of metadataSelectors) {
      expect(await readFile(path, "utf8")).toContain(selector)
    }
  })
})
