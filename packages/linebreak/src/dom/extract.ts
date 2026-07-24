import { OBJECT_REPLACEMENT, SOFT_HYPHEN } from "../text/markers"
import type { SourceRange } from "../types"
import { cssPixels, type StyleReader } from "./styles"

const maximumParagraphCharacters = 3_000

type InlineItemBase = {
  text: string
  start: number
  end: number
  wrappers: HTMLElement[]
}

type TextItem = InlineItemBase & {
  kind: "text"
  sourceElement: HTMLElement
  allowsHyphenation: boolean
}

type BoxItem = InlineItemBase & {
  kind: "box"
  sourceElement: Element
  text: typeof OBJECT_REPLACEMENT
}

type AnchorItem = InlineItemBase & {
  kind: "anchor"
  sourceElement: HTMLElement
  text: ""
  affinity: "previous" | "next"
}

export type InlineItem = TextItem | BoxItem | AnchorItem

type WrapperEdge = {
  nodes: HTMLElement[]
  width: number
}

export type WrapperInfo = {
  start: number
  end: number
  firstItem: number
  lastItem: number
  leading: WrapperEdge
  trailing: WrapperEdge
}

export type ExtractedBlock = {
  text: string
  items: InlineItem[]
  breakRestrictions: SourceRange[]
  wrappers: Map<HTMLElement, WrapperInfo>
}

type RawItemBase = {
  wrappers: HTMLElement[]
  noWrapOwner?: Element
}

type RawTextItem = RawItemBase & {
  kind: "text"
  text: string
  sourceElement: HTMLElement
}

type RawBoxItem = RawItemBase & {
  kind: "box"
  text: typeof OBJECT_REPLACEMENT
  sourceElement: Element
}

type RawItem = RawTextItem | RawBoxItem

const isCode = (element: HTMLElement) => element.localName === "code"

type ElementLayout = "hidden" | "contents" | "inline" | "atom" | "unsupported"

