import type { CompiledBlock, CompiledRun } from "./layout/block"
import {
  compileBlock,
  type CompileResult,
  type RunEdges,
} from "./layout/compile"
import {
  defaultGlue,
  type GlueElasticity,
  type LayoutPolicy,
  resolvePolicy,
} from "./layout/policy"
import type { FontMetrics } from "./text/segments"
import type { StretchScale } from "./text/stretch"
import type { Hyphenator, SourceRange } from "./text/source"

export {
  type Advance,
  createMetrics,
  type FontMetrics,
  type MeasuredParagraph,
  type MeasuredSegment,
  type SegmentKind,
  segmentText,
  type TextSegment,
} from "./text/segments"
export {
  calibrateStretch,
  type StretchProbe,
  type StretchScale,
  type StretchStep,
} from "./text/stretch"
export type { CompileResult } from "./layout/compile"
export type { Flex } from "./layout/flex"
export type { Hangs } from "./layout/protrusion"
export type { GlueElasticity, LayoutPolicy } from "./layout/policy"
export type { ComposeReason } from "./reasons"
export type { Hyphenator, SourceRange } from "./text/source"

export type CompileTextOptions = {
  readonly locale?: string
  readonly hyphenate?: Hyphenator
  readonly code?: boolean
  readonly policy?: Partial<LayoutPolicy>
  readonly glue?: Partial<GlueElasticity>
  readonly protrude?: boolean
  readonly expand?: StretchScale
  readonly track?: number
}

export type CompileRunsOptions = CompileTextOptions & {
  readonly nowrap?: readonly SourceRange[]
}

export type CompileTextRun = {
  readonly text: string
  readonly metrics?: FontMetrics
  readonly code?: boolean
  readonly hyphenates?: boolean
  readonly leading?: number
  readonly trailing?: number
}

export type CompileAnchorRun = {
  readonly attach: "previous" | "next"
  readonly leading?: number
  readonly trailing?: number
}

export type CompileRun = CompileTextRun | CompileAnchorRun

type Runtime = {
  metricsFor(run: CompiledRun): FontMetrics
  isCode(run: CompiledRun): boolean
  edgesFor?(run: CompiledRun): RunEdges
}

const singleRun = (text: string): CompiledRun => ({
  kind: "text",
  text,
  start: 0,
  end: text.length,
  hyphenates: true,
})

const resolveGlue = (overrides?: Partial<GlueElasticity>): GlueElasticity =>
  overrides ? { ...defaultGlue, ...overrides } : defaultGlue

const compile = (
  block: CompiledBlock,
  base: FontMetrics,
  options: CompileRunsOptions,
  runtime: Runtime,
): CompileResult => {
  const { expand, track } = options
  return compileBlock({
    block,
    metricsFor: runtime.metricsFor,
    baseFont: base.font,
    atomWidth: () => 0,
    locale: options.locale ?? "en",
    isCode: runtime.isCode,
    policy: resolvePolicy(options.policy),
    glue: resolveGlue(options.glue),
    ...(runtime.edgesFor ? { edgesFor: runtime.edgesFor } : {}),
    ...(options.hyphenate ? { hyphenate: options.hyphenate } : {}),
    ...(options.protrude ? { protrude: true } : {}),
    ...(expand ? { scaleFor: () => expand } : {}),
    ...(track ? { track } : {}),
  })
}

export const compileText = (
  text: string,
  metrics: FontMetrics,
  options: CompileTextOptions = {},
): CompileResult =>
  compile(
    { text, runs: [singleRun(text)], breakRestrictions: [] },
    metrics,
    options,
    {
      metricsFor: () => metrics,
      isCode: () => options.code === true,
    },
  )

const NO_EDGES: RunEdges = Object.freeze({ leading: 0, trailing: 0 })

const isAnchor = (run: CompileRun): run is CompileAnchorRun => "attach" in run

const edgesOf = (run: CompileRun): RunEdges => {
  const leading = run.leading ?? 0
  const trailing = run.trailing ?? 0
  return leading === 0 && trailing === 0 ? NO_EDGES : { leading, trailing }
}

const runAt = (run: CompileRun, start: number): CompiledRun =>
  isAnchor(run)
    ? { kind: "anchor", text: "", start, end: start, affinity: run.attach }
    : {
        kind: "text",
        text: run.text,
        start,
        end: start + run.text.length,
        hyphenates: run.hyphenates !== false,
      }

const restrictions = (ranges?: readonly SourceRange[]): SourceRange[] => {
  if (!ranges) return []
  const merged: SourceRange[] = []
  const sorted = [...ranges].sort((left, right) => left.start - right.start)
  for (const range of sorted) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
      continue
    }
    merged.push({ start: range.start, end: range.end })
  }
  return merged
}

type Plan = {
  readonly block: CompiledBlock
  readonly runtime: Runtime
}

const textSpec = (run: CompileRun | undefined): CompileTextRun | undefined =>
  run && !isAnchor(run) ? run : undefined

const runtimeFor = (
  specs: ReadonlyMap<CompiledRun, CompileRun>,
  base: FontMetrics,
  code: boolean,
): Runtime => ({
  metricsFor: (run) => textSpec(specs.get(run))?.metrics ?? base,
  isCode: (run) => textSpec(specs.get(run))?.code ?? code,
  edgesFor: (run) => {
    const spec = specs.get(run)
    return spec ? edgesOf(spec) : NO_EDGES
  },
})

const planRuns = (
  runs: readonly CompileRun[],
  base: FontMetrics,
  options: CompileRunsOptions,
): Plan => {
  const specs = new Map<CompiledRun, CompileRun>()
  const compiled: CompiledRun[] = []
  let text = ""

  for (const run of runs) {
    const made = runAt(run, text.length)
    compiled.push(made)
    specs.set(made, run)
    text += made.text
  }

  return {
    block: {
      text,
      runs: compiled,
      breakRestrictions: restrictions(options.nowrap),
    },
    runtime: runtimeFor(specs, base, options.code === true),
  }
}

export const compileRuns = (
  runs: readonly CompileRun[],
  metrics: FontMetrics,
  options: CompileRunsOptions = {},
): CompileResult => {
  const plan = planRuns(runs, metrics, options)
  return compile(plan.block, metrics, options, plan.runtime)
}
