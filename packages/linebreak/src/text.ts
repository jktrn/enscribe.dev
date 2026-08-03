import type { ExtractedBlock, InlineRun } from "./dom/extract"
import { compileBlock, type CompileResult } from "./layout/compile"
import {
  defaultGlue,
  type GlueElasticity,
  type LayoutPolicy,
  resolvePolicy,
} from "./layout/policy"
import type { FontMetrics } from "./text/segments"
import type { StretchScale } from "./text/stretch"
import type { Hyphenator } from "./types"

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
export type { ComposeReason, Hyphenator } from "./types"

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

const NO_WRAPPERS: ExtractedBlock["wrappers"] = new Map()

const singleRun = (text: string) =>
  ({
    kind: "text",
    text,
    start: 0,
    end: text.length,
    wrappers: [],
    hyphenates: true,
  }) as unknown as InlineRun

const resolveGlue = (overrides?: Partial<GlueElasticity>): GlueElasticity =>
  overrides ? { ...defaultGlue, ...overrides } : defaultGlue

export const compileText = (
  text: string,
  metrics: FontMetrics,
  options: CompileTextOptions = {},
): CompileResult => {
  const { expand, track } = options
  return compileBlock({
    block: {
      text,
      runs: [singleRun(text)],
      breakRestrictions: [],
      wrappers: NO_WRAPPERS,
    },
    metricsFor: () => metrics,
    baseFont: metrics.font,
    atomWidth: () => 0,
    locale: options.locale ?? "en",
    isCode: () => options.code === true,
    policy: resolvePolicy(options.policy),
    glue: resolveGlue(options.glue),
    ...(options.hyphenate ? { hyphenate: options.hyphenate } : {}),
    ...(options.protrude ? { protrude: true } : {}),
    ...(expand ? { scaleFor: () => expand } : {}),
    ...(track ? { track } : {}),
  })
}
