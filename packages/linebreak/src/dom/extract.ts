import type { Diagnostic } from "../diagnostics"
import { policy } from "../policy"
import { cssPixels, type StyleReader } from "./style"

export const OBJECT_REPLACEMENT = "￼"

export const LINE_SEPARATOR = "\n"

export const hasVisibleText = (text: string) => /[^\t\n\f\r ]/u.test(text)

export type SourceRange = { start: number; end: number }

type RunBase = {
  text: string
  start: number
  end: number
  wrappers: HTMLElement[]
}

export type TextRun = RunBase & {
  kind: "text"
  sourceElement: HTMLElement

  hyphenates: boolean
}

export type AtomRun = RunBase & {
  kind: "atom"
  sourceElement: Element
  text: typeof OBJECT_REPLACEMENT
}

export type AnchorRun = RunBase & {
  kind: "anchor"
  sourceElement: HTMLElement
  text: ""

  affinity: "previous" | "next"
}

export type BreakRun = RunBase & {
  kind: "break"
  sourceElement: HTMLElement
  forced: boolean
}

export type InlineRun = TextRun | AtomRun | AnchorRun | BreakRun

type Edge = { nodes: HTMLElement[]; width: number }

export type WrapperInfo = {
  start: number
  end: number
  firstRun: number
  lastRun: number
  leading: Edge
  trailing: Edge
}

export type ExtractedBlock = {
  text: string
  runs: InlineRun[]

  breakRestrictions: SourceRange[]
  wrappers: Map<HTMLElement, WrapperInfo>
}

export type ExtractResult =
  | { ok: true; block: ExtractedBlock }
  | { ok: false; diagnostic: Diagnostic }

type RawBase = { wrappers: HTMLElement[]; noWrapOwner?: Element }
type RawText = RawBase & {
  kind: "text"
  text: string
  sourceElement: HTMLElement
}
type RawAtom = RawBase & {
  kind: "atom"
  text: typeof OBJECT_REPLACEMENT
  sourceElement: Element
}
type RawBreak = RawBase & {
  kind: "break"
  sourceElement: HTMLElement
  forced: boolean
}
type Raw = RawText | RawAtom | RawBreak

type Layout =
  | "hidden"
  | "contents"
  | "inline"
  | "atom"
  | "break"
  | "unsupported"

const DECORATION = "[data-linebreak-decoration][aria-hidden='true']"

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

export const outerWidth = (element: Element, styleOf: StyleReader) => {
  const style = styleOf(element)
  if (style.display === "none") return 0
  return (
    element.getBoundingClientRect().width +
    cssPixels(style.marginInlineStart) +
    cssPixels(style.marginInlineEnd)
  )
}

const inlineEdges = (style: CSSStyleDeclaration) => {
  if (style.display === "contents") return { leading: 0, trailing: 0 }
  return {
    leading:
      cssPixels(style.marginInlineStart) +
      cssPixels(style.borderInlineStartWidth) +
      cssPixels(style.paddingInlineStart),
    trailing:
      cssPixels(style.paddingInlineEnd) +
      cssPixels(style.borderInlineEndWidth) +
      cssPixels(style.marginInlineEnd),
  }
}

const buildWrapperInfo = (runs: InlineRun[], styleOf: StyleReader) => {
  const spans = new Map<HTMLElement, { firstRun: number; lastRun: number }>()
  for (let index = 0; index < runs.length; index += 1) {
    for (const wrapper of (runs[index] as InlineRun).wrappers) {
      const span = spans.get(wrapper)
      if (span) span.lastRun = index
      else spans.set(wrapper, { firstRun: index, lastRun: index })
    }
  }

  const wrappers = new Map<HTMLElement, WrapperInfo>()
  for (const [element, { firstRun, lastRun }] of spans) {
    const edges = inlineEdges(styleOf(element))
    const leading: HTMLElement[] = []
    const trailing: HTMLElement[] = []
    for (const decoration of element.querySelectorAll<HTMLElement>(
      `:scope > ${DECORATION}`,
    )) {
      const width = outerWidth(decoration, styleOf)
      if (decoration.dataset.linebreakDecorationPosition === "after") {
        trailing.push(decoration)
        edges.trailing += width
      } else {
        leading.push(decoration)
        edges.leading += width
      }
    }
    wrappers.set(element, {
      start: (runs[firstRun] as InlineRun).start,
      end: (runs[lastRun] as InlineRun).end,
      firstRun,
      lastRun,
      leading: { nodes: leading, width: edges.leading },
      trailing: { nodes: trailing, width: edges.trailing },
    })
  }
  return wrappers
}

