import {
  defineMdastPlugin,
  type MdastNode,
  type MdastVisitorContext,
} from "satteri"
import { plainInline, renderInline } from "./inline-markdown"

const FIELDS = ["title", "description"] as const

export type InlineRendered = { html: string; text: string }

async function renderFrontmatterFields(ctx: MdastVisitorContext) {
  const data = ctx.data as {
    frontmatterInlineDone?: boolean
    astro?: { frontmatter?: Record<string, unknown> }
  }
  if (data.frontmatterInlineDone) return
  data.frontmatterInlineDone = true

  const frontmatter = data.astro?.frontmatter
  if (!frontmatter) return

  const inline: Partial<Record<(typeof FIELDS)[number], InlineRendered>> = {}
  for (const field of FIELDS) {
    const value = frontmatter[field]
    if (typeof value === "string" && value) {
      inline[field] = {
        html: await renderInline(value),
        text: plainInline(value),
      }
    }
  }
  frontmatter.inline = inline
}

const visit = (_node: Readonly<MdastNode>, ctx: MdastVisitorContext) =>
  renderFrontmatterFields(ctx)

export const frontmatterInline = defineMdastPlugin({
  name: "frontmatter-inline",
  blockquote: visit,
  code: visit,
  containerDirective: visit,
  footnoteDefinition: visit,
  heading: visit,
  html: visit,
  leafDirective: visit,
  list: visit,
  math: visit,
  paragraph: visit,
  table: visit,
  thematicBreak: visit,
})
