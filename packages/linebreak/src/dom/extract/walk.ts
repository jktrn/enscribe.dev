import type { ComposeReason } from "../../types"
import type { StyleReader } from "../style"
import { DECORATION, OBJECT_REPLACEMENT } from "./runs"

type RawBase = { wrappers: HTMLElement[]; noWrapOwner?: Element }

export type RawText = RawBase & {
  kind: "text"
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
  if (!(element instanceof HTMLElement)) {
    return display === "inline" ? "atom" : "unsupported"
  }
  if (display === "contents") return "contents"
  if (display === "inline") return "inline"
  return "unsupported"
}

const elementLayout = (element: Element, display: string): Layout => {
  if (display === "none") return "hidden"

  if (element.matches("br, wbr")) return "break"
  if (element.hasAttribute("data-linebreak-atom")) return "atom"

  if (element instanceof HTMLInputElement) {
    return element.disabled ? "atom" : "unsupported"
  }
  if (element instanceof HTMLImageElement) return "atom"
  return displayLayout(element, display)
}

const childDescent = (
  element: Element,
  descent: Descent,
  style: CSSStyleDeclaration,
  noWrapOwner: Element | undefined,
): Descent => ({
  wrappers:
    element instanceof HTMLElement
      ? [...descent.wrappers, element]
      : descent.wrappers,
  noWrapOwner,
  collapses: style.whiteSpaceCollapse === "collapse",
})

export class RawCollector {
  readonly raws: Raw[] = []
  private rejected: ComposeReason | undefined

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
        return this.rejected ?? "unsupported-content"
      }
    }
    return null
  }

  private reject(_node: Element, _detail: string) {
    this.rejected ??= "unsupported-content"
    return false
  }

  private pushAtom(
    element: Element,
    wrappers: HTMLElement[],
    noWrapOwner: Element | undefined,
  ) {
    this.raws.push({
      kind: "atom",
      text: OBJECT_REPLACEMENT,
      wrappers,
      sourceElement: element,
      noWrapOwner,
    })
  }

  private visitText(node: Node, descent: Descent) {
    if (!node.textContent) return true
    if (!descent.collapses) {
      return this.reject(
        node.parentElement ?? this.block,
        "white-space-collapse other than collapse",
      )
    }
    this.raws.push({
      kind: "text",
      text: node.textContent,
      wrappers: descent.wrappers,
      sourceElement: node.parentElement ?? this.block,
      noWrapOwner: descent.noWrapOwner,
    })
    return true
  }

  private emitLeaf(
    element: Element,
    layout: Layout,
    descent: Descent,
    atomOwner: Element | undefined,
  ) {
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
      this.pushAtom(element, descent.wrappers, atomOwner)
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
      if (!this.visit(child, inner)) {
        this.raws.length = before
        return false
      }
    }

    if (!inline || this.raws.length !== before) return true
    if (element.getBoundingClientRect().width > 0) {
      const owner = descent.noWrapOwner ?? inner.noWrapOwner
      this.pushAtom(element, descent.wrappers, owner)
    }
    return true
  }

  private visitElement(element: Element, descent: Descent): boolean {
    if (element.matches(DECORATION)) return true

    const style = this.styleOf(element)
    const layout = elementLayout(element, style.display)
    if (layout === "hidden") return true
    if (layout === "unsupported") {
      return this.reject(element, `display: ${style.display}`)
    }

    const nowrap = style.textWrapMode === "nowrap"
    const noWrapOwner = nowrap ? (descent.noWrapOwner ?? element) : undefined
    if (
      this.emitLeaf(
        element,
        layout,
        descent,
        descent.noWrapOwner ?? noWrapOwner,
      )
    ) {
      return true
    }

    const inner = childDescent(element, descent, style, noWrapOwner)
    return this.descend(element, descent, inner, layout === "inline")
  }

  private visit(node: Node, descent: Descent): boolean {
    if (node.nodeType === Node.TEXT_NODE) return this.visitText(node, descent)
    if (node.nodeType !== Node.ELEMENT_NODE) return true
    return this.visitElement(node as Element, descent)
  }
}
