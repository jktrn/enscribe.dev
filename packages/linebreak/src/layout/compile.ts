import type { ComposeReason } from "../reasons"
import type { CompiledBlock, CompiledRun } from "./block"
import {
  breakAllowedAt,
  hasVisibleText,
  type Hyphenator,
  type SourceRange,
} from "../text/source"
import { codeBreakOffsets } from "../text/code-breaks"
import type {
  FontMetrics,
  MeasuredSegment,
  SegmentKind,
} from "../text/segments"
import { type Item, lineBreak, paragraphEnd } from "./items"
import {
  defaultGlue,
  type GlueElasticity,
  type LayoutPolicy,
  webDefaults,
} from "./policy"
import { buildExpansion } from "./expansion"
import { type Flex, pooledFlex } from "./flex"
import { buildTracking } from "./tracking"
import {
  buildHangs,
  endHang,
  type Hangs,
  hyphenHang,
  startHang,
} from "./protrusion"
import type { StretchScale } from "../text/stretch"

export type RunEdges = { leading: number; trailing: number }

export type CompileContext = {
  block: CompiledBlock
  metricsFor(run: CompiledRun): FontMetrics | null
  baseFont: string

  atomWidth(run: CompiledRun): number
  locale: string

  isCode?(run: CompiledRun): boolean
  edgesFor?(run: CompiledRun): RunEdges

  hyphenate?: Hyphenator
  protrude?: boolean
  scaleFor?(run: CompiledRun): StretchScale | null
  track?: number
  policy?: LayoutPolicy
  glue?: GlueElasticity
}

export type CompileResult =
  | {
      ok: true
      items: Item[]
      hangs: Hangs | null
      expansion: Flex | null
      tracking: Flex | null
      flex: Flex | null
      scale: StretchScale | null
    }
  | { ok: false; reason: ComposeReason }

type Credits = {
  readonly startOf: Map<number, number>
  readonly endOf: Map<number, number>
}

const emptyCredits = (): Credits => ({ startOf: new Map(), endOf: new Map() })

const setCredit = (into: Map<number, number>, index: number, value: number) => {
  if (value !== 0) into.set(index, value)
}

const hangsFrom = (
  items: readonly Item[],
  credits: Credits,
  folded: ReadonlySet<number>,
): Hangs => {
  for (const index of folded) {
    credits.startOf.delete(index)
    credits.endOf.delete(index)
  }
  return buildHangs(items, credits.startOf, credits.endOf)
}

const NO_MARKS: ReadonlySet<number> = new Set()

type Expandable = {
  readonly uncredited: Set<number>
  scale: StretchScale | null
  mixed: boolean
}

const markUncredited = (
  items: readonly Item[],
  from: number,
  into: Set<number>,
) => {
  for (let index = from; index < items.length; index += 1) {
    if ((items[index] as Item).kind === "box") into.add(index)
  }
}

const noteScale = (state: Expandable, scale: StretchScale) => {
  if (state.scale === null) state.scale = scale
  else if (state.scale !== scale) state.mixed = true
}

const expansionFrom = (
  items: readonly Item[],
  state: Expandable,
  folded: ReadonlySet<number>,
) => {
  if (state.mixed || !state.scale) return null
  for (const index of folded) state.uncredited.add(index)
  return buildExpansion(items, state.scale, state.uncredited)
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

const carriesContent = (run: CompiledRun) =>
  run.kind === "atom" || (run.kind === "text" && hasVisibleText(run.text))

const forgetBreaksAfterContent = (
  runs: readonly CompiledRun[],
  separates: boolean[],
) => {
  let contentAfter = false
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    separates[index] &&= contentAfter
    if (carriesContent(runs[index] as CompiledRun)) contentAfter = true
  }
}

const breaksSomething = (runs: readonly CompiledRun[]) => {
  const separates = runs.map(() => false)
  let contentBefore = false
  for (const [index, run] of runs.entries()) {
    separates[index] = contentBefore
    if (carriesContent(run)) contentBefore = true
    else if (run.kind === "break" && separates[index]) contentBefore = false
  }
  forgetBreaksAfterContent(runs, separates)
  return separates
}

