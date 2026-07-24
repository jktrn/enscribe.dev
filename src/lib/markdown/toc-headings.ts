import type { ElementContent } from "hast"
import { toHtml } from "hast-util-to-html"
import { defineHastPlugin } from "satteri"

const hasClass = (node: ElementContent, className: string) =>
  node.type === "element" &&
  Array.isArray(node.properties.className) &&
  node.properties.className.includes(className)

const cleanForToc = (children: ElementContent[]): ElementContent[] =>
  children.flatMap((child) => {
    if (child.type !== "element") return [child]
    if (child.tagName === "a") {
      return hasClass(child, "heading-anchor")
        ? []
        : cleanForToc(child.children)
    }
    if (child.tagName === "copy-command") return cleanForToc(child.children)
    if (child.tagName === "span" && hasClass(child, "shell-prompt")) return []
    return [{ ...child, children: cleanForToc(child.children) }]
  })

export const captureTocHeadings = defineHastPlugin({
  name: "capture-toc-headings",
  element: {
    filter: ["h2", "h3", "h4"],
    visit(node, ctx) {
      const id = node.properties.id
      if (typeof id !== "string" || !id) return

      const frontmatter = (
        ctx.data.astro as { frontmatter?: Record<string, unknown> } | undefined
      )?.frontmatter
      if (!frontmatter) return

      const toc = (frontmatter.tocHtml ??= {}) as Record<string, string>
      toc[id] = toHtml(
        {
          type: "root",
          children: cleanForToc([...node.children] as ElementContent[]),
        },
        { allowDangerousHtml: true },
      ).trim()
    },
  },
})
