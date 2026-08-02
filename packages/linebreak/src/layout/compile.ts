import type { ComposeReason } from "../types"
import {
  breakAllowedAt,
  codeWrapper,
  type ExtractedBlock,
  hasVisibleText,
  type InlineRun,
  runEdgeWidths,
} from "../dom/extract"
import { codeBreakOffsets } from "../text/code-breaks"
import { hyphenationOffsets, usesEnglishHyphenation } from "../text/hyphenate"
import type { FontMetrics, MeasuredSegment, SegmentKind } from "../text/measure"
import { type Item, lineBreak, paragraphEnd } from "./items"
import {
  defaultGlue,
  type GlueElasticity,
  type LayoutPolicy,
  webDefaults,
} from "./policy"
import {
  buildHangs,
  endHang,
  type Hangs,
  hyphenHang,
  startHang,
} from "./protrusion"

export type CompileContext = {
  block: ExtractedBlock
  metricsFor: (run: InlineRun) => FontMetrics | null

  atomWidth: (run: InlineRun) => number
  locale: string

  hyphenate?: boolean
  protrude?: boolean
  policy?: LayoutPolicy
  glue?: GlueElasticity
}

export type CompileResult =
  | { ok: true; items: Item[]; hangs: Hangs | null }
  | { ok: false; reason: ComposeReason }

type Credits = {
  readonly startOf: Map<number, number>
  readonly endOf: Map<number, number>
  readonly folded: Set<number>
}

const emptyCredits = (): Credits => ({
  startOf: new Map(),
  endOf: new Map(),
  folded: new Set(),
})

const setCredit = (into: Map<number, number>, index: number, value: number) => {
  if (value !== 0) into.set(index, value)
}

const hangsFrom = (items: readonly Item[], credits: Credits): Hangs => {
  for (const index of credits.folded) {
    credits.startOf.delete(index)
    credits.endOf.delete(index)
  }
  return buildHangs(items, credits.startOf, credits.endOf)
}

type WordBreak = { at: number; penalty: number; flagged: boolean }

type Word = {
  readonly text: string
  readonly offset: number
  readonly width: number
  readonly breaks: readonly WordBreak[]
}

const glueFor = (
  width: number,
  start: number,
  end: number,
  elasticity: GlueElasticity,
): Item => ({
  kind: "glue",
  width,
  stretch: width * elasticity.stretch,
  shrink: width * elasticity.shrink,
  source: { start, end },
})

const softHyphenFor = (
  hyphenWidth: number,
  start: number,
  end: number,
  policy: LayoutPolicy,
): Item => ({
  kind: "discretionary",
  preWidth: hyphenWidth,
  postWidth: 0,
  noBreakWidth: 0,
  penalty: policy.hyphenPenalty,
  hyphen: true,
  source: { start, end },
  breakOffset: end,
})

const emitWord = (items: Item[], word: Word, metrics: FontMetrics) => {
  const { text, offset, width: wholeWidth, breaks } = word
  if (breaks.length === 0) {
    items.push({
      kind: "box",
      width: wholeWidth,
      source: { start: offset, end: offset + text.length },
    })
    return
  }

  let previousCut = 0
  let previousWidth = 0
  for (const { at, penalty, flagged } of breaks) {
    const prefixWidth = metrics.measureRun(text.slice(0, at))
    items.push({
      kind: "box",
      width: prefixWidth - previousWidth,
      source: { start: offset + previousCut, end: offset + at },
    })
    items.push({
      kind: "discretionary",
      preWidth: flagged ? metrics.hyphenWidth : 0,
      postWidth: 0,
      noBreakWidth: 0,
      penalty,
      hyphen: flagged,
      source: { start: offset + at, end: offset + at },
      breakOffset: offset + at,
    })
    previousCut = at
    previousWidth = prefixWidth
  }
  items.push({
    kind: "box",
    width: wholeWidth - previousWidth,
    source: { start: offset + previousCut, end: offset + text.length },
  })
}

const carriesContent = (run: InlineRun) =>
  run.kind === "atom" || (run.kind === "text" && hasVisibleText(run.text))

const breaksSomething = (runs: readonly InlineRun[]) => {
  const separates = runs.map(() => false)
  let contentBefore = false
  for (const [index, run] of runs.entries()) {
    separates[index] = contentBefore
    if (carriesContent(run)) contentBefore = true
    else if (run.kind === "break" && separates[index]) contentBefore = false
  }
  let contentAfter = false
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    separates[index] &&= contentAfter
    if (carriesContent(runs[index] as InlineRun)) contentAfter = true
  }
  return separates
}

