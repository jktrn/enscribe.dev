import type { ComposeReason } from "../reasons"
import type { CompiledRun } from "./block"
import { hasLineContent } from "../text/source"
import { type Item, isForced, lineBreak, paragraphEnd } from "./items"
import { appendSequenceDecoration, BreakSequences } from "./compile-breaks"
import { defaultGlue, webDefaults } from "./policy"
import { buildExpansion } from "./expansion"
import { type Flex, pooledFlex } from "./flex"
import { buildTracking } from "./tracking"
import { buildHangs, type Hangs } from "./protrusion"
import type { StretchScale } from "../text/stretch"
import { compileText, edgesOf } from "./compile-text"
import { appendAtomBoundary } from "./compile-atomic"
import {
  PendingEdge,
  type CompileContext,
  type CompiledExpansion,
  type CompileResult,
  type Credits,
  type Emit,
  type Settings,
} from "./compile-context"
export type {
  CompileContext,
  CompileResult,
  RunEdges,
} from "./compile-context"
type TextRun = Extract<CompiledRun, { kind: "text" }>

const emptyCredits = (): Credits => ({ startOf: new Map(), endOf: new Map() })

const hangsFrom = (
  items: readonly Item[],
  credits: Credits,
  folded: ReadonlySet<number>,
  sequences: BreakSequences | undefined,
): Hangs => {
  for (const index of folded) {
    credits.startOf.delete(index)
    credits.endOf.delete(index)
  }
  const hangs = buildHangs(items, credits.startOf, credits.endOf)
  sequences?.applyHangs(hangs)
  return hangs
}

const NO_MARKS: ReadonlySet<number> = new Set()
const NO_EXPANSION: CompiledExpansion = { expansion: null, scale: null }

type Expandable = {
  readonly uncredited: Set<number>
  readonly scaleFor: NonNullable<CompileContext["scaleFor"]>
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
): CompiledExpansion => {
  if (state.mixed || !state.scale) return NO_EXPANSION
  for (const index of folded) state.uncredited.add(index)
  const expansion = buildExpansion(items, state.scale, state.uncredited)
  return { expansion, scale: state.scale }
}

const carriesContent = (run: CompiledRun) =>
  run.kind === "atom" ||
  (run.kind === "text" && hasLineContent(run.text))

const lastContentIndex = (runs: readonly CompiledRun[]) => {
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    if (carriesContent(runs[index]!)) return index
  }
  return -1
}

const breaksSomething = (runs: readonly CompiledRun[]) => {
  const first = runs.findIndex(carriesContent)
  const last = lastContentIndex(runs)
  return (index: number) => first < index && index < last
}

type BlockScope = {
  readonly context: CompileContext
  readonly settings: Settings
  readonly credits: Credits | null
  readonly expandable: Expandable | null
  readonly tracking: { budget: number; unglyphed: Set<number> } | null
  readonly emit: Emit
  breakRuns?: Map<Item, number>
  sequences?: BreakSequences
}

const markFixed = (scope: BlockScope, index: number) => {
  scope.expandable?.uncredited.add(index)
  scope.tracking?.unglyphed.add(index)
}

const fixedBox = (
  scope: BlockScope,
  width: number,
  start: number,
  end: number,
) => {
  const { items } = scope.emit
  items.push({ kind: "box", width, source: { start, end } })
  markFixed(scope, items.length - 1)
}

const compileAnchorRun = (
  scope: BlockScope,
  run: Extract<CompiledRun, { kind: "anchor" }>,
) => {
  const { items, pending } = scope.emit
  const edges = edgesOf(scope.context, run)
  const width = edges.leading + edges.trailing
  if (appendSequenceDecoration(scope.emit, width, run.start)) return
  if (run.affinity === "previous") pending.onto(items, width)
  else pending.defer(width)
}

const compileBreakRun = (
  scope: BlockScope,
  run: Extract<CompiledRun, { kind: "break" }>,
  separates: boolean,
): Item | null => {
  const edges = edgesOf(scope.context, run)
  const width =
    edges.leading +
    edges.trailing +
    (run.forced ? scope.emit.pending.take() : 0)
  if (!run.forced && separates) {
    scope.sequences ??= new BreakSequences()
    return scope.sequences.append(scope.emit, width, run.start)
  }
  if (width !== 0) fixedBox(scope, width, run.start, run.start)
  if (run.forced) {
    scope.emit.space = undefined
    scope.emit.sequence = undefined
    scope.emit.items.push(...lineBreak(run.start, run.end))
    return scope.emit.items.at(-1)!
  }
  return null
}

