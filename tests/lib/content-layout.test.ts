import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

const unsafeFractionalTracks =
  /grid-template-columns\s*:\s*repeat\(\s*(?:[2-9]|\d{2,})\s*,\s*1fr\s*\)/
const giscusTheme = readFile("public/giscus/base.css", "utf8")

const cssBlock = (source: string, selector: string) => {
  const marker = `${selector} {`
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`Missing CSS block: ${selector}`)

  const open = start + marker.length - 1
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] === "}") depth -= 1
    if (depth === 0) return source.slice(open + 1, index)
  }

  throw new Error(`Unclosed CSS block: ${selector}`)
}

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

  test("post navigation places previous on the left and next on the right", async () => {
    const actions = await readFile("src/components/PostActions.astro", "utf8")
    const navigation = actions.match(
      /<post-navigation-actions>([\s\S]*?)<\/post-navigation-actions>/,
    )?.[1]

    expect(navigation).toBeDefined()
    expect(navigation).toMatch(
      /href=\{prev\?\.href\}[\s\S]*?data-dir="prev"[\s\S]*?<ArrowLeft/,
    )
    expect(navigation).toMatch(
      /href=\{next\?\.href\}[\s\S]*?data-dir="next"[\s\S]*?<ArrowRight/,
    )
    expect(navigation!.indexOf('data-dir="prev"')).toBeLessThan(
      navigation!.indexOf('data-dir="next"'),
    )

    const styles = cssBlock(actions, "post-actions")
    expect(styles).toContain("post-reading-actions,")
    expect(styles).toContain("post-navigation-actions {")
    expect(styles).toContain("a {")
  })

  test("the homepage map fades its basemap without fading place bubbles", async () => {
    const map = await readFile("src/components/FoodMapTile.astro", "utf8")
    const homepage = await readFile("src/pages/index.astro", "utf8")
    const basemapReady = cssBlock(
      map,
      '.food-map[data-ready="true"] .food-map-canvas',
    )
    const placesReady = cssBlock(
      map,
      '.food-map[data-ready="true"] .food-map-places',
    )

    expect(map).toContain(
      '<canvas class="food-map-places" data-food-map-places></canvas>',
    )
    expect(basemapReady).toContain("opacity: 0.85;")
    expect(placesReady).toContain("opacity: 1;")
    expect(map).toContain("const point = map.project([lon, lat])")
    expect(map).toContain('map.on("render", drawPlaces)')
    expect(map).not.toContain('map.addLayer({\n        id: "places"')
    expect(cssBlock(map, ".food-map-city select")).toContain(
      "border: 2px solid var(--background-l0);",
    )
    expect(cssBlock(homepage, "&[data-over-map]")).toContain(
      "box-shadow: 0 0 0 2px var(--background-l0);",
    )
  })

  test("the comments iframe does not clip square Giscus corners", async () => {
    const comments = await readFile("src/components/Comments.astro", "utf8")
    const astroConfig = await readFile("astro.config.ts", "utf8")

    expect(comments).toMatch(
      /:global\(\.giscus-frame\)\s*\{[\s\S]*?border-radius:\s*0;/,
    )
    expect(comments).toContain("<giscus-thread\n    data-term={term}")
    expect(comments).toContain(
      'document.querySelector<HTMLElement>("giscus-thread")',
    )
    expect(cssBlock(comments, "giscus-thread")).toContain("display: block;")
    expect(comments).toContain('const THEME_PREFIX = "data:text/css;base64,"')
    expect(comments).toContain("`${location.origin}/`,")
    expect(comments).toContain("origin: authOrigin")
    expect(comments).toContain("const savedSession = readSession()")
    expect(astroConfig).toMatch(
      /server:\s*\{[^}]*allowedHosts:\s*\["\.trycloudflare\.com"\][^}]*cors:\s*\{\s*origin:\s*"https:\/\/giscus\.app"\s*\}/,
    )
  })

  test("Giscus utility controls use icon masks instead of text stand-ins", async () => {
    const theme = await giscusTheme
    const root = cssBlock(theme, "#__next")
    const toolbar = cssBlock(root, ".gsc-toolbar-item")
    const signOut = cssBlock(
      cssBlock(root, ".gsc-comment-box-bottom"),
      "> button.link-secondary:has(.octicon-sign-out)",
    )
    const clipboard = cssBlock(root, ".ClipboardButton")

    expect(theme).not.toContain('content: "Mono"')
    expect(theme).not.toContain('content: "Markdown"')
    expect(theme.match(/#__next/g)).toHaveLength(1)
    expect(theme).toMatch(
      /--giscus-icon-text:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /\.gsc-comment-box-textarea\s*\{[^}]*border-bottom-style:\s*solid;/,
    )
    expect(theme).toMatch(
      /\.gsc-comment-box-textarea-extras\s*\{[^}]*display:\s*none;/,
    )
    expect(theme).not.toContain("--giscus-icon-markdown")
    expect(theme).toMatch(
      /--giscus-icon-sign-out:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /--giscus-icon-copy:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(theme).toMatch(
      /--giscus-icon-check:\s*url\("data:image\/svg\+xml;base64,[^"]+"\);/,
    )
    expect(toolbar).toMatch(
      /&::after\s*\{\s*mask-image:\s*var\(--giscus-icon-text\)/,
    )
    expect(toolbar).toMatch(
      /display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*inline-size:\s*2rem;[^}]*block-size:\s*2rem;[^}]*padding:\s*0;[^}]*border-radius:\s*0\.375rem;[^}]*color:\s*var\(--color-fg-subtle\);[^}]*cursor:\s*pointer;[^}]*transition:\s*background-color 0\.2s ease;/,
    )
    expect(toolbar).toMatch(
      /&:hover\s*\{[^}]*background-color:\s*color-mix\(\s*in oklab,\s*var\(--color-canvas-subtle\) 50%,\s*transparent\s*\);/,
    )
    expect(root).toMatch(
      /button\.gsc-toolbar-item\s*\{[^}]*border-radius:\s*0\.375rem;/,
    )
    expect(root.indexOf("button.gsc-toolbar-item")).toBeGreaterThan(
      root.indexOf(".gsc-comment-box button"),
    )
    expect(root).toMatch(
      /\.gsc-comment-box:has\(\.gsc-is-fixed-width\) \.gsc-toolbar-item\s*\{[^}]*color:\s*var\(--color-fg-default\);[^}]*background-color:\s*color-mix\(\s*in oklab,\s*var\(--color-canvas-subtle\) 50%,\s*transparent\s*\);/,
    )
    expect(signOut).toMatch(
      /&::before\s*\{\s*mask-image:\s*var\(--giscus-icon-sign-out\)/,
    )
    expect(signOut).toMatch(
      /&:hover\s*\{[^}]*color:\s*var\(--color-fg-default\);/,
    )
    expect(signOut).toMatch(/\.octicon-sign-out\s*\{\s*display:\s*none;/)
    expect(clipboard).toMatch(
      /:is\(\.js-clipboard-copy-icon,\s*\.js-clipboard-check-icon\)\s*\{\s*display:\s*none;/,
    )
    expect(clipboard).toMatch(
      /&::before\s*\{[^}]*mask-image:\s*var\(--giscus-icon-copy\)/,
    )
    expect(clipboard).toMatch(
      /&:has\(\.js-clipboard-copy-icon\.d-none\)::before\s*\{[^}]*mask-image:\s*var\(--giscus-icon-check\)/,
    )
  })

  test("Giscus uses the site typography system", async () => {
    const theme = await giscusTheme
    const root = cssBlock(theme, "#__next")
    const markdown = cssBlock(root, ".markdown")
    const prose = cssBlock(
      root,
      ":is(.gsc-comment-content, .gsc-reply-content)",
    )
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
    expect(markdown).toMatch(
      /:is\(p,\s*li\)\s*\{[^}]*color:\s*var\(--prose-foreground\);/,
    )
    expect(markdown).toMatch(
      /:is\(strong,\s*b\)\s*\{[^}]*color:\s*var\(--color-fg-default\);[^}]*font-style:\s*italic;/,
    )
    expect(markdown).toMatch(
      /:is\(h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\)\s*\{[^}]*line-height:\s*calc\(var\(--leading-offset\) \+ 1em\);[^}]*text-wrap:\s*balance;/,
    )
    expect(markdown).toMatch(
      /pre\s*\{[^}]*> code\s*\{[^}]*font-size:\s*inherit;[^}]*line-height:\s*inherit;/,
    )
    expect(markdown).toMatch(
      /:is\(code,\s*kbd,\s*pre,\s*samp\)\s*\{[^}]*font-family:\s*var\(--font-mono\);/,
    )
    expect(prose).toMatch(
      /a\s*\{[^}]*text-decoration-thickness:\s*max\(1px, 0\.0625em\);[^}]*text-underline-offset:\s*-0\.06em;[^}]*text-decoration-color 0\.2s ease;/,
    )
    expect(root).toMatch(
      /:is\(\.gsc-comment-author,\s*\.gsc-reply-author\)\s+\.link-primary\s*\{[^}]*font-size:\s*var\(--step-0\);/,
    )
    expect(cssBlock(prose, "a")).toMatch(
      /&:hover\s*\{[^}]*text-decoration-color:\s*currentColor;/,
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
      expect(markdown).toMatch(
        new RegExp(`${heading}\\s*\\{[^}]*font-size: var\\(${step}\\);`),
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
    expect(await readFile("public/_headers", "utf8")).toMatch(
      /\/giscus\/\*\s+Access-Control-Allow-Origin:\s*https:\/\/giscus\.app/,
    )
  })
})
