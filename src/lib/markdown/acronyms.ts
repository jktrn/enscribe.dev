import {
  defineHastPlugin,
  type HastContent,
  type HastVisitorContext,
} from "satteri"
import type { Text } from "hast"

const CAPS_RUN = /[A-Z]{2,}\d*/g
const ROMAN_NUMERAL =
  /^M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/

const SKIP_TAGS = new Set([
  "code",
  "kbd",
  "math",
  "pre",
  "samp",
  "script",
  "style",
  "svg",
  "var",
])

const text = (value: string): Text => ({ type: "text", value })

const acronym = (value: string): HastContent => ({
  type: "element",
  tagName: "span",
  properties: { dataAcronym: "" },
  children: [text(value)],
})

const acronymIn = (source: string, run: string, index: number) => {
  let value = run
  const following = source[index + value.length]
  if (following !== undefined && /[a-z]/.test(following)) {
    const after = source[index + value.length + 1]
    const isPlural =
      following === "s" && (after === undefined || !/[\p{L}\p{N}]/u.test(after))
    if (!isPlural) value = value.slice(0, -1)
  }
  if (value.length < 2 || ROMAN_NUMERAL.test(value)) return null
  return value
}

const acronymParts = (source: string) => {
  const parts: HastContent[] = []
  let last = 0

  for (const match of source.matchAll(CAPS_RUN)) {
    const value = acronymIn(source, match[0], match.index)
    if (!value) continue
    if (match.index > last) parts.push(text(source.slice(last, match.index)))
    parts.push(acronym(value))
    last = match.index + value.length
  }

  if (last === 0) return null
  if (last < source.length) parts.push(text(source.slice(last)))
  return parts
}

const isExcluded = (node: Text, context: HastVisitorContext) => {
  let ancestor = context.parent(node)
  while (ancestor) {
    if (ancestor.type === "element") {
      if (
        SKIP_TAGS.has(ancestor.tagName) ||
        "dataAcronym" in ancestor.properties
      ) {
        return true
      }
    }
    if (ancestor.type === "root") break
    ancestor = context.parent(ancestor)
  }
  return false
}

export const inlineAcronyms = defineHastPlugin({
  name: "inline-acronyms",
  text(node, context) {
    if (isExcluded(node, context)) return
    const parts = acronymParts(node.value)
    if (!parts) return
    context.insertBefore(node, parts)
    context.removeNode(node)
  },
})
