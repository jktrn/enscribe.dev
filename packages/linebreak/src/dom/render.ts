import type { Line } from "../layout/breaker"
import type { LineFit } from "../layout/expansion"
import {
  type ExtractedBlock,
  type InlineRun,
  LINE_SEPARATOR,
  type WrapperInfo,
} from "./extract"

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

type TrailingEdge = {
  readonly nodes: readonly HTMLElement[]
  readonly target: HTMLElement
}

type LineBuild = {
  readonly target: HTMLElement
  readonly block: ExtractedBlock
  readonly line: Line
  readonly sliceStart: number
  readonly sliceEnd: number
  readonly openClones: HTMLElement[]
  readonly trailingEdges: TrailingEdge[]
}

type RunPlacement = {
  readonly run: InlineRun
  readonly index: number
  readonly shared: number
  readonly start: number
  readonly end: number
  readonly leads: boolean
  readonly consumed: boolean
  readonly empty: boolean
}

const trimmedSlice = (block: ExtractedBlock, line: Line) => {
  const blank = (offset: number) =>
    block.text[offset] === " " || block.text[offset] === LINE_SEPARATOR
  let start = line.sourceStart
  let end = line.sourceEnd
  while (start < end && blank(start)) start += 1
  while (end > start && blank(end - 1)) end -= 1
  return { sliceStart: start, sliceEnd: end }
}

const beforeLine = (run: InlineRun, line: Line) => {
  if (run.kind !== "anchor") return run.end <= line.sourceStart
  if (run.affinity === "previous") return run.start <= line.sourceStart
  return run.start < line.sourceStart
}

const afterLine = (run: InlineRun, line: Line) => {
  if (run.kind !== "anchor") return run.start >= line.sourceEnd
  if (run.affinity === "previous") return run.start > line.sourceEnd
  return run.start >= line.sourceEnd
}

const runWindow = (block: ExtractedBlock, line: Line, fromRun: number) => {
  let first = fromRun
  while (
    first < block.runs.length &&
    beforeLine(block.runs[first] as InlineRun, line)
  ) {
    first += 1
  }
  let last = first
  while (
    last < block.runs.length &&
    !afterLine(block.runs[last] as InlineRun, line)
  ) {
    last += 1
  }
  return { first, last }
}

const placementOf = (
  build: LineBuild,
  run: InlineRun,
  index: number,
  previousWrappers: readonly HTMLElement[],
): RunPlacement => {
  const start = Math.max(build.sliceStart, run.start)
  const end = Math.min(build.sliceEnd, run.end)
  const isAnchor = run.kind === "anchor"
  let shared = 0
  while (
    shared < run.wrappers.length &&
    run.wrappers[shared] === previousWrappers[shared]
  ) {
    shared += 1
  }
  return {
    run,
    index,
    shared,
    start,
    end,
    leads: isAnchor || start === run.start,
    consumed: isAnchor || run.end <= build.line.sourceEnd,
    empty: !isAnchor && start >= end,
  }
}

const cloneWrapper = (
  wrapper: HTMLElement,
  startsWrapper: boolean,
  endsWrapper: boolean,
) => {
  const clone = wrapper.cloneNode(false) as HTMLElement
  if (!startsWrapper) clone.removeAttribute("id")
  clone.dataset.linebreakFragment = ""
  if (startsWrapper) clone.dataset.linebreakFragmentStart = ""
  if (endsWrapper) clone.dataset.linebreakFragmentEnd = ""
  return clone
}

const carriesLeading = (
  info: WrapperInfo,
  placement: RunPlacement,
  startsWrapper: boolean,
) => startsWrapper && placement.leads && info.firstRun === placement.index

const attachWrapper = (
  build: LineBuild,
  placement: RunPlacement,
  wrapper: HTMLElement,
  branch: HTMLElement,
) => {
  const info = build.block.wrappers.get(wrapper)
  if (!info) return null

  const startsWrapper = build.line.sourceStart <= info.start
  const endsWrapper = build.line.sourceEnd >= info.end
  const clone = cloneWrapper(wrapper, startsWrapper, endsWrapper)

  if (carriesLeading(info, placement, startsWrapper)) {
    clone.append(...info.leading.nodes.map((node) => node.cloneNode(true)))
  }
  branch.appendChild(clone)
  if (endsWrapper) {
    build.trailingEdges.push({ nodes: info.trailing.nodes, target: clone })
  }
  return clone
}

