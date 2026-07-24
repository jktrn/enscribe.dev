import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineMdastPlugin } from "satteri"
import {
  escapeAttribute,
  readSvgSource,
  themeSvgSource,
  type ThemeMode,
} from "../assets/themed-svg"

export const isInlineDiagramSvg = (source: string) =>
  /<svg\b[^>]*\bdata-diagram(?:\s*=|\s|>)/i.test(source)

const requireSibling = (path: string, url: string) => {
  if (!existsSync(path)) {
    throw new Error(
      `${url}: themed pair is missing its sibling (${path}) — ` +
        `*-light/*-dark siblings must both exist`,
    )
  }
}

export const inlineSvg = defineMdastPlugin({
  name: "inline-svg",
  image(node, ctx) {
    if (!node.url.startsWith(".") || !ctx.fileURL) return

    const pair = node.url.match(/^(.*)-(?:light|dark)\.(\w+)$/)
    const label = node.alt?.trim()
    const dir = dirname(fileURLToPath(ctx.fileURL))

    if (pair) {
      const [, base, ext] = pair

      if (ext !== "svg") {
        for (const mode of ["light", "dark"]) {
          requireSibling(resolve(dir, `${base}-${mode}.${ext}`), node.url)
        }
        const variant = (mode: ThemeMode) => ({
          type: "image" as const,
          url: `${base}-${mode}.${ext}`,
          alt: label ?? "",
          data: { hProperties: { [`data-theme-${mode}`]: "" } },
        })
        ctx.insertAfter(node, variant("dark"))
        ctx.replaceNode(node, variant("light"))
        return
      }

      const light = resolve(dir, `${base}-light.svg`)
      const dark = resolve(dir, `${base}-dark.svg`)
      requireSibling(light, node.url)
      requireSibling(dark, node.url)
      const lightSource = readSvgSource(light)
      const darkSource = readSvgSource(dark)
      if (lightSource.includes("<image") || darkSource.includes("<image")) {
        throw new Error(
          `${node.url}: raster-bearing SVG pairs belong in ` +
            `graphics/blog/<post>/; move them there and reference the ` +
            `rendered webp pair instead (see graphics/README.md)`,
        )
      }
      const prefix = `themed-${createHash("sha256").update(resolve(dir, base)).digest("hex").slice(0, 8)}`
      ctx.replaceNode(node, {
        type: "html",
        value:
          themeSvgSource(lightSource, "light", prefix, label) +
          themeSvgSource(darkSource, "dark", prefix, label),
      })
      return
    }

    if (!node.url.endsWith(".svg")) return

    const source = readSvgSource(resolve(dir, node.url))
    if (!isInlineDiagramSvg(source)) return

    const svg = source.replace(
      /<svg\b/i,
      label
        ? `<svg role="img" aria-label="${escapeAttribute(label)}"`
        : '<svg aria-hidden="true"',
    )

    ctx.replaceNode(node, { type: "html", value: svg })
  },
})
