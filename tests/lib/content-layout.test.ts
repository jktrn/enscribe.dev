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
      /page-grid:not\(\[data-toc\]\) page-content:not\(\[data-wide\]\)\s*\{\s*grid-column:\s*3\s*\/\s*13;[\s\S]*?max-inline-size:\s*calc\(/,
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

  test("the comments iframe does not clip square Giscus corners", async () => {
    const comments = await readFile("src/components/Comments.astro", "utf8")

    expect(comments).toMatch(
      /:global\(\.giscus-frame\)\s*\{[\s\S]*?border-radius:\s*0;/,
    )
  })

  test("Giscus utility controls use icon masks instead of text stand-ins", async () => {
    const theme = await readFile("public/giscus/base.css", "utf8")

    expect(theme).not.toContain('content: "Mono"')
    expect(theme).not.toContain('content: "Markdown"')
    expect(theme).toMatch(
      /--giscus-icon-text:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /--giscus-icon-markdown:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /--giscus-icon-sign-out:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /--giscus-icon-copy:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /--giscus-icon-check:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /\.gsc-toolbar-item::after\s*\{\s*mask-image:\s*var\(--giscus-icon-text\)/,
    )
    expect(theme).toMatch(
      /\.gsc-comment-box-markdown-hint::after\s*\{\s*mask-image:\s*var\(--giscus-icon-markdown\)/,
    )
    expect(theme).toMatch(
      /button\.link-secondary:has\(\.octicon-sign-out\)::before\s*\{\s*mask-image:\s*var\(--giscus-icon-sign-out\)/,
    )
    expect(theme).toMatch(
      /button\.link-secondary:has\(\.octicon-sign-out\)\s+\.octicon-sign-out,[^{]+\{\s*display:\s*none;/,
    )
    expect(theme).toMatch(
      /\.ClipboardButton\s+:is\(\.js-clipboard-copy-icon,\s*\.js-clipboard-check-icon\)\s*\{\s*display:\s*none;/,
    )
    expect(theme).toMatch(
      /\.ClipboardButton::before\s*\{[^}]*mask-image:\s*var\(--giscus-icon-copy\)/,
    )
    expect(theme).toMatch(
      /\.ClipboardButton:has\(\.js-clipboard-copy-icon\.d-none\)::before\s*\{[^}]*mask-image:\s*var\(--giscus-icon-check\)/,
    )
  })
})