const openWrappers = (build: LineBuild, placement: RunPlacement) => {
  const { wrappers } = placement.run
  let branch = build.openClones.at(-1) ?? build.target
  for (let depth = placement.shared; depth < wrappers.length; depth += 1) {
    const clone = attachWrapper(
      build,
      placement,
      wrappers[depth] as HTMLElement,
      branch,
    )
    if (!clone) return null
    branch = clone
    build.openClones.push(clone)
  }
  return branch
}

const appendContent = (
  build: LineBuild,
  branch: HTMLElement,
  placement: RunPlacement,
) => {
  const { run } = placement
  if (run.kind === "atom") {
    branch.appendChild(run.sourceElement.cloneNode(true))
    return
  }
  if (run.kind !== "text") return
  branch.appendChild(
    build.target.ownerDocument.createTextNode(
      run.text.slice(placement.start - run.start, placement.end - run.start),
    ),
  )
}

const appendRuns = (build: LineBuild, from: number) => {
  const { first, last } = runWindow(build.block, build.line, from)
  let lastBranch: HTMLElement | null = null
  let previousWrappers: readonly HTMLElement[] = []
  let nextRun = first

  for (let index = first; index < last; index += 1) {
    const run = build.block.runs[index] as InlineRun
    const placement = placementOf(build, run, index, previousWrappers)
    if (placement.consumed) nextRun = index + 1
    if (placement.empty) continue

    build.openClones.length = placement.shared
    const branch = openWrappers(build, placement)
    if (!branch) return null

    appendContent(build, branch, placement)
    lastBranch = branch
    previousWrappers = run.wrappers
  }

  return { lastBranch, nextRun }
}

const appendLine = (
  target: HTMLElement,
  block: ExtractedBlock,
  line: Line,
  fromRun: number,
) => {
  const build: LineBuild = {
    target,
    block,
    line,
    ...trimmedSlice(block, line),
    openClones: [],
    trailingEdges: [],
  }

  const appended = appendRuns(build, fromRun)
  if (!appended) return null

  for (const edge of build.trailingEdges) {
    edge.target.append(...edge.nodes.map((node) => node.cloneNode(true)))
  }

  const { lastBranch, nextRun } = appended
  return lastBranch ? { lastBranch, nextRun } : null
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
    const original = originals[index]
    if (!original) continue
    copyAttributes(original, image, attributes)
  }
}

export type RenderedLayout = {
  readonly lines: readonly Line[]
  readonly target: number
  readonly fits: readonly LineFit[] | null
}

const applyHangs = (element: HTMLElement, line: Line) => {
  if (line.hangStart > 0) {
    element.style.marginInlineStart = `${-line.hangStart}px`
  }
  if (line.hangEnd > 0) {
    element.style.marginInlineEnd = `${-line.hangEnd}px`
  }
}

const applyFit = (
  element: HTMLElement,
  line: Line,
  fit: LineFit | undefined,
  targetWidth: number,
) => {
  if (fit && fit.pct !== 100) element.style.fontStretch = `${fit.pct}%`

  const natural = line.naturalWidth + (fit?.gain ?? 0)
  const shrink = fit ? fit.shrink : line.shrink
  const overflow = Math.min(natural - targetWidth, shrink)
  if (overflow > 0 && line.spaceCount > 0) {
    element.style.wordSpacing = `${-(overflow / line.spaceCount)}px`
  }
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
    applyHangs(target, line)
    applyFit(target, line, fits?.[index], targetWidth)

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

const expandedLine = (
  lines: readonly Line[],
  fits: readonly LineFit[],
  index: number,
) => {
  const line = lines[index]
  const pct = fits[index]?.pct
  if (!line || pct === undefined || pct === 100) return null
  return line.spaceCount === 0 ? null : line
}

const tighteningFor = (
  element: HTMLElement,
  line: Line,
  target: number,
): Tightening | null => {
  const allowed = target + line.hangStart + line.hangEnd
  const overset = element.getBoundingClientRect().width - allowed
  if (overset <= OVERSET_EPSILON) return null

  const spacing = Number.parseFloat(element.style.wordSpacing || "0")
  return { element, spacing: spacing - overset / line.spaceCount }
}

const oversetOf = (written: WrittenLines): Tightening[] => {
  const { lines, target, fits } = written.layout
  const tightenings: Tightening[] = []
  if (!fits) return tightenings

  for (const [index, element] of written.elements.entries()) {
    const line = expandedLine(lines, fits, index)
    if (!line) continue

    const tightening = tighteningFor(element, line, target)
    if (tightening) tightenings.push(tightening)
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
