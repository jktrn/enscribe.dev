import { markdownToHtml, markdownToMdast, type MdastNode } from "satteri"
import { inlineAcronyms } from "./acronyms"
import { externalLinks } from "./external-links"
import { inlineExpressiveCode, plainCodeValue } from "./expressive-code/inline"
import { parentheticalTypography } from "./inline-typography"
import { linkFavicons } from "./link-favicons"
import { temmlMath } from "./math"

const FEATURES = { math: true, smartPunctuation: true }

const RENDER_OPTIONS = {
  features: FEATURES,
  mdastPlugins: [inlineExpressiveCode, temmlMath],
  hastPlugins: [inlineAcronyms],
}

const PROSE_RENDER_OPTIONS = {
  ...RENDER_OPTIONS,
  hastPlugins: [
    externalLinks,
    linkFavicons,
    parentheticalTypography,
    inlineAcronyms,
  ],
}

async function renderUnwrapped(
  value: string,
  options: Parameters<typeof markdownToHtml>[1],
): Promise<string> {
  const result = await Promise.resolve(markdownToHtml(value, options))
  const html = result.html.trim()
  const inner = html.slice(3, -4)
  return html.startsWith("<p>") &&
    html.endsWith("</p>") &&
    !inner.includes("</p>")
    ? inner
    : html
}

export function renderInline(value: string): Promise<string> {
  return renderUnwrapped(value, RENDER_OPTIONS)
}

export function renderInlineProse(value: string): Promise<string> {
  return renderUnwrapped(value, PROSE_RENDER_OPTIONS)
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
