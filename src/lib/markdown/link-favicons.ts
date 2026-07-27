import { defineHastPlugin } from "satteri"
import type { ElementContent } from "hast"
import { assertLinkIconAsset, linkIconForHost } from "../link-icons"

const containsMedia = (children: readonly ElementContent[]): boolean =>
  children.some(
    (child) =>
      child.type === "element" &&
      (["img", "svg", "picture", "video"].includes(child.tagName) ||
        containsMedia(child.children)),
  )

const icon = (asset: string) => ({
  type: "element" as const,
  tagName: "span",
  properties: {
    "aria-hidden": "true",
    "data-favicon": "",
    "data-favicon-position": "after",
    "data-favicon-icon": asset,
    "data-linebreak-decoration": "",
    "data-linebreak-decoration-position": "after",
    style: `--favicon-mask:url("${assertLinkIconAsset(asset)}")`,
  },
  children: [],
})

export const linkFavicons = defineHastPlugin({
  name: "link-favicons",
  element: {
    filter: ["a"],
    visit(node, ctx) {
      const href = node.properties.href
      if (typeof href !== "string" || !/^https?:\/\//.test(href)) return
      if (containsMedia(node.children)) return

      const favicon = icon(linkIconForHost(new URL(href).hostname))
      const lastIndex = node.children.length - 1
      const last = node.children[lastIndex]
      const suffix =
        last?.type === "text" ? /(\S{1,8})(\s*)$/u.exec(last.value) : undefined

      if (last?.type === "text" && suffix) {
        const before = last.value.slice(0, suffix.index)
        const glue = {
          type: "element" as const,
          tagName: "span",
          properties: {
            "data-linebreak-atom": "",
            "data-favicon-glue": "",
          },
          children: [{ type: "text" as const, value: suffix[1] }, favicon],
        }
        ctx.removeChildAt(node, lastIndex)
        ctx.appendChild(node, [
          ...(before ? [{ type: "text" as const, value: before }] : []),
          glue,
          ...(suffix[2] ? [{ type: "text" as const, value: suffix[2] }] : []),
        ])
        return
      }

      if (last?.type === "element") {
        ctx.appendChild(last, favicon)
        return
      }

      ctx.appendChild(node, favicon)
    },
  },
})