const elementLayout = (element: Element, display: string): ElementLayout => {
  if (display === "none") return "hidden"
  if (element.matches("br, wbr")) return "unsupported"
  if (element.hasAttribute("data-linebreak-atom")) return "atom"
  if (element instanceof HTMLInputElement) return "unsupported"
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

const hasInlineAdvance = (element: Element) =>
  element.getBoundingClientRect().width > 0

const elementWidth = (element: HTMLElement, styleOf: StyleReader) => {
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

const makeWrapperInfo = (items: InlineItem[], styleOf: StyleReader) => {
  const ranges = new Map<HTMLElement, { firstItem: number; lastItem: number }>()
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    for (const wrapper of items[itemIndex].wrappers) {
      const range = ranges.get(wrapper)
      if (range) range.lastItem = itemIndex
      else ranges.set(wrapper, { firstItem: itemIndex, lastItem: itemIndex })
    }
  }

  const wrappers = new Map<HTMLElement, WrapperInfo>()
  for (const [element, { firstItem, lastItem }] of ranges) {
    const edges = inlineEdges(styleOf(element))
    const leadingNodes: HTMLElement[] = []
    const trailingNodes: HTMLElement[] = []
    for (const decoration of element.querySelectorAll<HTMLElement>(
      ":scope > [data-linebreak-decoration][aria-hidden='true']",
    )) {
      const width = elementWidth(decoration, styleOf)
      if (decoration.dataset.linebreakDecorationPosition === "after") {
        trailingNodes.push(decoration)
        edges.trailing += width
      } else {
        leadingNodes.push(decoration)
        edges.leading += width
      }
    }
    wrappers.set(element, {
      start: items[firstItem].start,
      end: items[lastItem].end,
      firstItem,
      lastItem,
      leading: {
        nodes: leadingNodes,
        width: edges.leading,
      },
      trailing: {
        nodes: trailingNodes,
        width: edges.trailing,
      },
    })
  }
  return wrappers
}

type PendingSpace = {
  firstSource: RawTextItem
  anchors: Map<HTMLElement[], RawTextItem>
  hasWrappingContributor: boolean
}

type ActiveNoWrapRange = SourceRange & { owner: Element }

const normalizeRawItems = (rawItems: RawItem[]) => {
  const items: InlineItem[] = []
  const breakRestrictions: SourceRange[] = []
  const contentWrappers = new Set<HTMLElement>()
  for (const raw of rawItems) {
    if (raw.kind === "box" || /[^\t\n\f\r ]/u.test(raw.text)) {
      for (const wrapper of raw.wrappers) contentWrappers.add(wrapper)
    }
  }
  let activeNoWrapRange: ActiveNoWrapRange | undefined
  let pendingSpace: PendingSpace | undefined
  let text = ""

  const addRestriction = (start: number, end: number) => {
    if (start >= end) return
    const previous = breakRestrictions.at(-1)
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end)
    } else {
      breakRestrictions.push({ start, end })
    }
  }

  const finishNoWrapRange = () => {
    if (!activeNoWrapRange) return
    addRestriction(activeNoWrapRange.start, activeNoWrapRange.end)
    activeNoWrapRange = undefined
  }

  const recordNoWrapRange = (
    owner: Element | undefined,
    start: number,
    end: number,
    includeEndBoundary: boolean,
  ) => {
    const restrictionEnd = includeEndBoundary ? end + 1 : end
    if (activeNoWrapRange?.owner !== owner) {
      finishNoWrapRange()
      if (owner) {
        activeNoWrapRange = { owner, start: start + 1, end: restrictionEnd }
      }
      return
    }
    if (activeNoWrapRange) activeNoWrapRange.end = restrictionEnd
  }

  const appendText = (
    value: string,
    source: RawTextItem,
    owner: Element | undefined,
    includeEndBoundary = false,
  ) => {
    if (!value) return
    const start = text.length
    text += value
    recordNoWrapRange(owner, start, text.length, includeEndBoundary)

    const allowsHyphenation = source.noWrapOwner === undefined
    const previous = items.at(-1)
    if (
      previous?.kind === "text" &&
      previous.sourceElement === source.sourceElement &&
      previous.wrappers === source.wrappers &&
      previous.allowsHyphenation === allowsHyphenation
    ) {
      previous.text += value
      previous.end = text.length
    } else {
      items.push({
        kind: "text",
        text: value,
        start,
        end: text.length,
        wrappers: source.wrappers,
        sourceElement: source.sourceElement,
        allowsHyphenation,
      })
    }
  }

  const appendAnchor = (
    source: RawTextItem,
    offset: number,
    affinity: AnchorItem["affinity"],
  ) => {
    items.push({
      kind: "anchor",
      text: "",
      start: offset,
      end: offset,
      wrappers: source.wrappers,
      sourceElement: source.sourceElement,
      affinity,
    })
  }

  const needsAnchor = (source: RawTextItem) =>
    source.wrappers.some((wrapper) => !contentWrappers.has(wrapper))

  const contributeSpace = (source: RawTextItem) => {
    const anchor = needsAnchor(source)
    if (pendingSpace) {
      pendingSpace.hasWrappingContributor ||= source.noWrapOwner === undefined
      if (anchor && !pendingSpace.anchors.has(source.wrappers)) {
        pendingSpace.anchors.set(source.wrappers, source)
      }
    } else {
      pendingSpace = {
        firstSource: source,
        anchors: new Map(anchor ? [[source.wrappers, source]] : []),
        hasWrappingContributor: source.noWrapOwner === undefined,
      }
    }
  }

  const flushSpace = () => {
    if (!pendingSpace) return
    const space = pendingSpace
    pendingSpace = undefined
    if (text.length === 0) {
      for (const source of space.anchors.values()) {
        appendAnchor(source, 0, "next")
      }
      return
    }

    const start = text.length
    const firstAnchor = space.anchors.get(space.firstSource.wrappers)
    if (firstAnchor) appendAnchor(firstAnchor, start, "next")
    appendText(
      " ",
      space.firstSource,
      space.hasWrappingContributor ? undefined : space.firstSource.noWrapOwner,
      !space.hasWrappingContributor,
    )
    const end = text.length
    if (firstAnchor) appendAnchor(firstAnchor, end, "previous")
    for (const source of space.anchors.values()) {
      if (source === firstAnchor) continue
      appendAnchor(source, end, "previous")
    }
  }

  for (const raw of rawItems) {
    if (raw.kind === "box") {
      flushSpace()
      const start = text.length
      text += raw.text
      recordNoWrapRange(raw.noWrapOwner, start, text.length, false)
      items.push({
        kind: raw.kind,
        text: raw.text,
        start,
        end: text.length,
        wrappers: raw.wrappers,
        sourceElement: raw.sourceElement,
      })
      continue
    }

    let value = raw.text.replace(/[\t\n\f\r ]+/gu, " ")
    if (value.startsWith(" ")) {
      contributeSpace(raw)
      value = value.slice(1)
    }
    if (!value) continue

    flushSpace()
    if (value.endsWith(" ")) {
      appendText(value.slice(0, -1), raw, raw.noWrapOwner)
      contributeSpace(raw)
    } else {
      appendText(value, raw, raw.noWrapOwner)
    }
  }

  if (pendingSpace) {
    for (const source of pendingSpace.anchors.values()) {
      appendAnchor(source, text.length, "previous")
    }
  }
  finishNoWrapRange()
  return { text, items, breakRestrictions }
}

