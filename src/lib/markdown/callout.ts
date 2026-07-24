import type { ElementContent } from "hast"
import type {} from "mdast-util-to-hast"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { defineMdastPlugin } from "satteri"
import { loadIcon } from "../assets/icons"

const VARIANTS: Record<string, string> = {
  note: "info-circle",
  tip: "lightbulb",
  warning: "danger-triangle",
  caution: "shield-warning",
  important: "bell",
  definition: "book-bookmark",
  notation: "hashtag-square",
  theorem: "square-academic-cap",
  proposition: "diploma",
  lemma: "ruler-angular",
  corollary: "square-academic-cap-2",
  axiom: "atom",
  conjecture: "question-circle",
  proof: "pen-2",
  remark: "chat-round-line",
  explanation: "chat-round-dots",
  intuition: "lightbulb-bolt",
  recall: "clock-circle",
  example: "clipboard-text",
  exercise: "target",
  solution: "check-circle",
  summary: "checklist-minimalistic",
}

const icons: Record<string, string> = {}
for (const name of [...new Set(Object.values(VARIANTS)), "alt-arrow-down"]) {
  icons[name] = loadIcon(`callouts/${name}`)
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const raw = (value: string): ElementContent => ({ type: "raw", value })

export const calloutDirective = defineMdastPlugin({
  name: "callout-directive",
  containerDirective(node, ctx) {
    const iconName = VARIANTS[node.name]
    if (!iconName) return

    const first = node.children?.[0]
    const isLabel =
      first?.type === "paragraph" &&
      (first.data as { directiveLabel?: boolean })?.directiveLabel === true

    const title = capitalize(node.name)
    const icon = icons[iconName]
    const chevron = icons["alt-arrow-down"]

    if (isLabel) {
      ctx.setProperty(first, "data", { hName: "summary" })
      ctx.prependChild(first, {
        type: "html",
        value: `${icon}<span>${title}<span> (`,
      })
      ctx.appendChild(first, {
        type: "html",
        value: `)</span></span>${chevron}`,
      })
    } else {
      const summary = toHtml(
        h("summary", [raw(icon), h("span", title), raw(chevron)]),
        { allowDangerousHtml: true },
      )
      ctx.prependChild(node, { type: "html", value: summary })
    }

    const closed = !!node.attributes && "closed" in node.attributes

    ctx.setProperty(node, "data", {
      hName: "details",
      hProperties: {
        dataCallout: node.name,
        open: !closed,
      },
    })
  },
})
