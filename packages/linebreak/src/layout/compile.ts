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
import type { FontMetrics } from "../text/measure"
import { type Item, lineBreak, paragraphEnd } from "./items"
import {
  defaultGlue,
  type GlueElasticity,
  type LayoutPolicy,
  webDefaults,
} from "./policy"

export type CompileContext = {
  block: ExtractedBlock
  metricsFor: (run: InlineRun) => FontMetrics | null

  atomWidth: (run: InlineRun) => number
  locale: string

  hyphenate?: boolean
  policy?: LayoutPolicy
  glue?: GlueElasticity
  maximumCharacters?: number
}

export type CompileResult =
  | { ok: true; items: Item[] }
  | { ok: false; reason: ComposeReason }

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

  onto(items: Item[], width: number) {
    if (width === 0) return
    const last = items.at(-1)
    if (last?.kind === "box") {
      items[items.length - 1] = { ...last, width: last.width + width }
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

const compileText = (
  context: CompileContext,
  run: Extract<InlineRun, { kind: "text" }>,
  metrics: FontMetrics,
  pending: PendingEdge,
  items: Item[],
  hyphenatesHere: boolean,
  policy: LayoutPolicy,
  elasticity: GlueElasticity,
): ComposeReason | null => {
  const measured = metrics.measureParagraph(run.text)
  if (!measured) return "segmentation-mismatch"

  const { breakRestrictions } = context.block
  const edges = runEdgeWidths(context.block, run)
  const inCode = codeWrapper(run) !== undefined
  const hyphenates = hyphenatesHere && run.hyphenates
  let leadingApplied = false
  let previousKind: string | null = null

  for (const segment of measured.segments) {
    const start = run.start + segment.start
    const end = run.start + segment.end

    const atBoundary =
      (previousKind === "text" && segment.kind === "text") ||
      segment.kind === "break-opportunity" ||
      previousKind === "break-opportunity"
    if (atBoundary && breakAllowedAt(breakRestrictions, start)) {
      const afterHyphen = EXISTING_HYPHEN.test(
        context.block.text[start - 1] ?? "",
      )
      items.push({
        kind: "penalty",
        width: 0,
        penalty: afterHyphen ? policy.exHyphenPenalty : 0,
        flagged: afterHyphen,
        source: { start, end: start },
      })
    }
    previousKind = segment.kind

    if (segment.kind === "space") {
      if (breakAllowedAt(breakRestrictions, start)) {
        items.push(glueFor(segment.width, start, end, elasticity))
      } else {
        items.push({
          kind: "box",
          width: segment.width,
          source: { start, end },
        })
      }
      continue
    }

    const edge =
      pending.take() +
      (leadingApplied ? 0 : edges.leading) +
      (end === run.end ? edges.trailing : 0)
    leadingApplied = true

    const before = items.length
    emitWord(
      items,
      {
        text: segment.text,
        offset: start,
        width: segment.width,
        breaks: breaksInside(context, segment.text, start, {
          inCode,
          hyphenates,
          policy,
        }),
      },
      metrics,
    )

    const first = items[before]
    if (edge !== 0 && first?.kind === "box") {
      items[before] = { ...first, width: first.width + edge }
    } else if (edge !== 0) {
      pending.defer(edge)
    }
  }

  return null
}

export const compileBlock = (context: CompileContext): CompileResult => {
  const { block, metricsFor, atomWidth } = context
  const separates = breaksSomething(block.runs)
  const policy = context.policy ?? webDefaults
  const elasticity = context.glue ?? defaultGlue
  const hyphenates =
    (context.hyphenate ?? false) && usesEnglishHyphenation(context.locale)
  const pending = new PendingEdge()
  const items: Item[] = []

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

    const failure = compileText(
      context,
      run,
      metrics,
      pending,
      items,
      hyphenates,
      policy,
      elasticity,
    )
    if (failure) return { ok: false, reason: failure }
  }

  if (items.length === 0) return { ok: false, reason: "empty" }

  items.push(...paragraphEnd(block.text.length))
  return { ok: true, items }
}
