import { LINE_SELECTOR, TYPESET_SELECTOR } from "./render"

const generatesBlockBox = (element: Element, display: string) =>
  display !== "contents" &&
  display !== "none" &&
  !display.startsWith("inline") &&
  !element.closest("math, ruby")

const clippedText = (node: Text, range: Range) => {
  const start = node === range.startContainer ? range.startOffset : 0
  const end = node === range.endContainer ? range.endOffset : node.data.length
  return node.data.slice(start, end)
}

type Copy = { readonly range: Range; text: string }

const endsBlock = (node: Element, display: string, text: string) =>
  generatesBlockBox(node, display) && text !== "" && !text.endsWith("\n")

const walkNode = (node: Node, copy: Copy) => {
  if (node.nodeType === Node.TEXT_NODE) {
    copy.text += clippedText(node as Text, copy.range)
    return
  }
  if (!(node instanceof Element)) return

  const { display } = getComputedStyle(node)
  if (display === "none") return
  if (node.tagName === "BR") {
    copy.text += "\n"
    return
  }

  walkChildren(node, copy)
  if (endsBlock(node, display, copy.text)) copy.text += "\n"
}

const walkChildren = (node: Node, copy: Copy) => {
  for (const child of node.childNodes) {
    if (copy.range.intersectsNode(child)) walkNode(child, copy)
  }
}

const plainText = (range: Range) => {
  const root = range.commonAncestorContainer
  if (root.nodeType === Node.TEXT_NODE) return clippedText(root as Text, range)

  const copy: Copy = { range, text: "" }
  walkChildren(root, copy)
  return copy.text
}

const scopeOf = (range: Range) => {
  const container = range.commonAncestorContainer
  if (container.nodeType === Node.ELEMENT_NODE) return container as Element
  return container.parentElement
}

const touchesTypeset = (scope: Element | null) =>
  Boolean(scope?.closest(TYPESET_SELECTOR)) ||
  Boolean(scope?.querySelector(LINE_SELECTOR))

const stripLinebreakMarkup = (holder: HTMLElement) => {
  for (const line of holder.querySelectorAll<HTMLElement>(LINE_SELECTOR)) {
    line.replaceWith(...line.childNodes)
  }
  for (const element of holder.querySelectorAll<HTMLElement>("*")) {
    for (const key of Object.keys(element.dataset)) {
      if (key.startsWith("linebreak")) delete element.dataset[key]
    }
  }
}

export const handleCopy = (event: ClipboardEvent) => {
  const selection = getSelection()
  if (!selection || selection.rangeCount !== 1 || !event.clipboardData) return

  const range = selection.getRangeAt(0)
  if (!touchesTypeset(scopeOf(range))) return

  const holder = document.createElement("div")
  holder.appendChild(range.cloneContents())
  if (!holder.querySelector(LINE_SELECTOR)) return

  const text = plainText(range)
  stripLinebreakMarkup(holder)

  event.clipboardData.setData("text/plain", text)
  event.clipboardData.setData("text/html", holder.innerHTML)
  event.preventDefault()
}
