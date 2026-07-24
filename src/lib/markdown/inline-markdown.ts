import { markdownToHtml, markdownToMdast, type MdastNode } from "satteri"
import { inlineAcronyms } from "./acronyms"
import { inlineExpressiveCode, plainCodeValue } from "./expressive-code/inline"
import { temmlMath } from "./math"

const FEATURES = { math: true, smartPunctuation: true }

const RENDER_OPTIONS = {
  features: FEATURES,
  mdastPlugins: [inlineExpressiveCode, temmlMath],
  hastPlugins: [inlineAcronyms],
}

export async function renderInline(value: string): Promise<string> {
  const result = await Promise.resolve(markdownToHtml(value, RENDER_OPTIONS))
  const html = result.html.trim()
  const inner = html.slice(3, -4)
  return html.startsWith("<p>") &&
    html.endsWith("</p>") &&
    !inner.includes("</p>")
    ? inner
    : html
}

type TextNode = MdastNode & { value?: string; children?: MdastNode[] }

function collectText(node: TextNode): string {
  switch (node.type) {
    case "text":
    case "inlineMath":
    case "math":
      return node.value ?? ""
    case "inlineCode":
      return plainCodeValue(node.value ?? "")
    case "break":
      return " "
    case "html":
      return /^<br[\s/>]/i.test(node.value ?? "") ? " " : ""
    default: {
      const text = (node.children ?? []).map(collectText).join("")
      return node.type === "paragraph" ? `${text} ` : text
    }
  }
}

export function plainInline(value: string): string {
  return collectText(markdownToMdast(value, { features: FEATURES }))
    .replace(/\s+/g, " ")
    .trim()
}