type PendingSpace = {
  first: RawText
  anchors: Map<HTMLElement[], RawText>
  hasWrappingContributor: boolean
}

type ActiveNoWrap = SourceRange & { owner: Element }

class Collapser {
  private text = ""
  private readonly runs: InlineRun[] = []
  private readonly restrictions: SourceRange[] = []
  private readonly contentWrappers: Set<HTMLElement>
  private noWrap: ActiveNoWrap | undefined
  private pending: PendingSpace | undefined

  constructor(raws: readonly Raw[]) {
    this.contentWrappers = new Set()
    for (const raw of raws) {
      if (raw.kind !== "text" || hasVisibleText(raw.text)) {
        for (const wrapper of raw.wrappers) this.contentWrappers.add(wrapper)
      }
    }
  }

  static collapse(raws: readonly Raw[]) {
    const collapser = new Collapser(raws)
    for (const raw of raws) collapser.take(raw)
    collapser.finish()
    return {
      text: collapser.text,
      runs: collapser.runs,
      breakRestrictions: collapser.restrictions,
    }
  }

  private take(raw: Raw) {
    if (raw.kind === "break") return this.takeBreak(raw)
    if (raw.kind === "atom") return this.takeAtom(raw)
    return this.takeText(raw)
  }

  private takeBreak(raw: RawBreak) {
    if (raw.forced && this.pending) {
      for (const from of this.pending.anchors.values()) {
        this.appendAnchor(from, this.text.length, "previous")
      }
      this.pending = undefined
    }
    this.flushSpace()
    this.closeNoWrap()

    const start = this.text.length
    if (raw.forced) this.text += LINE_SEPARATOR
    this.runs.push({
      kind: "break",
      text: raw.forced ? LINE_SEPARATOR : "",
      start,
      end: this.text.length,
      wrappers: raw.wrappers,
      sourceElement: raw.sourceElement,
      forced: raw.forced,
    })
  }

  private takeAtom(raw: RawAtom) {
    this.flushSpace()
    const start = this.text.length
    this.text += raw.text
    this.noteNoWrap(raw.noWrapOwner, start, this.text.length, false)
    this.runs.push({
      kind: "atom",
      text: raw.text,
      start,
      end: this.text.length,
      wrappers: raw.wrappers,
      sourceElement: raw.sourceElement,
    })
  }

  private takeText(raw: RawText) {
    let value = raw.text.replace(/[\t\n\f\r ]+/gu, " ")
    if (value.startsWith(" ")) {
      this.contributeSpace(raw)
      value = value.slice(1)
    }
    if (!value) return

    this.flushSpace()
    if (value.endsWith(" ")) {
      this.appendText(value.slice(0, -1), raw, raw.noWrapOwner)
      this.contributeSpace(raw)
    } else {
      this.appendText(value, raw, raw.noWrapOwner)
    }
  }

  private finish() {
    if (this.pending) {
      for (const from of this.pending.anchors.values()) {
        this.appendAnchor(from, this.text.length, "previous")
      }
    }
    this.closeNoWrap()
  }

