import type { Element, ElementContent, Text } from "hast"
import type { Raw } from "mdast-util-to-hast"
import { defineHastPlugin, defineMdastPlugin } from "satteri"

const PHRASING_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "button",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "mark",
  "math",
  "q",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "svg",
  "time",
  "u",
  "var",
  "wbr",
])

const BLOCK_RAW_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "div",
  "dl",
  "fieldset",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
])

const BLOCK_ELEMENT_TAGS = new Set(
  [...BLOCK_RAW_TAGS].filter((tagName) => tagName !== "ol" && tagName !== "ul"),
)

const PROSE_BLOCK_TAGS = new Set([
  ...BLOCK_ELEMENT_TAGS,
  "file-tree",
  "math-display",
  "step-list",
  "tab-group",
])

const rawTagName = (value: string) =>
  /^<\s*\/?\s*([a-z][a-z0-9-]*)\b/i.exec(value)?.[1]?.toLowerCase()

const hasClass = (node: Readonly<Element>, className: string) => {
  const value = node.properties.className
  return Array.isArray(value) && value.includes(className)
}

const isText = (node: ElementContent): node is Text => node.type === "text"

const isRaw = (node: ElementContent): node is Raw => node.type === "raw"

const isWhitespace = (node: ElementContent) =>
  isText(node) && node.value.trim() === ""

const lineBreakBefore = (
  children: readonly ElementContent[],
  index: number,
) => {
  const previous = children[index - 1]
  return !previous || (isText(previous) && /\n\s*$/.test(previous.value))
}

const lineBreakAfter = (children: readonly ElementContent[], index: number) => {
  const next = children[index + 1]
  return !next || (isText(next) && /^\s*\n/.test(next.value))
}

const isBlockRaw = (
  node: ElementContent,
  children: readonly ElementContent[],
  index: number,
) => {
  if (!isRaw(node)) return false
  const tagName = rawTagName(node.value)
  if (!tagName) return false
  if (BLOCK_RAW_TAGS.has(tagName)) return true
  return (
    tagName.includes("-") &&
    !tagName.endsWith("-span") &&
    lineBreakBefore(children, index) &&
    lineBreakAfter(children, index)
  )
}

const splitFusedRawText = (
  children: ElementContent[],
): ElementContent[] | undefined => {
  let changed = false
  const out: ElementContent[] = []

  children.forEach((child, i) => {
    if (!isRaw(child) || !isBlockRaw(child, children, i)) {
      out.push(child)
      return
    }
    const tagName = rawTagName(child.value)
    const closings = tagName
      ? [...child.value.matchAll(new RegExp(`</\\s*${tagName}\\s*>`, "gi"))]
      : []
    const last = closings.at(-1)
    if (!last) {
      out.push(child)
      return
    }
    const end = (last.index ?? 0) + last[0].length
    const rest = child.value.slice(end)
    const restTag = rawTagName(rest.replace(/^\s+/, ""))
    if (rest.trim() === "" || (restTag && BLOCK_RAW_TAGS.has(restTag))) {
      out.push(child)
      return
    }
    out.push({ ...child, value: child.value.slice(0, end) })
    out.push({ type: "raw", value: rest })
    changed = true
  })

  return changed ? out : undefined
}

const isBlockChild = (
  node: ElementContent,
  children: readonly ElementContent[],
  index: number,
) => {
  if (isWhitespace(node)) return false
  if (isBlockRaw(node, children, index)) return true
  return (
    node.type === "element" &&
    (PROSE_BLOCK_TAGS.has(node.tagName) || hasClass(node, "expressive-code"))
  )
}

const isStandaloneImage = (
  node: ElementContent,
  children: readonly ElementContent[],
  index: number,
) =>
  node.type === "element" &&
  node.tagName === "img" &&
  lineBreakBefore(children, index) &&
  lineBreakAfter(children, index)

const isPhrasingChild = (
  node: ElementContent,
  children: readonly ElementContent[],
  index: number,
) => {
  if (node.type === "text" || node.type === "comment") return true
  if (isRaw(node)) return !isBlockRaw(node, children, index)
  return (
    node.type === "element" &&
    (PHRASING_TAGS.has(node.tagName) || node.tagName.endsWith("-span"))
  )
}

const trimText = (node: Text, start: boolean, end: boolean): Text => {
  let value = node.value
  if (start) value = value.replace(/^\s+/, "")
  if (end) value = value.replace(/\s+$/, "")
  return { ...node, value }
}

const trimRun = (children: ElementContent[]): ElementContent[] => {
  let start = 0
  let end = children.length

  while (start < end && isWhitespace(children[start])) start++
  while (end > start && isWhitespace(children[end - 1])) end--

  const run = children.slice(start, end)
  const trimmedRun: ElementContent[] = []

  run.forEach((child, i) => {
    if (!isText(child)) {
      trimmedRun.push(child)
      return
    }
    const trimmed = trimText(child, i === 0, i === run.length - 1)
    if (trimmed.value) trimmedRun.push(trimmed)
  })

  return trimmedRun
}

const hasVisibleContent = (children: ElementContent[]) =>
  children.some((child) => !isText(child) || child.value.trim() !== "")

const paragraph = (children: ElementContent[]): Element => ({
  type: "element",
  tagName: "p",
  properties: {},
  children,
})

export const loosenRichListItems = defineMdastPlugin({
  name: "loosen-rich-list-items",
  listItem(node, ctx) {
    const children = node.children ?? []
    const hasParagraph = children.some((child) => child.type === "paragraph")
    const hasNonListBlock = children.some(
      (child) => child.type !== "paragraph" && child.type !== "list",
    )

    if (hasParagraph && hasNonListBlock) {
      ctx.setProperty(node, "spread", true)
    }
  },
})

export const normalizeListItemFlow = defineHastPlugin({
  name: "normalize-list-item-flow",
  element: {
    filter: ["li"],
    visit(node) {
      const original = [...(node.children ?? [])] as ElementContent[]
      const children = splitFusedRawText(original) ?? original
      const needsFlow = children.some(
        (child, i) =>
          isBlockChild(child, children, i) ||
          isStandaloneImage(child, children, i),
      )
      if (!needsFlow) return

      const normalized: ElementContent[] = []
      let run: ElementContent[] = []
      let changed = false

      const flush = () => {
        const trimmed = trimRun(run)
        if (hasVisibleContent(trimmed)) {
          normalized.push(paragraph(trimmed))
          changed = true
        }
        run = []
      }

      children.forEach((child, i) => {
        if (isStandaloneImage(child, children, i)) {
          flush()
          normalized.push(paragraph([child]))
          changed = true
        } else if (isBlockChild(child, children, i)) {
          flush()
          normalized.push(child)
        } else if (isPhrasingChild(child, children, i)) {
          run.push(child)
        } else {
          flush()
          normalized.push(child)
        }
      })
      flush()

      if (!changed) return
      return { ...node, children: normalized }
    },
  },
})