const compileAtomRun = (
  scope: BlockScope,
  run: Extract<CompiledRun, { kind: "atom" }>,
): ComposeReason | null => {
  const { atomWidth } = scope.context
  if (!atomWidth) return "unmeasurable"
  const { pending } = scope.emit
  scope.emit.space = undefined
  scope.emit.sequence = undefined
  const edges = edgesOf(scope.context, run)
  appendAtomBoundary(scope.emit, scope.context.block, run.start)
  fixedBox(
    scope,
    atomWidth(run) + edges.leading + edges.trailing + pending.take(),
    run.start,
    run.end,
  )
  scope.emit.atomEnd = run.end
  return null
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

  const scale = expandable.scaleFor(run)
  if (scale) noteScale(expandable, scale)
  else markUncredited(scope.emit.items, before, expandable.uncredited)
  return null
}

const compileRun = (
  scope: BlockScope,
  run: Exclude<CompiledRun, { kind: "break" }>,
): ComposeReason | null => {
  if (run.kind === "anchor") {
    compileAnchorRun(scope, run)
    return null
  }
  if (run.kind === "atom") {
    return compileAtomRun(scope, run)
  }
  return compileTextRun(scope, run)
}

const blockSettings = (context: CompileContext): Settings => ({
  policy: context.policy ?? webDefaults,
  elasticity: context.glue ?? defaultGlue,
})

const blockScope = (context: CompileContext): BlockScope => {
  const credits = context.protrude === true ? emptyCredits() : null
  const { scaleFor } = context
  const expandable: Expandable | null = scaleFor
    ? { uncredited: new Set(), scaleFor, scale: null, mixed: false }
    : null
  const tracking = context.track
    ? { budget: context.track, unglyphed: new Set<number>() }
    : null
  const folded = credits || expandable || tracking ? new Set<number>() : null
  return {
    context,
    settings: blockSettings(context),
    credits,
    expandable,
    tracking,
    emit: { items: [], pending: new PendingEdge(folded), folded },
  }
}

const trackingFrom = (scope: BlockScope, folded: ReadonlySet<number>) => {
  const { tracking } = scope
  if (!tracking) return null
  for (const index of folded) tracking.unglyphed.add(index)
  return buildTracking(scope.emit.items, tracking.budget, tracking.unglyphed)
}

const pooled = (expansion: Flex | null, tracking: Flex | null) =>
  expansion && tracking
    ? pooledFlex(expansion, tracking)
    : (expansion ?? tracking)

const indexedBreakRuns = (scope: BlockScope) => {
  if (!scope.breakRuns) return undefined
  const indexed = new Map<number, number>()
  // Compilation can replace endpoints and move glue. Resolve final indices only
  // after those edits; discarded endpoint identities no longer receive a row.
  for (const [index, item] of scope.emit.items.entries()) {
    const runIndex = scope.breakRuns.get(item)
    if (runIndex !== undefined) indexed.set(index, runIndex)
  }
  return indexed
}

const compiled = (scope: BlockScope): CompileResult => {
  scope.sequences?.finish(scope.emit.items, scope.breakRuns!)
  const { credits, expandable, emit } = scope
  const marks = emit.folded ?? NO_MARKS
  const expanded = expandable
    ? expansionFrom(emit.items, expandable, marks)
    : NO_EXPANSION
  const tracking = trackingFrom(scope, marks)
  return {
    ok: true,
    items: emit.items,
    breakRuns: indexedBreakRuns(scope),
    hangs: credits
      ? hangsFrom(emit.items, credits, marks, scope.sequences)
      : null,
    ...expanded,
    tracking,
    flex: pooled(expanded.expansion, tracking),
  }
}

export const compileBlock = (context: CompileContext): CompileResult => {
  const { block } = context
  const separates = breaksSomething(block.runs)
  const scope = blockScope(context)
  const { items } = scope.emit

  for (const [runIndex, run] of block.runs.entries()) {
    if (run.kind === "break") {
      const endpoint = compileBreakRun(scope, run, separates(runIndex))
      if (endpoint) {
        scope.breakRuns ??= new Map()
        scope.breakRuns.set(endpoint, runIndex)
      }
      continue
    }

    const failure = compileRun(scope, run)
    if (failure) return { ok: false, reason: failure }
  }

  if (items.length === 0) return { ok: false, reason: "empty" }

  const last = items.at(-1) as Item
  if (last.kind !== "penalty" || !isForced(last.penalty)) {
    items.push(...paragraphEnd(block.text.length))
  }
  return compiled(scope)
}
