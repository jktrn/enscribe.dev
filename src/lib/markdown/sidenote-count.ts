import type { ElementContent, Root } from "hast"
import { defineHastPlugin, type HastVisitorContext } from "satteri"

function countRefs(nodes: readonly ElementContent[]): number {
  let total = 0
  for (const node of nodes) {
    if (node.type !== "element") continue
    if (node.tagName === "a" && node.properties.dataFootnoteRef !== undefined) {
      total += 1
    } else {
      total += countRefs(node.children)
    }
  }
  return total
}

export const sidenoteCount = defineHastPlugin({
  name: "sidenote-count",
  before(root: Readonly<Root>, ctx: HastVisitorContext) {
    const frontmatter = (
      ctx.data.astro as { frontmatter?: Record<string, unknown> } | undefined
    )?.frontmatter
    if (!frontmatter) return
    frontmatter.sidenoteCount = countRefs(root.children as ElementContent[])
  },
})
