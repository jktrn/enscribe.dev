import { FLUSH_LINE_CLASS, HYPHEN_CLASS, LINE_CLASS } from "./render"

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DETAILS",
  "DIALOG",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HGROUP",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TD",
  "TH",
  "TR",
  "UL",
])

const plainText = (root: ParentNode) => {
  let text = ""
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ""
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === "BR") {
      text += "\n"
      return
    }
    for (const child of node.childNodes) walk(child)
    if (BLOCK_TAGS.has(node.tagName) && text !== "" && !text.endsWith("\n")) {
      text += "\n"
    }
  }
  for (const child of root.childNodes) walk(child)
  return text
}

export const cleanCopiedLinebreaks = (event: ClipboardEvent) => {
  const selection = getSelection()
  if (!selection || selection.rangeCount !== 1 || !event.clipboardData) return

  const holder = document.createElement("div")
  holder.appendChild(selection.getRangeAt(0).cloneContents())

  const lines = holder.querySelectorAll<HTMLElement>(`.${LINE_CLASS}`)
  if (lines.length === 0) return

  for (const line of lines) {
    if (line.nextSibling) {
      const kind = line.dataset.linebreakBreak
      if (kind === "space") line.appendChild(document.createTextNode(" "))

      if (kind === "forced") line.appendChild(document.createElement("br"))
    }
    line.classList.remove(LINE_CLASS, FLUSH_LINE_CLASS, HYPHEN_CLASS)
    line.replaceWith(...line.childNodes)
  }
  for (const element of holder.querySelectorAll<HTMLElement>("*")) {
    for (const key of Object.keys(element.dataset)) {
      if (key.startsWith("linebreak")) delete element.dataset[key]
    }
  }

  event.clipboardData.setData("text/plain", plainText(holder))
  event.clipboardData.setData("text/html", holder.innerHTML)
  event.preventDefault()
}