const breaksInside = (
  context: CompileContext,
  text: string,
  start: number,
  options: { inCode: boolean; hyphenates: boolean; policy: LayoutPolicy },
): WordBreak[] => {
  const { breakRestrictions } = context.block
  const breaks: WordBreak[] = []

  if (options.inCode) {
    for (const [at, penalty] of codeBreakOffsets(text)) {
      if (breakAllowedAt(breakRestrictions, start + at)) {
        breaks.push({ at, penalty, flagged: false })
      }
    }
  } else if (options.hyphenates) {
    for (const at of hyphenationOffsets(text)) {
      if (breakAllowedAt(breakRestrictions, start + at)) {
        breaks.push({
          at,
          penalty: options.policy.hyphenPenalty,
          flagged: true,
        })
      }
    }
  }

  return breaks.sort((left, right) => left.at - right.at)
}

class PendingEdge {
  private owed = 0
  private readonly credits: Credits | null

  constructor(credits: Credits | null) {
    this.credits = credits
  }

  onto(items: Item[], width: number) {
    if (width === 0) return
    const last = items.at(-1)
    if (last?.kind === "box") {
      items[items.length - 1] = { ...last, width: last.width + width }
      this.credits?.folded.add(items.length - 1)
      return
    }
    this.owed += width
  }

  defer(width: number) {
    this.owed += width
  }

  take() {
    const owed = this.owed
    this.owed = 0
    return owed
  }
}

const EXISTING_HYPHEN = /[-‐‒–—]/u

type TextRun = Extract<InlineRun, { kind: "text" }>

export type Emit = {
  readonly items: Item[]
  readonly pending: PendingEdge
}

export type Settings = {
  readonly policy: LayoutPolicy
  readonly elasticity: GlueElasticity
  readonly hyphenates: boolean
}

type TextScope = {
  readonly context: CompileContext
  readonly run: TextRun
  readonly metrics: FontMetrics
  readonly emit: Emit
  readonly settings: Settings
  readonly edges: ReturnType<typeof runEdgeWidths>
  readonly inCode: boolean
  readonly hyphenates: boolean
  readonly credits: Credits | null
  previousKind: SegmentKind | null
  leadingApplied: boolean
}

const pushBoundaryPenalty = (
  scope: TextScope,
  segment: MeasuredSegment,
  start: number,
) => {
  const atBoundary =
    (scope.previousKind === "text" && segment.kind === "text") ||
    segment.kind === "break-opportunity" ||
    scope.previousKind === "break-opportunity"
  if (!atBoundary) return
  if (!breakAllowedAt(scope.context.block.breakRestrictions, start)) return

  const afterHyphen = EXISTING_HYPHEN.test(
    scope.context.block.text[start - 1] ?? "",
  )
  scope.emit.items.push({
    kind: "penalty",
    width: 0,
    penalty: afterHyphen ? scope.settings.policy.exHyphenPenalty : 0,
    flagged: afterHyphen,
    source: { start, end: start },
  })
}

const emitSoftHyphen = (
  scope: TextScope,
  segment: MeasuredSegment,
  start: number,
  end: number,
  trailing: number,
) => {
  const { items, pending } = scope.emit
  pending.onto(items, trailing)
  if (breakAllowedAt(scope.context.block.breakRestrictions, start)) {
    items.push(
      softHyphenFor(segment.lineEndWidth, start, end, scope.settings.policy),
    )
  }
}

const emitSpace = (
  scope: TextScope,
  segment: MeasuredSegment,
  start: number,
  end: number,
  trailing: number,
) => {
  const { items, pending } = scope.emit
  items.push(
    breakAllowedAt(scope.context.block.breakRestrictions, start)
      ? glueFor(segment.width, start, end, scope.settings.elasticity)
      : { kind: "box", width: segment.width, source: { start, end } },
  )
  pending.defer(trailing)
}

const emitTextSegment = (
  scope: TextScope,
  segment: MeasuredSegment,
  start: number,
  trailing: number,
) => {
  const { items, pending } = scope.emit
  const { policy } = scope.settings
  const edge =
    pending.take() + (scope.leadingApplied ? 0 : scope.edges.leading) + trailing
  scope.leadingApplied = true

  const before = items.length
  emitWord(
    items,
    {
      text: segment.text,
      offset: start,
      width: segment.width,
      breaks: breaksInside(scope.context, segment.text, start, {
        inCode: scope.inCode,
        hyphenates: scope.hyphenates,
        policy,
      }),
    },
    scope.metrics,
  )

  const first = items[before]
  if (edge !== 0 && first?.kind === "box") {
    items[before] = { ...first, width: first.width + edge }
  } else if (edge !== 0) {
    pending.defer(edge)
  }
  if (edge !== 0 && scope.credits) {
    scope.credits.folded.add(before)
    scope.credits.folded.add(items.length - 1)
  }
}

