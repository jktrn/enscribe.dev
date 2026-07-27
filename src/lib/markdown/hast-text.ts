import type { Element, ElementContent } from "hast"

const nodeText = (node: ElementContent): string => {
  if (node.type === "text") return node.value
  if (node.type === "element") return plainText(node)
  const raw = "value" in node ? String(node.value) : ""
  return raw.replace(/<[^>]*>/g, "")
}

export const plainText = (node: Readonly<Element>): string =>
  node.children.map(nodeText).join("")
