import type { Line } from "../layout/breaker"
import type { LineFit } from "../layout/expansion"
import { type ExtractedBlock, type InlineRun, LINE_SEPARATOR } from "./extract"

export const LINE_SELECTOR = "[data-linebreak-line]"
export const TYPESET_ATTRIBUTE = "data-linebreak-typeset"
export const TYPESET_SELECTOR = "[data-linebreak-typeset]"

const PROBE_HANG = 16
const PROBE_STYLE =
  "position:absolute;top:-9999px;left:0;width:1000px;visibility:hidden;" +
  "white-space:nowrap;font:16px/1 monospace"

const honoured = new WeakMap<Document, boolean>()

export const honoursHangingMargins = (document: Document) => {
  const cached = honoured.get(document)
  if (cached !== undefined) return cached

  const host = document.body ?? document.documentElement
  if (!host) return false

  const probe = document.createElement("div")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = PROBE_STYLE
  const anchor = document.createElement("span")
  anchor.textContent = "."
  const follower = document.createElement("span")
  follower.textContent = "."
  probe.append(anchor, follower)
  host.appendChild(probe)

  const before = follower.getBoundingClientRect().left
  anchor.style.marginInlineEnd = `${-PROBE_HANG}px`
  const after = follower.getBoundingClientRect().left
  probe.remove()

  const supported = before - after >= PROBE_HANG - 0.5
  honoured.set(document, supported)
  return supported
}

const appendLine = (
  target: HTMLElement,
  block: ExtractedBlock,
  line: Line,
  fromRun: number,
) => {
  const blank = (offset: number) =>
    block.text[offset] === " " || block.text[offset] === LINE_SEPARATOR
  let start = line.sourceStart
  let end = line.sourceEnd
  while (start < end && blank(start)) start += 1
  while (end > start && blank(end - 1)) end -= 1

  let lastBranch: Node | null = null
  let previousWrappers: HTMLElement[] = []
  const openClones: HTMLElement[] = []
  const trailingEdges: Array<{ nodes: HTMLElement[]; target: HTMLElement }> = []
  let nextRun = fromRun

  const beforeLine = (run: InlineRun) =>
    run.kind === "anchor"
      ? run.affinity === "previous"
        ? run.start <= line.sourceStart
        : run.start < line.sourceStart
      : run.end <= line.sourceStart
  const afterLine = (run: InlineRun) =>
    run.kind === "anchor"
      ? run.affinity === "previous"
        ? run.start > line.sourceEnd
        : run.start >= line.sourceEnd
      : run.start >= line.sourceEnd

  while (
    nextRun < block.runs.length &&
    beforeLine(block.runs[nextRun] as InlineRun)
  ) {
    nextRun += 1
  }

  for (let index = nextRun; index < block.runs.length; index += 1) {
    const run = block.runs[index] as InlineRun
    if (afterLine(run)) break
    const sliceStart = Math.max(start, run.start)
    const sliceEnd = Math.min(end, run.end)
    const isAnchor = run.kind === "anchor"
    if (isAnchor || run.end <= line.sourceEnd) nextRun = index + 1
    if (!isAnchor && sliceStart >= sliceEnd) continue

    let shared = 0
    while (
      shared < run.wrappers.length &&
      run.wrappers[shared] === previousWrappers[shared]
    ) {
      shared += 1
    }

    openClones.length = shared
    let branch: Node = openClones.at(-1) ?? target
    for (let depth = shared; depth < run.wrappers.length; depth += 1) {
      const wrapper = run.wrappers[depth] as HTMLElement
      const info = block.wrappers.get(wrapper)
      if (!info) return null
      const startsWrapper = line.sourceStart <= info.start
      const endsWrapper = line.sourceEnd >= info.end

      const clone = wrapper.cloneNode(false) as HTMLElement

      if (!startsWrapper) clone.removeAttribute("id")
      clone.dataset.linebreakFragment = ""
      if (startsWrapper) clone.dataset.linebreakFragmentStart = ""
      if (endsWrapper) clone.dataset.linebreakFragmentEnd = ""
      if (
        startsWrapper &&
        (isAnchor || sliceStart === run.start) &&
        info.firstRun === index
      ) {
        clone.append(...info.leading.nodes.map((node) => node.cloneNode(true)))
      }
      branch.appendChild(clone)
      if (endsWrapper)
        trailingEdges.push({ nodes: info.trailing.nodes, target: clone })
      branch = clone
      openClones.push(clone)
    }

    if (run.kind === "atom") {
      branch.appendChild(run.sourceElement.cloneNode(true))
    } else if (run.kind === "text") {
      branch.appendChild(
        target.ownerDocument.createTextNode(
          run.text.slice(sliceStart - run.start, sliceEnd - run.start),
        ),
      )
    }
    lastBranch = branch
    previousWrappers = run.wrappers
  }

  for (const edge of trailingEdges) {
    edge.target.append(...edge.nodes.map((node) => node.cloneNode(true)))
  }

  return lastBranch ? { lastBranch, nextRun } : null
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
    const original = originals[index]
    if (!original) continue
    for (const attribute of attributes) {
      const value = original.getAttribute(attribute)
      if (value === null) image.removeAttribute(attribute)
      else image.setAttribute(attribute, value)
    }
  }
}

