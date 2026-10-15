import type { Line } from "../layout/breaker"
import { ATTRIBUTES } from "../attributes"
import { type ExtractedBlock, type InlineRun, LINE_SEPARATOR } from "./extract"

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
  readonly renderEnd: number
  readonly fromRun: number
  readonly throughRun: number
  readonly openClones: HTMLElement[]
  readonly trailingEdges: TrailingEdge[]
}

type RunPlacement = {
  readonly run: InlineRun
  readonly shared: number
  readonly start: number
  readonly end: number
  readonly consumed: boolean
  readonly empty: boolean
}

export const trimmedSlice = (block: ExtractedBlock, line: Line) => {
  const blank = (offset: number) =>
    block.text[offset] === " " || block.text[offset] === LINE_SEPARATOR
  let start = line.sourceStart
  let end = line.sourceEnd
  while (start < end && blank(start)) start += 1
  while (end > start && blank(end - 1)) end -= 1
  return { sliceStart: start, sliceEnd: end }
}

const beforeLine = (run: InlineRun, start: number, includeAnchors: boolean) => {
  if (run.kind === "break" && !run.forced) return run.start < start
  if (run.kind !== "anchor") return run.end <= start
  // Its preceding content was already consumed or skipped by this scan,
  // so an initial trailing anchor cannot lie beyond the source start.
  if (run.affinity === "previous" && !includeAnchors) return true
  return run.start < start
}

const afterLine = (
  run: InlineRun,
  line: Line,
  text: string,
  blank: boolean,
) => {
  if (run.start === line.sourceEnd && text[run.start] === " ") return false
  if (run.kind === "break") return run.start > line.sourceEnd
  if (run.kind === "anchor" && (run.affinity === "previous" || blank)) {
    return run.start > line.sourceEnd
  }
  return run.start >= line.sourceEnd
}

const runWindow = (
  block: ExtractedBlock,
  line: Line,
  fromRun: number,
  throughRun: number,
) => {
  // A blank authored line still owns the wrapper edges surrounding its BR.
  const blank =
    line.breakKind === "forced" && line.sourceStart === line.sourceEnd
  // The preceding selected break can share an offset with an unconsumed
  // trailing anchor. Its authored run order takes precedence over affinity.
  const includeAnchors = blank || block.runs[fromRun - 1]?.kind === "break"
  let first = fromRun
  while (
    first < block.runs.length &&
    beforeLine(block.runs[first] as InlineRun, line.sourceStart, includeAnchors)
  ) {
    first += 1
  }
  let last = first
  while (
    last <= throughRun &&
    !afterLine(block.runs[last] as InlineRun, line, block.text, blank)
  ) {
    last += 1
  }
  return { first, last }
}

const placementOf = (
  build: LineBuild,
  run: InlineRun,
  previousWrappers: readonly HTMLElement[],
): RunPlacement => {
  const start = Math.max(build.sliceStart, run.start)
  const end = Math.min(build.sliceEnd, run.end)
  const isBreak = run.kind === "break"
  let shared = 0
  while (
    shared < run.wrappers.length &&
    run.wrappers[shared] === previousWrappers[shared]
  ) {
    shared += 1
  }
  return {
    run,
    shared,
    start,
    end,
    consumed: isBreak || run.end <= build.line.sourceEnd,
    // Extraction represents anchors with at least one authored wrapper.
    empty: !isBreak && start >= end && run.wrappers.length === 0,
  }
}

const cloneWrapper = (
  wrapper: HTMLElement,
  startsWrapper: boolean,
  endsWrapper: boolean,
  empty: boolean,
) => {
  const clone = wrapper.cloneNode(false) as HTMLElement
  if (!startsWrapper) clone.removeAttribute("id")
  clone.setAttribute(ATTRIBUTES.fragment, empty ? "empty" : "")
  clone.toggleAttribute(ATTRIBUTES.fragmentStart, startsWrapper)
  clone.toggleAttribute(ATTRIBUTES.fragmentEnd, endsWrapper)
  return clone
}