const creditSegment = (scope: TextScope, from: number) => {
  const { credits, metrics } = scope
  if (!credits || scope.inCode) return
  const { items } = scope.emit
  const { text } = scope.context.block
  const advance = (character: string) => metrics.measureRun(character)

  for (let index = from; index < items.length; index += 1) {
    const item = items[index] as Item
    if (item.kind === "discretionary") {
      setCredit(credits.endOf, index, hyphenHang(item.preWidth))
      continue
    }
    if (item.kind !== "box" || !item.source) continue
    const slice = text.slice(item.source.start, item.source.end)
    setCredit(credits.startOf, index, startHang(slice, advance))
    setCredit(credits.endOf, index, endHang(slice, advance))
  }
}

const emitSegment = (scope: TextScope, segment: MeasuredSegment) => {
  const start = scope.run.start + segment.start
  const end = scope.run.start + segment.end

  pushBoundaryPenalty(scope, segment, start)
  scope.previousKind = segment.kind
  const trailing = end === scope.run.end ? scope.edges.trailing : 0
  const before = scope.emit.items.length

  if (segment.kind === "soft-hyphen") {
    emitSoftHyphen(scope, segment, start, end, trailing)
  } else if (segment.kind === "space") {
    emitSpace(scope, segment, start, end, trailing)
  } else {
    emitTextSegment(scope, segment, start, trailing)
  }

  creditSegment(scope, before)
}

const compileText = (
  context: CompileContext,
  run: TextRun,
  metrics: FontMetrics,
  emit: Emit,
  settings: Settings,
  credits: Credits | null,
): ComposeReason | null => {
  const measured = metrics.measureParagraph(run.text)
  if (!measured) return "segmentation-mismatch"

  const scope: TextScope = {
    context,
    run,
    metrics,
    emit,
    settings,
    edges: runEdgeWidths(context.block, run),
    inCode: codeWrapper(run) !== undefined,
    hyphenates: settings.hyphenates && run.hyphenates,
    credits,
    previousKind: null,
    leadingApplied: false,
  }

  for (const segment of measured.segments) {
    emitSegment(scope, segment)
  }

  return null
}

export const compileBlock = (context: CompileContext): CompileResult => {
  const { block, metricsFor, atomWidth } = context
  const separates = breaksSomething(block.runs)
  const policy = context.policy ?? webDefaults
  const elasticity = context.glue ?? defaultGlue
  const settings: Settings = {
    policy,
    elasticity,
    hyphenates:
      (context.hyphenate ?? false) && usesEnglishHyphenation(context.locale),
  }
  const credits = context.protrude === true ? emptyCredits() : null
  const pending = new PendingEdge(credits)
  const items: Item[] = []
  const emit: Emit = { items, pending }

  for (const [runIndex, run] of block.runs.entries()) {
    if (run.kind === "anchor") {
      const edges = runEdgeWidths(block, run)
      const width = edges.leading + edges.trailing
      if (run.affinity === "previous") pending.onto(items, width)
      else pending.defer(width)
      continue
    }

    if (run.kind === "break") {
      if (!separates[runIndex]) continue
      items.push(
        ...(run.forced
          ? lineBreak(run.start, run.end)
          : [
              {
                kind: "penalty" as const,
                width: 0,
                penalty: 0,
                flagged: false,
                source: { start: run.start, end: run.end },
              },
            ]),
      )
      continue
    }

    if (run.kind === "atom") {
      const edges = runEdgeWidths(block, run)
      items.push({
        kind: "box",
        width: atomWidth(run) + edges.leading + edges.trailing + pending.take(),
        source: { start: run.start, end: run.end },
      })
      continue
    }

    const metrics = metricsFor(run)
    if (!metrics) return { ok: false, reason: "unmeasurable" }

    const failure = compileText(context, run, metrics, emit, settings, credits)
    if (failure) return { ok: false, reason: failure }
  }

  if (items.length === 0) return { ok: false, reason: "empty" }

  items.push(...paragraphEnd(block.text.length))
  return { ok: true, items, hangs: credits ? hangsFrom(items, credits) : null }
}
