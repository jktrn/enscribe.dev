import type { ComposeReason } from "../../types"
import { ATTRIBUTES } from "../../attributes"
import type { StyleReader } from "../style"
import { DECORATION, OBJECT_REPLACEMENT } from "./runs"

type RawBase = { wrappers: HTMLElement[] }

export type RawText = RawBase & {
  kind: "text"
  noWrapOwner?: Element
  text: string
  sourceElement: HTMLElement
}

export type RawAtom = RawBase & {
  kind: "atom"
  text: typeof OBJECT_REPLACEMENT
  sourceElement: Element
}

export type RawBreak = RawBase & {
  kind: "break"
  sourceElement: HTMLElement
  forced: boolean
}

export type Raw = RawText | RawAtom | RawBreak

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml"

type Layout =
  | "hidden"
  | "contents"
  | "inline"
  | "atom"
  | "break"
  | "unsupported"

type Descent = {
  readonly wrappers: HTMLElement[]
  readonly noWrapOwner: Element | undefined
  readonly collapses: boolean
}

const displayLayout = (element: Element, display: string): Layout => {
  if (
    display === "math" ||
    display === "ruby" ||
    display.startsWith("inline-")
  ) {
    return "atom"
  }
  if (element.namespaceURI !== HTML_NAMESPACE) {
    return display === "inline" ? "atom" : "unsupported"
  }
  if (display === "contents") return "contents"
  if (display === "inline") return "inline"
  return "unsupported"
}

const elementLayout = (element: Element, display: string): Layout => {
  if (display === "none") return "hidden"

  if (element.namespaceURI === HTML_NAMESPACE && element.matches("br, wbr"))
    return "break"
  if (element.hasAttribute(ATTRIBUTES.atom)) return "atom"

  if (
    element.namespaceURI === HTML_NAMESPACE &&
    element.localName === "input"
  ) {
    return (element as HTMLInputElement).disabled ? "atom" : "unsupported"
  }
  if (element.namespaceURI === HTML_NAMESPACE && element.localName === "img")
    return "atom"
  return displayLayout(element, display)
}

const childDescent = (
  element: HTMLElement,
  descent: Descent,
  style: CSSStyleDeclaration,
  noWrapOwner: Element | undefined,
): Descent => ({
  wrappers: [...descent.wrappers, element],
  noWrapOwner,
  collapses: style.whiteSpaceCollapse === "collapse",
})

export class RawCollector {
  readonly raws: Raw[] = []

  constructor(
    private readonly block: HTMLElement,
    private readonly styleOf: StyleReader,
  ) {}

  collect(): ComposeReason | null {
    const style = this.styleOf(this.block)
    const descent: Descent = {
      wrappers: [],
      noWrapOwner: style.textWrapMode === "nowrap" ? this.block : undefined,
      collapses: style.whiteSpaceCollapse === "collapse",
    }

    for (const child of this.block.childNodes) {
      if (!this.visit(child, descent)) {
        return "unsupported-content"
      }
    }
    return null
  }

  private pushAtom(element: Element, wrappers: HTMLElement[]) {
    this.raws.push({
      kind: "atom",
      text: OBJECT_REPLACEMENT,
      wrappers,
      sourceElement: element,
    })
  }

  private visitText(node: Node, descent: Descent) {
    if (!node.textContent) return true
    if (!descent.collapses) {
      return false
    }
    this.raws.push({
      kind: "text",
      text: node.textContent,
      wrappers: descent.wrappers,
      sourceElement: node.parentElement!,
      noWrapOwner: descent.noWrapOwner,
    })
    return true
  }

  private emitLeaf(element: Element, layout: Layout, descent: Descent) {
    if (layout === "break") {
      this.raws.push({
        kind: "break",
        wrappers: descent.wrappers,
        sourceElement: element as HTMLElement,
        forced: element.matches("br"),
      })
      return true
    }
    if (layout === "atom") {
      this.pushAtom(element, descent.wrappers)
      return true
    }
    return false
  }

  private descend(
    element: Element,
    descent: Descent,
    inner: Descent,
    inline: boolean,
  ): boolean {
    const before = this.raws.length
    for (const child of element.childNodes) {
      if (!this.visit(child, inner)) return false
    }

    if (!inline || this.raws.length !== before) return true
    if (element.getBoundingClientRect().width > 0) {
      this.pushAtom(element, descent.wrappers)
    }
    return true
  }

  private visitElement(element: Element, descent: Descent): boolean {
    if (element.matches(DECORATION)) return true

    const style = this.styleOf(element)
    const layout = elementLayout(element, style.display)
    if (layout === "hidden") return true
    if (layout === "unsupported") {
      return false
    }

    if (this.emitLeaf(element, layout, descent)) return true

    const nowrap = style.textWrapMode === "nowrap"
    const noWrapOwner = nowrap ? (descent.noWrapOwner ?? element) : undefined
    const inner = childDescent(
      element as HTMLElement,
      descent,
      style,
      noWrapOwner,
    )
    return this.descend(element, descent, inner, layout === "inline")
  }

  private visit(node: Node, descent: Descent): boolean {
    if (node.nodeType === Node.TEXT_NODE) return this.visitText(node, descent)
    if (node.nodeType !== Node.ELEMENT_NODE) return true
    return this.visitElement(node as Element, descent)
  }
}