export const extractBlock = (
  block: HTMLElement,
  styleOf: StyleReader = getComputedStyle,
): ExtractedBlock | null => {
  const rawItems: RawItem[] = []

  const visit = (
    node: Node,
    wrappers: HTMLElement[],
    noWrapOwner: Element | undefined,
    collapsesWhitespace: boolean,
  ): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent) return true
      if (!collapsesWhitespace) return false
      rawItems.push({
        kind: "text",
        text: node.textContent,
        wrappers,
        sourceElement: node.parentElement ?? block,
        noWrapOwner,
      })
      return true
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return true
    const element = node as Element
    if (element.matches("[data-linebreak-decoration][aria-hidden='true']")) {
      return true
    }

    const style = styleOf(element)
    const layout = elementLayout(element, style.display)
    if (layout === "hidden") return true
    if (layout === "unsupported") return false
    const nextNoWrapOwner =
      style.textWrapMode === "nowrap" ? (noWrapOwner ?? element) : undefined
    if (layout === "atom") {
      rawItems.push({
        kind: "box",
        text: OBJECT_REPLACEMENT,
        wrappers,
        sourceElement: element,
        noWrapOwner: noWrapOwner ?? nextNoWrapOwner,
      })
      return true
    }

    const itemCount = rawItems.length
    const nextWrappers =
      element instanceof HTMLElement ? [...wrappers, element] : wrappers
    for (const child of element.childNodes) {
      if (
        !visit(
          child,
          nextWrappers,
          nextNoWrapOwner,
          style.whiteSpaceCollapse === "collapse",
        )
      ) {
        rawItems.length = itemCount
        return false
      }
    }
    if (
      layout === "inline" &&
      rawItems.length === itemCount &&
      hasInlineAdvance(element)
    ) {
      rawItems.push({
        kind: "box",
        text: OBJECT_REPLACEMENT,
        wrappers,
        sourceElement: element,
        noWrapOwner: noWrapOwner ?? nextNoWrapOwner,
      })
    }
    return true
  }

  const blockStyle = styleOf(block)
  const blockNoWrapOwner =
    blockStyle.textWrapMode === "nowrap" ? block : undefined
  const rootWrappers: HTMLElement[] = []
  if (
    ![...block.childNodes].every((child) =>
      visit(
        child,
        rootWrappers,
        blockNoWrapOwner,
        blockStyle.whiteSpaceCollapse === "collapse",
      ),
    )
  ) {
    return null
  }

  const { text, items, breakRestrictions } = normalizeRawItems(rawItems)

  if (
    text.length === 0 ||
    text.length > maximumParagraphCharacters ||
    text.includes(SOFT_HYPHEN)
  ) {
    return null
  }

  return {
    text,
    items,
    breakRestrictions,
    wrappers: makeWrapperInfo(items, styleOf),
  }
}

export const itemEdgeWidths = (extracted: ExtractedBlock, item: InlineItem) =>
  item.wrappers.reduce(
    (total, wrapper) => {
      const info = extracted.wrappers.get(wrapper)
      if (!info) return total
      if (extracted.items[info.firstItem] === item) {
        total.leading += info.leading.width
      }
      if (extracted.items[info.lastItem] === item) {
        total.trailing += info.trailing.width
      }
      return total
    },
    { leading: 0, trailing: 0 },
  )

export const codeWrapper = (item: InlineItem) => item.wrappers.find(isCode)
