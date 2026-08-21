// Manual graphics tool: renders themed SVG sources into committed blog assets.
// The site build does not read from graphics/.
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import sharp from "sharp"
import { ramp } from "../src/lib/assets/themed-svg"

const GRAPHICS_BLOG = "graphics/blog"
const GRAPHICS_FONTS = "graphics/fonts"
const CONTENT_BLOG = "src/content/blog"

if (process.platform === "darwin") {
  for (const font of readdirSync(GRAPHICS_FONTS)) {
    const target = join(homedir(), "Library/Fonts", font)
    if (!existsSync(target)) {
      copyFileSync(join(GRAPHICS_FONTS, font), target)
      console.log(`installed ${font} -> ~/Library/Fonts`)
    }
  }
}

function resolveTokens(source: string, mode: "light" | "dark", path: string) {
  return Buffer.from(
    source.replace(
      /var\(--((?:background|foreground|accent)-l\d+)\)/g,
      (match, token) => {
        const hex = ramp[mode].get(token)
        if (!hex) throw new Error(`${path}: no ${mode} value for ${match}`)
        return hex
      },
    ),
  )
}

async function renderOgCard(svg: Buffer, width: number, outDir: string) {
  const out = join(outDir, "banner-og.png")
  await sharp(svg, { density: (72 * 1200) / width, limitInputPixels: false })
    .resize(1200)
    .png({ compressionLevel: 9, quality: 90, effort: 10 })
    .toFile(out)
  return out
}

const masters = readdirSync(GRAPHICS_BLOG, { recursive: true })
  .map(String)
  .filter((path) => /-(light|dark)\.svg$/.test(path))

if (masters.length === 0) {
  console.error(`no *-{light,dark}.svg sources found under ${GRAPHICS_BLOG}`)
  process.exit(1)
}

const outputs = await Promise.all(
  masters.map(async (relative) => {
    const path = join(GRAPHICS_BLOG, relative)
    const post = relative.split("/")[0]
    const stem = basename(relative, ".svg")
    const mode = stem.endsWith("-dark") ? "dark" : "light"
    const source = readFileSync(path, "utf8")

    const outDir = join(CONTENT_BLOG, post, "assets")
    if (!existsSync(outDir)) {
      throw new Error(`${path}: no post at ${outDir}`)
    }

    const svg = resolveTokens(source, mode, path)

    const { width = 1200 } = await sharp(svg, {
      limitInputPixels: false,
    }).metadata()
    const target = Math.min(width, 1200) * 2
    const out = join(outDir, `${stem}.webp`)
    await sharp(svg, {
      density: (72 * target) / width,
      limitInputPixels: false,
    })
      .resize(target)
      .webp({ quality: 84 })
      .toFile(out)

    if (stem !== "banner-dark") return [out]
    return [out, await renderOgCard(svg, width, outDir)]
  }),
)

const contentOnly = readdirSync(CONTENT_BLOG).filter(
  (post) =>
    existsSync(join(CONTENT_BLOG, post, "assets/banner-dark.svg")) &&
    !existsSync(join(GRAPHICS_BLOG, post, "banner-dark.svg")),
)
const contentCards = await Promise.all(
  contentOnly.map(async (post) => {
    const outDir = join(CONTENT_BLOG, post, "assets")
    const path = join(outDir, "banner-dark.svg")
    const svg = resolveTokens(readFileSync(path, "utf8"), "dark", path)
    const { width = 1200 } = await sharp(svg, {
      limitInputPixels: false,
    }).metadata()
    return renderOgCard(svg, width, outDir)
  }),
)

for (const out of [...outputs.flat(), ...contentCards]) console.log(out)
