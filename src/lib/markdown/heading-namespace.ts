import GithubSlugger from "github-slugger"
import { defineHastPlugin } from "satteri"
import { plainText } from "./hast-text"

const SUBPOST = /\/blog\/[^/]+\/(?!index\.md$)([^/]+)\.md$/

export function headingNamespace() {
  const slugger = new GithubSlugger()
  return defineHastPlugin({
    name: "heading-namespace",
    element: {
      filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
      visit(node, ctx) {
        const prefix = ctx.fileURL && SUBPOST.exec(ctx.fileURL.pathname)?.[1]
        if (!prefix) return
        ctx.setProperty(
          node,
          "id",
          `${prefix}-${slugger.slug(plainText(node))}`,
        )
      },
    },
  })
}
