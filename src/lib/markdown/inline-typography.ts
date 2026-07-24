import type { Element, ElementContent, Text } from "hast"
import { defineHastPlugin } from "satteri"

const text = (value: string): Text => ({ type: "text", value })

const aside = (children: ElementContent[]): Element => ({
  type: "element",
  tagName: "span",
  properties: { dataParenthetical: "" },
  children,
})

const splitOnParens = (children: ElementContent[]): ElementContent[] => {
  const pieces: ElementContent[] = []
  for (const child of children) {
    if (child.type === "text") {
      for (const part of child.value.split(/([()])/)) {
        if (part !== "") pieces.push(text(part))
      }
    } else {
      pieces.push(child)
    }
  }
  return pieces
}

const wrapParentheticals = (
  children: ElementContent[],
): ElementContent[] | null => {
  const out: ElementContent[] = []
  let run: ElementContent[] | null = null
  let depth = 0
  let changed = false

  for (const piece of splitOnParens(children)) {
    const value = piece.type === "text" ? piece.value : undefined
    if (value === "(") {
      depth += 1
      if (depth === 1) {
        run = [piece]
        continue
      }
    } else if (value === ")" && depth > 0) {
      depth -= 1
      if (depth === 0 && run) {
        run.push(piece)
        out.push(aside(run))
        run = null
        changed = true
        continue
      }
    }
    if (run) run.push(piece)
    else out.push(piece)
  }

  if (run) out.push(...run)
  return changed ? out : null
}

export const parentheticalTypography = defineHastPlugin({
  name: "parenthetical-typography",
  element: {
    filter: ["p", "li", "dd", "figcaption"],
    visit(node) {
      const children = wrapParentheticals([...(node.children ?? [])])
      if (children) return { ...node, children }
    },
  },
})
