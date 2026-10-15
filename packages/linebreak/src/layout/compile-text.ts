import type { ComposeReason } from "../reasons"
import type { CompiledRun } from "./block"
import {
  breakAllowedAt,
  combiningBaseEnd,
  combiningBoundaryAllows,
  hyphenBoundaryAllows,
  hasLineContent,
  type Hyphenator,
  wordJoinerAllows,
} from "../text/source"
import { codeBreakOffsets } from "../text/code-breaks"
import { appendAtomBoundary } from "./compile-atomic"
import type {
  FontMetrics,
  MeasuredSegment,
  SegmentKind,
} from "../text/segments"
import { appendCompiledSpace, appendSequenceDecoration, type CompiledSpace } from "./compile-breaks"
import { type Item, penalty } from "./items"
import {
  INFINITE_PENALTY,
  type GlueElasticity,
  type LayoutPolicy,
} from "./policy"
import { endHang, hyphenHang, startHang } from "./protrusion"
import type {
  CompileContext,
  Credits,
  Emit,
  RunEdges,
  Settings,
} from "./compile-context"

type TextRun = Extract<CompiledRun, { kind: "text" }>
type TextBlock = {
  context: CompileContext
  settings: Settings
  credits: Credits | null
  emit: Emit
}
const EXISTING_HYPHEN = /[-‐‒–—]/u
const setCredit = (into: Map<number, number>, index: number, value: number) => {
  if (value !== 0) into.set(index, value)
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
): CompiledSpace => ({
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
  if (breaks.length > 1 && metrics.warmRuns) {
    metrics.warmRuns(breaks.map(({ at }) => text.slice(0, at)))
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

const byOffset = (left: WordBreak, right: WordBreak) => left.at - right.at

const canBreak = (context: CompileContext, start: number, end = start) =>
  breakAllowedAt(context.block.breakRestrictions, start) &&
  combiningBoundaryAllows(context.block.text, end) &&
  wordJoinerAllows(context.block.text, end) &&
  hyphenBoundaryAllows(context.block.text, end)

const allowedCodeBreaks = (
  context: CompileContext,
  text: string,
  start: number,
): WordBreak[] => {
  const breaks: WordBreak[] = []
  for (const [at, penalty] of codeBreakOffsets(text)) {
    if (canBreak(context, start + at)) {
      breaks.push({ at, penalty, flagged: false })
    }
  }
  return breaks
}

const allowedHyphenBreaks = (
  context: CompileContext,
  hyphenate: Hyphenator,
  text: string,
  start: number,
  penalty: number,
): WordBreak[] => {
  const breaks: WordBreak[] = []
  for (const at of hyphenate(text, context.locale)) {
    if (canBreak(context, start + at)) {
      breaks.push({ at, penalty, flagged: true })
    }
  }
  return breaks
}

const breaksInside = (
  context: CompileContext,
  text: string,
  start: number,
  options: { inCode: boolean; hyphenates: boolean; policy: LayoutPolicy },
): WordBreak[] => {
  if (options.inCode) {
    return allowedCodeBreaks(context, text, start).sort(byOffset)
  }
  const { hyphenate } = context
  if (options.hyphenates && hyphenate) {
    const penalty = options.policy.hyphenPenalty
    return allowedHyphenBreaks(context, hyphenate, text, start, penalty).sort(
      byOffset,
    )
  }
  return []
}

type TextScope = {
  readonly context: CompileContext
  readonly run: TextRun
  readonly metrics: FontMetrics
  readonly emit: Emit
  readonly settings: Settings
  readonly edges: RunEdges
  readonly inCode: boolean
  readonly hyphenates: boolean
  readonly credits: Credits | null
  previousKind: SegmentKind | null
}

const pushBoundaryPenalty = (
  scope: TextScope,
  segment: MeasuredSegment,
  start: number,
) => {
  const atBoundary =
    scope.previousKind === "text" && segment.kind === "text"
  if (!atBoundary) return
  if (!canBreak(scope.context, start)) return

  const afterHyphen = EXISTING_HYPHEN.test(
    scope.context.block.text.charAt(combiningBaseEnd(scope.context.block.text, start) - 1),
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
  scope.emit.space = undefined
  scope.emit.sequence = undefined
  pending.onto(items, trailing)
  if (canBreak(scope.context, start, end)) {
    items.push(
      softHyphenFor(segment.lineEndWidth, start, end, scope.settings.policy),
    )
  } else if (items.length === 0) {
    // Retain leading source without introducing printable content or a break.
    items.push(penalty(INFINITE_PENALTY, { source: { start, end } }))
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
  const decoration = pending.take() + trailing
  if (!appendSequenceDecoration(scope.emit, decoration, start)) {
    pending.onto(items, decoration)
  }
  const wraps = canBreak(scope.context, start, end)
  appendCompiledSpace(
    scope.emit,
    glueFor(segment.width, start, end, scope.settings.elasticity),
    wraps,
  )
}

const emitTextSegment = (
  scope: TextScope,
  segment: MeasuredSegment,
  start: number,
  trailing: number,
) => {
  const { items, pending } = scope.emit
  const { policy } = scope.settings
  scope.emit.space = undefined
  scope.emit.sequence = undefined
  const leading = pending.take()

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

  const first = items[before] as Extract<Item, { kind: "box" }>
  if (leading !== 0) {
    items[before] = { ...first, width: first.width + leading }
    scope.emit.folded?.add(before)
  }

  pending.onto(items, trailing)
}

const emitZeroWidthBreak = (
  scope: TextScope,
  segment: MeasuredSegment,
  start: number,
  end: number,
  trailing: number,
) => {
  // Retaining the marker separates spaces on either side during line trimming.
  emitTextSegment(scope, segment, start, trailing)
  // UAX #14 LB7/LB8: the opportunity follows ZW, never precedes another ZW.
  const { text } = scope.context.block
  if (text[end] === "\u200b") return
  if (!hasLineContent(text.slice(end))) return
  if (!canBreak(scope.context, end)) return
  scope.emit.items.push(penalty(0, { source: { start: end, end } }))
}

const creditSegment = (scope: TextScope, from: number) => {
  const { credits, metrics } = scope
  if (!credits) return
  const { items } = scope.emit
  const { text } = scope.context.block
  const advance = (character: string) => metrics.measureRun(character)

  for (let index = from; index < items.length; index += 1) {
    const item = items[index] as Item
    if (item.kind === "discretionary") {
      setCredit(credits.endOf, index, hyphenHang(item.preWidth))
      continue
    }
    if (item.kind !== "box") continue
    const source = item.source! // Every item emitted for a text segment has a source range.
    const slice = text.slice(source.start, source.end)
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
  } else if (segment.kind === "break-opportunity") {
    emitZeroWidthBreak(scope, segment, start, end, trailing)
  } else {
    emitTextSegment(scope, segment, start, trailing)
  }

  creditSegment(scope, before)
}

const NO_EDGES: RunEdges = { leading: 0, trailing: 0 }

export const edgesOf = (context: CompileContext, run: CompiledRun) =>
  context.edgesFor?.(run) ?? NO_EDGES

const MONO_TOLERANCE = 0.01

const insetMonospace = (context: CompileContext, metrics: FontMetrics) =>
  metrics.font !== context.baseFont &&
  Math.abs(metrics.measureRun("i") - metrics.measureRun("M")) < MONO_TOLERANCE

export const compileText = (
  block: TextBlock,
  run: TextRun,
  metrics: FontMetrics,
): ComposeReason | null => {
  const measured = metrics.measureParagraph(run.text)
  if (!measured) return "segmentation-mismatch"

  const firstKind = measured.segments[0]?.kind
  if (
    block.emit.atomEnd === run.start &&
    (firstKind === "text" || firstKind === "other")
  ) {
    appendAtomBoundary(block.emit, block.context.block, run.start)
  }

  const inCode = block.context.isCode?.(run) ?? false
  const scope: TextScope = {
    context: block.context,
    run,
    metrics,
    emit: block.emit,
    settings: block.settings,
    edges: edgesOf(block.context, run),
    inCode,
    hyphenates: run.hyphenates,
    credits:
      block.credits && !inCode && !insetMonospace(block.context, metrics)
        ? block.credits
        : null,
    previousKind: null,
  }

  scope.emit.pending.defer(scope.edges.leading)
  for (const segment of measured.segments) {
    emitSegment(scope, segment)
  }

  return null
}