  private addRestriction(start: number, end: number) {
    if (start >= end) return
    const previous = this.restrictions.at(-1)
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end)
    } else {
      this.restrictions.push({ start, end })
    }
  }

  private closeNoWrap() {
    if (!this.noWrap) return
    this.addRestriction(this.noWrap.start, this.noWrap.end)
    this.noWrap = undefined
  }

  private noteNoWrap(
    owner: Element | undefined,
    start: number,
    end: number,
    includeBoundary: boolean,
  ) {
    const restrictionEnd = includeBoundary ? end + 1 : end
    if (this.noWrap?.owner !== owner) {
      this.closeNoWrap()
      if (owner) {
        this.noWrap = { owner, start: start + 1, end: restrictionEnd }
      }
      return
    }
    if (this.noWrap) this.noWrap.end = restrictionEnd
  }

  private appendText(
    value: string,
    from: RawText,
    owner: Element | undefined,
    includeBoundary = false,
  ) {
    if (!value) return
    const start = this.text.length
    this.text += value
    this.noteNoWrap(owner, start, this.text.length, includeBoundary)

    const hyphenates = from.noWrapOwner === undefined
    const previous = this.runs.at(-1)
    if (
      previous?.kind === "text" &&
      previous.sourceElement === from.sourceElement &&
      previous.wrappers === from.wrappers &&
      previous.hyphenates === hyphenates
    ) {
      previous.text += value
      previous.end = this.text.length
      return
    }
    this.runs.push({
      kind: "text",
      text: value,
      start,
      end: this.text.length,
      wrappers: from.wrappers,
      sourceElement: from.sourceElement,
      hyphenates,
    })
  }

  private appendAnchor(
    from: RawText,
    offset: number,
    affinity: AnchorRun["affinity"],
  ) {
    this.runs.push({
      kind: "anchor",
      text: "",
      start: offset,
      end: offset,
      wrappers: from.wrappers,
      sourceElement: from.sourceElement,
      affinity,
    })
  }

  private needsAnchor(from: RawText) {
    return from.wrappers.some((wrapper) => !this.contentWrappers.has(wrapper))
  }

  private contributeSpace(from: RawText) {
    const anchor = this.needsAnchor(from)
    if (this.pending) {
      this.pending.hasWrappingContributor ||= from.noWrapOwner === undefined
      if (anchor && !this.pending.anchors.has(from.wrappers)) {
        this.pending.anchors.set(from.wrappers, from)
      }
      return
    }
    this.pending = {
      first: from,
      anchors: new Map(anchor ? [[from.wrappers, from]] : []),
      hasWrappingContributor: from.noWrapOwner === undefined,
    }
  }

  private flushSpace() {
    if (!this.pending) return
    const space = this.pending
    this.pending = undefined

    if (this.text.length === 0 || this.text.endsWith(LINE_SEPARATOR)) {
      for (const from of space.anchors.values()) {
        this.appendAnchor(from, this.text.length, "next")
      }
      return
    }

    const start = this.text.length
    const firstAnchor = space.anchors.get(space.first.wrappers)
    if (firstAnchor) this.appendAnchor(firstAnchor, start, "next")
    this.appendText(
      " ",
      space.first,
      space.hasWrappingContributor ? undefined : space.first.noWrapOwner,
      !space.hasWrappingContributor,
    )
    const end = this.text.length
    if (firstAnchor) this.appendAnchor(firstAnchor, end, "previous")
    for (const from of space.anchors.values()) {
      if (from !== firstAnchor) this.appendAnchor(from, end, "previous")
    }
  }
}

class RawCollector {
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

export const extractBlock = (
  block: HTMLElement,
  styleOf: StyleReader,
): ExtractResult => {
  const collector = new RawCollector(block, styleOf)
  const rejected = collector.collect()
  if (rejected) return { ok: false, diagnostic: rejected }

  const { text, runs, breakRestrictions } = Collapser.collapse(collector.raws)
  if (text.length === 0) {
    return { ok: false, diagnostic: { kind: "empty-content", element: block } }
  }
  if (text.length > policy.limits.maximumCharacters) {
    return {
      ok: false,
      diagnostic: {
        kind: "content-too-long",
        element: block,
        length: text.length,
        maximum: policy.limits.maximumCharacters,
      },
    }
  }

  return {
    ok: true,
    block: {
      text,
      runs,
      breakRestrictions,
      wrappers: buildWrapperInfo(runs, styleOf),
    },
  }
}

export const runEdgeWidths = (block: ExtractedBlock, run: InlineRun) =>
  run.wrappers.reduce(
    (total, wrapper) => {
      const info = block.wrappers.get(wrapper)
      if (!info) return total
      if (block.runs[info.firstRun] === run) total.leading += info.leading.width
      if (block.runs[info.lastRun] === run)
        total.trailing += info.trailing.width
      return total
    },
    { leading: 0, trailing: 0 },
  )

export const codeWrapper = (run: InlineRun) =>
  run.wrappers.find((wrapper) => wrapper.localName === "code")

export const breakAllowedAt = (
  restrictions: readonly SourceRange[],
  offset: number,
) => {
  let low = 0
  let high = restrictions.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if ((restrictions[middle] as SourceRange).start <= offset) low = middle + 1
    else high = middle
  }
  const range = restrictions[low - 1]
  return !range || offset >= range.end
}
