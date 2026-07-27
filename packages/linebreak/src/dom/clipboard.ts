import type { BreakKind } from "../layout/breaker"
import { LINE_SELECTOR } from "./render"

const generatesBlockBox = (display: string) =>
  display !== "contents" && display !== "none" && !display.startsWith("inline")

const clippedText = (node: Text, range: Range) => {
  const start = node === range.startContainer ? range.startOffset : 0
  const end = node === range.endContainer ? range.endOffset : node.data.length
  return node.data.slice(start, end)
}

const lineJoin = (line: HTMLElement, range: Range) => {
  const next = line.nextSibling
  if (!next || !range.intersectsNode(next)) return ""
  const kind = line.dataset.linebreakBreak as BreakKind | undefined
  if (kind === "space") return " "
  if (kind === "forced") return "\n"
  return ""
}

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
      text += lineJoin(node as HTMLElement, range)
      return
    }
    if (generatesBlockBox(display) && text !== "" && !text.endsWith("\n")) {
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

export const cleanCopiedLinebreaks = (event: ClipboardEvent) => {
  const selection = getSelection()
  if (!selection || selection.rangeCount !== 1 || !event.clipboardData) return

  const range = selection.getRangeAt(0)
  const holder = document.createElement("div")
  holder.appendChild(range.cloneContents())

  const lines = holder.querySelectorAll<HTMLElement>(LINE_SELECTOR)
  if (lines.length === 0) return

  const text = plainText(range)

  for (const line of lines) {
    if (line.nextSibling) {
      const kind = line.dataset.linebreakBreak as BreakKind | undefined
      if (kind === "space") line.appendChild(document.createTextNode(" "))

      if (kind === "forced") line.appendChild(document.createElement("br"))
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