const byOffset = (left: WordBreak, right: WordBreak) => left.at - right.at

const allowedCodeBreaks = (
  restrictions: readonly SourceRange[],
  text: string,
  start: number,
): WordBreak[] => {
  const breaks: WordBreak[] = []
  for (const [at, penalty] of codeBreakOffsets(text)) {
    if (breakAllowedAt(restrictions, start + at)) {
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
  const restrictions = context.block.breakRestrictions
  const breaks: WordBreak[] = []
  for (const at of hyphenate(text, context.locale)) {
    if (breakAllowedAt(restrictions, start + at)) {
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
  const { breakRestrictions } = context.block

  if (options.inCode) {
    return allowedCodeBreaks(breakRestrictions, text, start).sort(byOffset)
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

class PendingEdge {
  private owed = 0
  private readonly folded: Set<number> | null

  constructor(folded: Set<number> | null) {
    this.folded = folded
  }

  onto(items: Item[], width: number) {
    if (width === 0) return
    const last = items.at(-1)
    if (last?.kind === "box") {
      items[items.length - 1] = { ...last, width: last.width + width }
      this.folded?.add(items.length - 1)
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

type TextRun = Extract<CompiledRun, { kind: "text" }>

export type Emit = {
  readonly items: Item[]
  readonly pending: PendingEdge
  readonly folded: Set<number> | null
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
  readonly edges: RunEdges
  readonly inCode: boolean
  readonly protrudes: boolean
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
  const leading =
    pending.take() + (scope.leadingApplied ? 0 : scope.edges.leading)
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
  if (leading !== 0 && first?.kind === "box") {
    items[before] = { ...first, width: first.width + leading }
    scope.emit.folded?.add(before)
  } else if (leading !== 0) {
    pending.defer(leading)
  }

  pending.onto(items, trailing)
}

const creditSegment = (scope: TextScope, from: number) => {
  const { credits, metrics } = scope
  if (!credits || !scope.protrudes) return
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

type BlockScope = {
  readonly context: CompileContext
  readonly settings: Settings
  readonly credits: Credits | null
  readonly expandable: Expandable | null
  readonly unglyphed: Set<number> | null
  readonly emit: Emit
}

const NO_EDGES: RunEdges = { leading: 0, trailing: 0 }

const edgesOf = (context: CompileContext, run: CompiledRun) =>
  context.edgesFor?.(run) ?? NO_EDGES

const MONO_TOLERANCE = 0.01

const insetMonospace = (context: CompileContext, metrics: FontMetrics) =>
  metrics.font !== context.baseFont &&
  Math.abs(metrics.measureRun("i") - metrics.measureRun("M")) < MONO_TOLERANCE

const compileText = (
  block: BlockScope,
  run: TextRun,
  metrics: FontMetrics,
): ComposeReason | null => {
  const measured = metrics.measureParagraph(run.text)
  if (!measured) return "segmentation-mismatch"

  const inCode = block.context.isCode?.(run) ?? false
  const scope: TextScope = {
    context: block.context,
    run,
    metrics,
    emit: block.emit,
    settings: block.settings,
    edges: edgesOf(block.context, run),
    inCode,
    protrudes: !inCode && !insetMonospace(block.context, metrics),
    hyphenates: block.settings.hyphenates && run.hyphenates,
    credits: block.credits,
    previousKind: null,
    leadingApplied: false,
  }

  for (const segment of measured.segments) {
    emitSegment(scope, segment)
  }

  return null
}

const compileAnchorRun = (
  scope: BlockScope,
  run: Extract<CompiledRun, { kind: "anchor" }>,
) => {
  const { items, pending } = scope.emit
  const edges = edgesOf(scope.context, run)
  const width = edges.leading + edges.trailing
  if (run.affinity === "previous") pending.onto(items, width)
  else pending.defer(width)
}

const compileBreakRun = (
  scope: BlockScope,
  run: Extract<CompiledRun, { kind: "break" }>,
) => {
  if (run.forced) {
    scope.emit.items.push(...lineBreak(run.start, run.end))
    return
  }
  scope.emit.items.push({
    kind: "penalty",
    width: 0,
    penalty: 0,
    flagged: false,
    source: { start: run.start, end: run.end },
  })
}

const compileAtomRun = (
  scope: BlockScope,
  run: Extract<CompiledRun, { kind: "atom" }>,
) => {
  const { items, pending } = scope.emit
  const edges = edgesOf(scope.context, run)
  items.push({
    kind: "box",
    width:
      scope.context.atomWidth(run) +
      edges.leading +
      edges.trailing +
      pending.take(),
    source: { start: run.start, end: run.end },
  })
  scope.expandable?.uncredited.add(items.length - 1)
  scope.unglyphed?.add(items.length - 1)
}

const compileTextRun = (
  scope: BlockScope,
  run: TextRun,
): ComposeReason | null => {
  const metrics = scope.context.metricsFor(run)
  if (!metrics) return "unmeasurable"

  const before = scope.emit.items.length
  const failure = compileText(scope, run, metrics)
  if (failure) return failure

  const { expandable } = scope
  if (!expandable) return null

  const scale = scope.context.scaleFor?.(run) ?? null
  if (scale) noteScale(expandable, scale)
  else markUncredited(scope.emit.items, before, expandable.uncredited)
  return null
}

const compileRun = (
  scope: BlockScope,
  run: CompiledRun,
): ComposeReason | null => {
  if (run.kind === "anchor") {
    compileAnchorRun(scope, run)
    return null
  }
  if (run.kind === "break") {
    compileBreakRun(scope, run)
    return null
  }
  if (run.kind === "atom") {
    compileAtomRun(scope, run)
    return null
  }
  return compileTextRun(scope, run)
}

const blockSettings = (context: CompileContext): Settings => ({
  policy: context.policy ?? webDefaults,
  elasticity: context.glue ?? defaultGlue,
  hyphenates: typeof context.hyphenate === "function",
})

const blockScope = (context: CompileContext): BlockScope => {
  const credits = context.protrude === true ? emptyCredits() : null
  const expandable: Expandable | null = context.scaleFor
    ? { uncredited: new Set(), scale: null, mixed: false }
    : null
  const unglyphed = context.track ? new Set<number>() : null
  const folded = credits || expandable || unglyphed ? new Set<number>() : null
  return {
    context,
    settings: blockSettings(context),
    credits,
    expandable,
    unglyphed,
    emit: { items: [], pending: new PendingEdge(folded), folded },
  }
}

const trackingFrom = (scope: BlockScope, folded: ReadonlySet<number>) => {
  const { context, unglyphed } = scope
  if (!unglyphed || !context.track) return null
  for (const index of folded) unglyphed.add(index)
  return buildTracking(scope.emit.items, context.track, unglyphed)
}

const pooled = (expansion: Flex | null, tracking: Flex | null) =>
  expansion && tracking
    ? pooledFlex(expansion, tracking)
    : (expansion ?? tracking)

const compiled = (scope: BlockScope): CompileResult => {
  const { credits, expandable, emit } = scope
  const marks = emit.folded ?? NO_MARKS
  const expansion = expandable
    ? expansionFrom(emit.items, expandable, marks)
    : null
  const tracking = trackingFrom(scope, marks)
  return {
    ok: true,
    items: emit.items,
    hangs: credits ? hangsFrom(emit.items, credits, marks) : null,
    expansion,
    tracking,
    flex: pooled(expansion, tracking),
    scale: expansion && expandable ? expandable.scale : null,
  }
}

export const compileBlock = (context: CompileContext): CompileResult => {
  const { block } = context
  const separates = breaksSomething(block.runs)
  const scope = blockScope(context)
  const { items } = scope.emit

  for (const [runIndex, run] of block.runs.entries()) {
    if (run.kind === "break" && !separates[runIndex]) continue

    const failure = compileRun(scope, run)
    if (failure) return { ok: false, reason: failure }
  }

  if (items.length === 0) return { ok: false, reason: "empty" }

  items.push(...paragraphEnd(block.text.length))
  return compiled(scope)
}
