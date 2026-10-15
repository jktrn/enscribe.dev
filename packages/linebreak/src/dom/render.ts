import {
  appendLine,
  inheritFittedSpacing,
  trimmedSlice,
} from "./render-content"
import { ATTRIBUTES } from "../attributes"
import type { Line } from "../layout/breaker"
import type { LineFit } from "../layout/expansion"
import type { LineTrack } from "../layout/tracking"
import { type ExtractedBlock } from "./extract"
import { offscreen } from "./probe"
import { graphemes } from "../text/graphemes"

export const LINE_SELECTOR = `[${ATTRIBUTES.line}]`
export const TYPESET_ATTRIBUTE = ATTRIBUTES.typeset
export const TYPESET_SELECTOR = `[${TYPESET_ATTRIBUTE}]`

const PROBE_HANG = 16
const PROBE_BLOCK =
  "width:200px;text-align:justify;text-align-last:start;font:16px/1 monospace"
const PROBE_LINE = "display:inline;white-space:nowrap"
const PROBE_SET = "aaa bbb ccc ddd"
const PROBE_OVERFLOW = "eeeeeeeeeeeeeeeeeeeeeeee"

const honoured = new WeakMap<Document, boolean>()

const hangReach = (host: HTMLDivElement) => {
  const document = host.ownerDocument
  const block = document.createElement("div")
  block.style.cssText = PROBE_BLOCK

  const line = document.createElement("span")
  line.style.cssText = PROBE_LINE
  line.textContent = PROBE_SET

  const overflow = document.createElement("span")
  overflow.style.cssText = PROBE_LINE
  overflow.textContent = PROBE_OVERFLOW

  block.append(line, document.createTextNode(" "), overflow)
  host.append(block)

  line.style.marginInlineEnd = `${-PROBE_HANG}px`
  return (
    line.getBoundingClientRect().right - block.getBoundingClientRect().right
  )
}

export const honoursHangingMargins = (document: Document) => {
  const cached = honoured.get(document)
  if (cached !== undefined) return cached

  const reach = offscreen(document, hangReach)
  if (reach === null) return false

  const supported = reach >= PROBE_HANG - 0.5
  honoured.set(document, supported)
  return supported
}

const copyAttributes = (
  original: HTMLImageElement,
  image: HTMLImageElement,
  attributes: readonly string[],
) => {
  for (const attribute of attributes) {
    const value = original.getAttribute(attribute)
    if (value === null) image.removeAttribute(attribute)
    else image.setAttribute(attribute, value)
  }
}

export const preserveImageAttributes = (
  block: HTMLElement,
  replacement: ParentNode,
  attributes: readonly string[],
) => {
  if (attributes.length === 0) return
  const originals = block.querySelectorAll<HTMLImageElement>("img")
  const replacements = replacement.querySelectorAll<HTMLImageElement>("img")
  if (originals.length !== replacements.length) return

  for (const [index, image] of replacements.entries()) {
    const original = originals[index] as HTMLImageElement
    copyAttributes(original, image, attributes)
  }
}

type Letterfit = {
  readonly lines: readonly LineTrack[]
  readonly inherited: number
}

export type RenderedLayout = {
  readonly lines: readonly Line[]
  readonly target: number
  readonly breakRuns?: ReadonlyMap<number, number>
  readonly fits: readonly LineFit[] | null
  readonly letterfit: Letterfit | null
}

const PRINTABLE_ASCII = /^[\u0020-\u007e]*$/u
const VISIBLE_GRAPHEME = /[^\p{Cf}]/u

const textUnits = (text: string) => {
  if (PRINTABLE_ASCII.test(text)) return text.length
  let units = 0
  for (const { segment } of graphemes(text)) {
    if (VISIBLE_GRAPHEME.test(segment)) units += 1
  }
  return units
}

const renderedUnits = (block: ExtractedBlock, line: Line, fromRun: number) => {
  const { sliceStart, sliceEnd } = trimmedSlice(block, line)
  let units = textUnits(block.text.slice(sliceStart, sliceEnd))
  if (line.breakKind === "hyphen") units += 1
  // Atomic boxes do not respond to inherited letter-spacing in native engines.
  for (let index = fromRun; index < block.runs.length; index += 1) {
    const run = block.runs[index]!
    if (run.start >= sliceEnd) break
    if (run.kind === "atom" && run.start >= sliceStart) units -= 1
  }
  return units
}

type LinePlan = {
  readonly fit: LineFit | undefined
  readonly track: LineTrack | undefined
  readonly units: number
  readonly inherited: number
  readonly excess: number
  readonly shrink: number
}

const elasticOf = (layout: RenderedLayout, index: number) => {
  const line = layout.lines[index] as Line
  const fit = layout.fits?.[index]
  const track = layout.letterfit?.lines[index]
  const natural = line.naturalWidth + (fit?.gain ?? 0) + (track?.gain ?? 0)
  return {
    excess: natural - layout.target,
    shrink: track?.shrink ?? fit?.shrink ?? line.shrink,
  }
}

const overrunOf = (excess: number, shrink: number) =>
  Math.max(0, excess - shrink)

export const layoutSlack = (layout: RenderedLayout) => {
  let most = 0
  for (let index = 0; index < layout.lines.length; index += 1) {
    const line = layout.lines[index] as Line
    const { excess, shrink } = elasticOf(layout, index)
    const reach = line.hangEnd + overrunOf(excess, shrink)
    most = Math.max(most, reach)
  }
  return most
}

