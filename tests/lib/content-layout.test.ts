import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

const unsafeFractionalTracks =
  /grid-template-columns\s*:\s*repeat\(\s*(?:[2-9]|\d{2,})\s*,\s*1fr\s*\)/
const giscusTheme = readFile("public/giscus/base.css", "utf8")

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
    const theme = await giscusTheme

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

  test("Giscus uses the site typography system", async () => {
    const theme = await giscusTheme
    const fontStager = await readFile(
      "scripts/manage-licensed-fonts.ts",
      "utf8",
    )
    const monoFonts = [
      "IBMPlexMono-Regular.woff2",
      "IBMPlexMono-Italic.woff2",
      "IBMPlexMono-Medium.woff2",
      "IBMPlexMono-MediumItalic.woff2",
    ]

    expect(theme).toMatch(/--font-family-default:\s*var\(--font-sans\);/)
    expect(theme).toMatch(/--font-family-monospace:\s*var\(--font-mono\);/)
    expect(theme).toMatch(
      /main\s*\{[^}]*--prose-foreground:\s*color-mix\(\s*in oklab,\s*var\(--color-fg-default\) 80%,\s*transparent\s*\);[^}]*font-family:\s*var\(--font-sans\);/,
    )
    expect(theme).toMatch(
      /:is\(\s*\.gsc-comment-content,\s*\.gsc-reply-content,\s*\.gsc-comment-box-textarea,\s*\.gsc-comment-box-preview\s*\)[^{]*\{[^}]*font-size:\s*var\(--step-0\);[^}]*line-height:\s*calc\(var\(--leading-offset\) \+ 1em\);/,
    )
    expect(theme).toMatch(
      /\.markdown\s+:is\(p,\s*li\)\s*\{[^}]*color:\s*var\(--prose-foreground\);/,
    )
    expect(theme).toMatch(
      /\.markdown\s+:is\(strong,\s*b\)\s*\{[^}]*color:\s*var\(--color-fg-default\);[^}]*font-style:\s*italic;/,
    )
    expect(theme).toMatch(
      /\.markdown\s+:is\(h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\)\s*\{[^}]*line-height:\s*calc\(var\(--leading-offset\) \+ 1em\);[^}]*text-wrap:\s*balance;/,
    )
    expect(theme).toMatch(
      /\.markdown\s+pre\s*>\s*code\s*\{[^}]*font-size:\s*inherit;[^}]*line-height:\s*inherit;/,
    )
    expect(theme).toMatch(
      /\.gsc-reply-content\)\s+a\s*\{[^}]*text-decoration-thickness:\s*max\(1px, 0\.0625em\);[^}]*text-underline-offset:\s*-0\.06em;[^}]*text-decoration-color 0\.2s ease;/,
    )
    expect(theme).toMatch(
      /\.gsc-reply-content\)\s+a:hover\s*\{[^}]*text-decoration-color:\s*currentColor;/,
    )

    for (const [step, value] of [
      ["--step--1", "clamp(0.8889rem, 0.8542rem + 0.1736vw, 0.9375rem)"],
      ["--step-0", "clamp(1rem, 0.9107rem + 0.4464vw, 1.125rem)"],
      ["--step-1", "clamp(1.125rem, 0.9643rem + 0.8036vw, 1.35rem)"],
      ["--step-2", "clamp(1.2656rem, 1.0125rem + 1.2656vw, 1.62rem)"],
      ["--step-3", "clamp(1.4238rem, 1.0523rem + 1.8578vw, 1.944rem)"],
    ]) {
      expect(theme).toContain(`${step}: ${value};`)
    }

    for (const [heading, step] of [
      ["h1", "--step-3"],
      ["h2", "--step-2"],
      ["h3", "--step-1"],
      ["h4", "--step-0"],
    ]) {
      expect(theme).toMatch(
        new RegExp(
          `\\.markdown ${heading}\\s*\\{[^}]*font-size: var\\(${step}\\);`,
        ),
      )
    }

    for (const font of monoFonts) {
      expect(theme).toContain(`https://enscribe.dev/fonts/${font}`)
      expect(fontStager).toContain(`"${font}"`)
      expect(
        (await readFile(`src/assets/fonts/${font}`)).byteLength,
      ).toBeGreaterThan(0)
    }

    expect(await readFile("public/_headers", "utf8")).toMatch(
      /\/fonts\/\*\s+Access-Control-Allow-Origin:\s*https:\/\/giscus\.app/,
    )
  })
})