export const inheritFittedSpacing = (
  line: HTMLElement,
  fragment: HTMLElement,
) => {
  for (const [marker, property] of [
    [ATTRIBUTES.letterFit, "letter-spacing"],
    [ATTRIBUTES.wordFit, "word-spacing"],
  ] as const) {
    if (
      !line.hasAttribute(marker) ||
      fragment.style.getPropertyPriority(property) !== "important"
    )
      continue
    if (!fragment.hasAttribute(ATTRIBUTES.authoredStyle)) {
      // An inline important declaration necessarily has an authored style attribute.
      fragment.setAttribute(
        ATTRIBUTES.authoredStyle,
        fragment.getAttribute("style")!,
      )
    }
    fragment.style.setProperty(property, "inherit", "important")
  }
}

const attachWrapper = (
  build: LineBuild,
  wrapper: HTMLElement,
  branch: HTMLElement,
) => {
  const info = build.block.wrappers.get(wrapper)
  if (!info) return null

  // Distinct authored breaks can share a UTF-16 offset. Both coordinates
  // are needed to keep zero-text ancestors and their decorations on one side.
  const startsWrapper =
    build.line.sourceStart <= info.start && build.fromRun <= info.firstRun
  const endsWrapper =
    build.renderEnd >= info.end && build.throughRun >= info.lastRun
  const empty =
    Math.max(info.start, build.sliceStart) >= Math.min(info.end, build.sliceEnd)
  const clone = cloneWrapper(wrapper, startsWrapper, endsWrapper, empty)
  inheritFittedSpacing(build.target, clone)

  if (startsWrapper) {
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
    const clone = attachWrapper(build, wrappers[depth] as HTMLElement, branch)
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
  if (run.kind === "break") {
    const clone = run.sourceElement.cloneNode(true) as HTMLElement
    clone.toggleAttribute(ATTRIBUTES.opportunity, !run.forced)
    branch.appendChild(clone)
    return
  }
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

const appendRuns = (build: LineBuild) => {
  const { first, last } = runWindow(
    build.block,
    build.line,
    build.fromRun,
    build.throughRun,
  )
  let previousWrappers: readonly HTMLElement[] = []
  let nextRun = first
  let forcedBreak = false

  for (let index = first; index < last; index += 1) {
    const run = build.block.runs[index] as InlineRun
    const placement = placementOf(build, run, previousWrappers)
    if (placement.consumed) nextRun = index + 1
    if (placement.empty) continue

    build.openClones.length = placement.shared
    const branch = openWrappers(build, placement)
    if (!branch) return null

    appendContent(build, branch, placement)
    forcedBreak ||= run.kind === "break" && run.forced
    previousWrappers = run.wrappers
  }

  return { nextRun, forcedBreak }
}

export const appendLine = (
  target: HTMLElement,
  block: ExtractedBlock,
  line: Line,
  fromRun: number,
  throughRun = block.runs.length - 1,
) => {
  const build: LineBuild = {
    target,
    block,
    line,
    fromRun,
    throughRun,
    ...trimmedSlice(block, line),
    renderEnd:
      line.sourceEnd +
      Number(
        block.text[line.sourceEnd] === " " ||
          block.text[line.sourceEnd] === LINE_SEPARATOR,
      ),
    openClones: [],
    trailingEdges: [],
  }

  const appended = appendRuns(build)
  if (!appended) return null

  for (const edge of build.trailingEdges) {
    edge.target.append(...edge.nodes.map((node) => node.cloneNode(true)))
  }

  if (!appended.forcedBreak && line.breakKind === "forced") {
    target.appendChild(target.ownerDocument.createElement("br"))
  }
  return target.hasChildNodes() ? { nextRun: appended.nextRun } : null
}