const applyHangs = (element: HTMLElement, line: Line, plan: LinePlan) => {
  if (line.hangStart > 0) {
    element.style.marginInlineStart = `${-line.hangStart}px`
  }
  const end = line.hangEnd + overrunOf(plan.excess, plan.shrink)
  if (end > 0) element.style.marginInlineEnd = `${-end}px`
}

const letterfitOf = (line: Line, plan: LinePlan) => {
  const gain = plan.track?.gain ?? 0
  const letters = plan.units - line.spaceCount
  return letters <= 0 ? 0 : gain / letters
}

const rescueOf = (line: Line, plan: LinePlan) => {
  const overflow = Math.min(plan.excess, plan.shrink)
  return line.spaceCount > 0 ? Math.max(0, overflow) / line.spaceCount : 0
}

const applyFit = (element: HTMLElement, line: Line, plan: LinePlan) => {
  const { fit } = plan
  if (fit && fit.pct !== 100) element.style.fontStretch = `${fit.pct}%`

  const perLetter = letterfitOf(line, plan)
  if (perLetter !== 0) {
    element.style.letterSpacing = `${plan.inherited + perLetter}px`
    element.toggleAttribute(ATTRIBUTES.letterFit, true)
  }

  const spacing = -perLetter - rescueOf(line, plan)
  if (spacing !== 0) {
    element.style.wordSpacing = `${spacing}px`
    element.toggleAttribute(ATTRIBUTES.wordFit, true)
  }
}

const planFor = (
  block: ExtractedBlock,
  layout: RenderedLayout,
  index: number,
  fromRun: number,
): LinePlan => {
  const { letterfit } = layout
  const line = layout.lines[index] as Line
  return {
    fit: layout.fits?.[index],
    track: letterfit?.lines[index],
    units: letterfit ? renderedUnits(block, line, fromRun) : 0,
    inherited: letterfit?.inherited ?? 0,
    ...elasticOf(layout, index),
  }
}

export const renderLines = (
  element: HTMLElement,
  block: ExtractedBlock,
  layout: RenderedLayout,
  preservedImageAttributes: readonly string[],
) => {
  const { lines } = layout
  const document = element.ownerDocument
  const output = document.createDocumentFragment()
  const lineElements: HTMLElement[] = []
  let nextRun = 0

  const separate = (line: Line) => {
    if (line.breakKind === "space" || block.text[line.sourceEnd - 1] === " ") {
      return document.createTextNode(" ")
    }
    return document.createElement("wbr")
  }

  for (const [index, line] of lines.entries()) {
    const previous = lines[index - 1]
    if (previous && previous.breakKind !== "forced") {
      output.appendChild(separate(previous))
    }

    const target = document.createElement("span")
    target.setAttribute(ATTRIBUTES.line, line.breakKind)
    const plan = planFor(block, layout, index, nextRun)
    applyHangs(target, line, plan)
    applyFit(target, line, plan)

    const rendered = appendLine(
      target, block, line, nextRun, layout.breakRuns?.get(line.end),
    )
    if (!rendered) return null
    nextRun = rendered.nextRun

    output.appendChild(target)
    lineElements.push(target)
  }

  preserveImageAttributes(element, output, preservedImageAttributes)
  element.replaceChildren(output)
  element.setAttribute(TYPESET_ATTRIBUTE, String(lines.length))
  return lineElements
}

export type WrittenLines = {
  readonly elements: readonly HTMLElement[]
  readonly layout: RenderedLayout
}

type Tightening = {
  readonly element: HTMLElement
  readonly spacing: number
}

const OVERSET_EPSILON = 0.05

const adjustedLine = (layout: RenderedLayout, index: number) => {
  const line = layout.lines[index]
  if (!line || line.spaceCount === 0) return null
  const pct = layout.fits?.[index]?.pct ?? 100
  const gain = layout.letterfit?.lines[index]?.gain ?? 0
  return pct !== 100 || gain !== 0 ? line : null
}

const tighteningFor = (
  element: HTMLElement,
  line: Line,
  allowed: number,
): Tightening | null => {
  const overset = element.getBoundingClientRect().width - allowed
  if (overset <= OVERSET_EPSILON) return null

  const spacing = Number.parseFloat(element.style.wordSpacing || "0")
  return { element, spacing: spacing - overset / line.spaceCount }
}

const oversetOf = (written: WrittenLines): Tightening[] => {
  const { layout } = written
  const tightenings: Tightening[] = []
  if (!layout.fits && !layout.letterfit) return tightenings

  for (const [index, element] of written.elements.entries()) {
    const line = adjustedLine(layout, index)
    if (!line) continue

    const { excess, shrink } = elasticOf(layout, index)
    const allowed =
      layout.target + line.hangStart + line.hangEnd + overrunOf(excess, shrink)
    const tightening = tighteningFor(element, line, allowed)
    if (tightening) tightenings.push(tightening)
  }
  return tightenings
}

export const tightenOverset = (written: Iterable<WrittenLines>) => {
  const tightenings: Tightening[] = []
  for (const block of written) tightenings.push(...oversetOf(block))
  for (const tightening of tightenings) {
    tightening.element.style.wordSpacing = `${tightening.spacing}px`
    tightening.element.toggleAttribute(ATTRIBUTES.wordFit, true)
    for (const fragment of tightening.element.querySelectorAll<HTMLElement>(
      `[${ATTRIBUTES.fragment}]`,
    )) {
      inheritFittedSpacing(tightening.element, fragment)
    }
  }
  return tightenings.length
}
