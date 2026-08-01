import type { BreakKind } from "../layout/breaker"
import { LINE_SELECTOR, TYPESET_SELECTOR } from "./render"

/**
 * One span per line changes how the browser serializes a selection: each line
 * is a block box, so it contributes a newline that was never in the source.
 *
 * Lines that consumed a space now carry a real trailing space text node, so
 * only the newline needs undoing. A line ended by an authored `<br>` keeps its
 * newline; the paragraph's last line keeps the block boundary it always had.
 */
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

const lineKind = (line: HTMLElement) =>
  line.dataset.linebreakLine as BreakKind | undefined

const plainText = (range: Range) => {
  let text = ""

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += clippedText(node as Text, range)
      return
    }
    if (!(node instanceof Element)) return

    const { display } = getComputedStyle(node)
    if (display === "none") return
    if (node.tagName === "BR") {
      text += "\n"
      return
    }

    walkChildren(node)

    if (node.matches(LINE_SELECTOR)) {
      const next = node.nextSibling
      if (!next || !range.intersectsNode(next)) return
      // "space" lines already carry their trailing space; "none" and "hyphen"
      // breaks consumed no character at all.
      if (lineKind(node as HTMLElement) === "forced") text += "\n"
      return
    }
    if (
      generatesBlockBox(node, display) &&
      text !== "" &&
      !text.endsWith("\n")
    ) {
      text += "\n"
    }
  }

  const walkChildren = (node: Node) => {
    for (const child of node.childNodes) {
      if (range.intersectsNode(child)) walk(child)
    }
  }

  const root = range.commonAncestorContainer
  if (root.nodeType === Node.TEXT_NODE) return clippedText(root as Text, range)
  walkChildren(root)
  return text
}

/**
 * Register on `document` to keep copied text faithful:
 *
 * ```ts
 * document.addEventListener("copy", handleCopy, { signal })
 * ```
 *
 * A selection containing no generated lines is left entirely alone.
 */
export const handleCopy = (event: ClipboardEvent) => {
  const selection = getSelection()
  if (!selection || selection.rangeCount !== 1 || !event.clipboardData) return

  const range = selection.getRangeAt(0)
  // Cheap rejection before cloning anything: most copies are not ours.
  const container = range.commonAncestorContainer
  const scope =
    container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement
  if (!scope?.closest(TYPESET_SELECTOR) && !scope?.querySelector(LINE_SELECTOR)) {
    return
  }

  const holder = document.createElement("div")
  holder.appendChild(range.cloneContents())

  const lines = holder.querySelectorAll<HTMLElement>(LINE_SELECTOR)
  if (lines.length === 0) return

  const text = plainText(range)

  for (const line of lines) {
    if (line.nextSibling && lineKind(line) === "forced") {
      line.appendChild(document.createElement("br"))
    }
    line.replaceWith(...line.childNodes)
  }
  for (const element of holder.querySelectorAll<HTMLElement>("*")) {
    for (const key of Object.keys(element.dataset)) {
      if (key.startsWith("linebreak")) delete element.dataset[key]
    }
  }

  event.clipboardData.setData("text/plain", text)
  event.clipboardData.setData("text/html", holder.innerHTML)
  event.preventDefault()
}