export type RenderedLayout = {
  readonly lines: readonly Line[]
  readonly target: number
  readonly fits: readonly LineFit[] | null
}

export const renderLines = (
  element: HTMLElement,
  block: ExtractedBlock,
  layout: RenderedLayout,
  preservedImageAttributes: readonly string[],
) => {
  const { lines, target: targetWidth, fits } = layout
  const document = element.ownerDocument
  const output = document.createDocumentFragment()
  const lineElements: HTMLElement[] = []
  let nextRun = 0

  const separate = (kind: Line["breakKind"]) => {
    if (kind === "forced") return document.createElement("br")
    if (kind === "space") return document.createTextNode(" ")
    return document.createElement("wbr")
  }

  for (const [index, line] of lines.entries()) {
    const previous = lines[index - 1]
    if (previous) output.appendChild(separate(previous.breakKind))

    const target = document.createElement("span")
    target.dataset.linebreakLine = line.breakKind

    if (line.hangStart > 0) {
      target.style.marginInlineStart = `${-line.hangStart}px`
    }
    if (line.hangEnd > 0) {
      target.style.marginInlineEnd = `${-line.hangEnd}px`
    }

    const fit = fits?.[index]
    if (fit && fit.pct !== 100) target.style.fontStretch = `${fit.pct}%`

    const natural = line.naturalWidth + (fit?.gain ?? 0)
    const shrink = fit ? fit.shrink : line.shrink
    const overflow = Math.min(natural - targetWidth, shrink)
    if (overflow > 0 && line.spaceCount > 0) {
      target.style.wordSpacing = `${-(overflow / line.spaceCount)}px`
    }

    const rendered = appendLine(target, block, line, nextRun)
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

const oversetOf = (written: WrittenLines): Tightening[] => {
  const { lines, target, fits } = written.layout
  const tightenings: Tightening[] = []
  if (!fits) return tightenings

  for (const [index, element] of written.elements.entries()) {
    const line = lines[index]
    const pct = fits[index]?.pct
    if (!line || pct === undefined || pct === 100) continue
    if (line.spaceCount === 0) continue

    const allowed = target + line.hangStart + line.hangEnd
    const overset = element.getBoundingClientRect().width - allowed
    if (overset <= OVERSET_EPSILON) continue

    const spacing = Number.parseFloat(element.style.wordSpacing || "0")
    tightenings.push({
      element,
      spacing: spacing - overset / line.spaceCount,
    })
  }
  return tightenings
}

export const tightenOverset = (written: Iterable<WrittenLines>) => {
  const tightenings: Tightening[] = []
  for (const block of written) tightenings.push(...oversetOf(block))
  for (const tightening of tightenings) {
    tightening.element.style.wordSpacing = `${tightening.spacing}px`
  }
  return tightenings.length
}
