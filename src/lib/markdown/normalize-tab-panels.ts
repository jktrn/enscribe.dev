import type { Element, ElementContent } from "hast"
import { defineHastPlugin } from "satteri"

const isElement = (
  node: ElementContent | undefined,
  tagName?: string,
): node is Element =>
  node?.type === "element" &&
  (tagName === undefined || node.tagName === tagName)

const directChildren = (node: Readonly<Element>, tagName?: string): Element[] =>
  (node.children ?? []).filter((child) => isElement(child, tagName))

const isCodeBlock = (node: Readonly<Element> | undefined): boolean =>
  isElement(node, "pre") && directChildren(node, "code").length > 0

const isCodeOnlyPanel = (panel: Readonly<Element>): boolean => {
  const children = directChildren(panel)
  return children.length === 1 && isCodeBlock(children[0])
}

export const normalizeTabPanels = defineHastPlugin({
  name: "normalize-tab-panels",
  element: {
    filter: ["tab-group"],
    visit(group, ctx) {
      const panels = directChildren(group, "section")
      if (panels.length > 0 && panels.every(isCodeOnlyPanel)) {
        ctx.setProperty(group, "dataCodeTabs", "")
      }
    },
  },
})
