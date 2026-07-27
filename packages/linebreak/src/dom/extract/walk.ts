import type { Diagnostic } from "../../diagnostics"
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

const elementLayout = (element: Element, display: string): Layout => {
  if (display === "none") return "hidden"

  if (element.matches("br, wbr")) return "break"
  if (element.hasAttribute("data-linebreak-atom")) return "atom"

  if (element instanceof HTMLInputElement) {
    return element.disabled ? "atom" : "unsupported"
  }
  if (element instanceof HTMLImageElement) return "atom"
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

export class RawCollector {
  readonly raws: Raw[] = []
  private rejected: Diagnostic | undefined

  constructor(
    private readonly block: HTMLElement,
    private readonly styleOf: StyleReader,
  ) {}

  collect(): Diagnostic | null {
    const style = this.styleOf(this.block)
    const noWrapOwner = style.textWrapMode === "nowrap" ? this.block : undefined
    const collapses = style.whiteSpaceCollapse === "collapse"

    for (const child of this.block.childNodes) {
      if (!this.visit(child, [], noWrapOwner, collapses)) {
        return (
          this.rejected ?? {
            kind: "unsupported-element",
            element: this.block,
            node: this.block,
            detail: "unsupported inline content",
          }
        )
      }
    }
    return null
  }

  private reject(node: Element, detail: string) {
    this.rejected ??= {
      kind: "unsupported-element",
      element: this.block,
      node,
      detail,
    }
    return false
  }

  private visitText(
    node: Node,
    wrappers: HTMLElement[],
    noWrapOwner: Element | undefined,
    collapses: boolean,
  ) {
    if (!node.textContent) return true
    if (!collapses) {
      return this.reject(
        node.parentElement ?? this.block,
        "white-space-collapse other than collapse",
      )
    }
    this.raws.push({
      kind: "text",
      text: node.textContent,
      wrappers,
      sourceElement: node.parentElement ?? this.block,
      noWrapOwner,
    })
    return true
  }

  private visit(
    node: Node,
    wrappers: HTMLElement[],
    noWrapOwner: Element | undefined,
    collapses: boolean,
  ): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      return this.visitText(node, wrappers, noWrapOwner, collapses)
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return true

    const element = node as Element
    if (element.matches(DECORATION)) return true

    const style = this.styleOf(element)
    const layout = elementLayout(element, style.display)
    if (layout === "hidden") return true
    if (layout === "unsupported") {
      return this.reject(element, `display: ${style.display}`)
    }

    const nextNoWrap =
      style.textWrapMode === "nowrap" ? (noWrapOwner ?? element) : undefined

    if (layout === "break") {
      this.raws.push({
        kind: "break",
        wrappers,
        sourceElement: element as HTMLElement,
        forced: element.matches("br"),
      })
      return true
    }
    if (layout === "atom") {
      this.raws.push({
        kind: "atom",
        text: OBJECT_REPLACEMENT,
        wrappers,
        sourceElement: element,
        noWrapOwner: noWrapOwner ?? nextNoWrap,
      })
      return true
    }

    const before = this.raws.length
    const nextWrappers =
      element instanceof HTMLElement ? [...wrappers, element] : wrappers
    for (const child of element.childNodes) {
      const ok = this.visit(
        child,
        nextWrappers,
        nextNoWrap,
        style.whiteSpaceCollapse === "collapse",
      )
      if (!ok) {
        this.raws.length = before
        return false
      }
    }

    if (
      layout === "inline" &&
      this.raws.length === before &&
      element.getBoundingClientRect().width > 0
    ) {
      this.raws.push({
        kind: "atom",
        text: OBJECT_REPLACEMENT,
        wrappers,
        sourceElement: element,
        noWrapOwner: noWrapOwner ?? nextNoWrap,
      })
    }
    return true
  }
}
