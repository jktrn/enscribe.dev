import { LINE_SELECTOR, TYPESET_SELECTOR } from "./render"
import { ATTRIBUTES } from "../attributes"

const generatesBlockBox = (element: Element, display: string) =>
  display !== "contents" &&
  !display.startsWith("inline") &&
  !element.closest("math, ruby")

const clippedText = (node: Text, range: Range) => {
  const start = node === range.startContainer ? range.startOffset : 0
  const end = node === range.endContainer ? range.endOffset : node.data.length
  return node.data.slice(start, end)
}

type Copy = { readonly range: Range; text: string }

const needsBlockBoundary = (node: Element, display: string, text: string) =>
  generatesBlockBox(node, display) && text !== "" && !text.endsWith("\n")

const walkNode = (node: Node, copy: Copy) => {
  if (node.nodeType === Node.TEXT_NODE) {
    copy.text += clippedText(node as Text, copy.range)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const element = node as Element
  // A document selection belongs to a live window.
  const view = element.ownerDocument.defaultView!
  const { display } = view.getComputedStyle(element)
  if (display === "none") return
  if (element.tagName === "BR") {
    copy.text += "\n"
    return
  }

  if (needsBlockBoundary(element, display, copy.text)) copy.text += "\n"
  walkChildren(node, copy)
  if (needsBlockBoundary(element, display, copy.text)) copy.text += "\n"
}

const walkChildren = (node: Node, copy: Copy) => {
  for (const child of node.childNodes) {
    if (copy.range.intersectsNode(child)) walkNode(child, copy)
  }
}

const plainText = (range: Range) => {
  const root = range.commonAncestorContainer
  const copy: Copy = { range, text: "" }
  walkChildren(root, copy)
  return copy.text
}

const touchesTypeset = (scope: Element) =>
  scope.closest(TYPESET_SELECTOR) || scope.querySelector(LINE_SELECTOR)

const stripLinebreakMarkup = (holder: HTMLElement) => {
  for (const line of holder.querySelectorAll<HTMLElement>(LINE_SELECTOR)) {
    line.replaceWith(...line.childNodes)
  }
  for (const element of holder.querySelectorAll<HTMLElement>("*")) {
    const authored = element.getAttribute(ATTRIBUTES.authoredStyle)
    if (authored !== null) element.setAttribute("style", authored)
    for (const name of element.getAttributeNames()) {
      if (name.startsWith("data-linebreak")) element.removeAttribute(name)
    }
  }
}

const documentFor = (event: ClipboardEvent) => {
  const target = event.target as Node | null
  if (target?.nodeType === Node.DOCUMENT_NODE) return target as Document
  return target?.ownerDocument ?? document
}

export const handleCopy = (event: ClipboardEvent) => {
  const doc = documentFor(event)
  const selection = doc.getSelection()
  if (!selection || selection.rangeCount !== 1 || !event.clipboardData) return

  const range = selection.getRangeAt(0)
  const scope = range.commonAncestorContainer
  if (scope.nodeType !== Node.ELEMENT_NODE || !touchesTypeset(scope as Element))
    return

  const holder = doc.createElement("div")
  holder.appendChild(range.cloneContents())
  if (!holder.querySelector(LINE_SELECTOR)) return

  const text = plainText(range)
  stripLinebreakMarkup(holder)

  event.clipboardData.setData("text/plain", text)
  event.clipboardData.setData("text/html", holder.innerHTML)
  event.preventDefault()
}
