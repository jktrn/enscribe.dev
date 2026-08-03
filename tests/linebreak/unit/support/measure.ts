import {
  codeWrapper,
  type ExtractedBlock,
  type InlineRun,
  runEdgeWidths,
} from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import type { Item } from "@linebreak/layout/items"
import {
  defaultGlue,
  type LayoutPolicy,
  texDefaults,
} from "@linebreak/layout/policy"
import { englishHyphenator } from "@linebreak/text/hyphenate"
import type { FontMetrics, MeasuredSegment } from "@linebreak/text/segments"
import type { StretchScale } from "@linebreak/text/stretch"

export const AFFINE: StretchScale = {
  steps: [
    { pct: 98, ratio: 0.98 },
    { pct: 99, ratio: 0.99 },
    { pct: 100, ratio: 1 },
    { pct: 101, ratio: 1.01 },
    { pct: 102, ratio: 1.02 },
  ],
}

export const CHARACTER = 10
export const HYPHEN = 5
export const SHY = "­"

const textSegment = (text: string, end: number): MeasuredSegment => ({
  text,
  start: end - text.length,
  end,
  kind: "text",
  width: text.length * CHARACTER,
  lineEndWidth: 0,
})

const BREAK_SEGMENT: Record<string, (at: number) => MeasuredSegment> = {
  " ": (at) => ({
    text: " ",
    start: at,
    end: at + 1,
    kind: "space",
    width: CHARACTER,
    lineEndWidth: 0,
  }),
  [SHY]: (at) => ({
    text: SHY,
    start: at,
    end: at + 1,
    kind: "soft-hyphen",
    width: 0,
    lineEndWidth: HYPHEN,
  }),
}

const segmentsOf = (text: string): MeasuredSegment[] => {
  const segments: MeasuredSegment[] = []
  let pending = ""

  const flush = (at: number) => {
    if (pending.length > 0) segments.push(textSegment(pending, at))
    pending = ""
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] as string
    const breakSegment = BREAK_SEGMENT[character]
    if (!breakSegment) {
      pending += character
      continue
    }
    flush(index)
    segments.push(breakSegment(index))
  }
  flush(text.length)
  return segments
}

export const metrics: FontMetrics = {
  font: "16px serif",
  letterSpacing: 0,
  hyphenWidth: HYPHEN,
  measureRun: (text) => text.length * CHARACTER,
  measureParagraph: (text) => ({
    segments: segmentsOf(text),
    hyphenWidth: HYPHEN,
  }),
}

const element = (localName = "em") => ({ localName }) as HTMLElement

export type BlockShape = {
  readonly texts: readonly string[]
  readonly trailingEdge?: number
  readonly leadingEdge?: number
  readonly localName?: string
  readonly hyphenates?: boolean
}

export const blockOf = (shape: BlockShape): ExtractedBlock => {
  const wrapper = element(shape.localName)
  const runs: InlineRun[] = []
  let offset = 0
  for (const [index, text] of shape.texts.entries()) {
    runs.push({
      kind: "text",
      text,
      start: offset,
      end: offset + text.length,
      wrappers: index === 0 ? [wrapper] : [],
      sourceElement: element(),
      hyphenates: shape.hyphenates ?? false,
    })
    offset += text.length
  }

  const first = runs[0] as InlineRun
  return {
    text: shape.texts.join(""),
    runs,
    breakRestrictions: [],
    wrappers: new Map([
      [
        wrapper,
        {
          start: first.start,
          end: first.end,
          firstRun: 0,
          lastRun: 0,
          leading: { nodes: [], width: shape.leadingEdge ?? 0 },
          trailing: { nodes: [], width: shape.trailingEdge ?? 0 },
        },
      ],
    ]),
  }
}

export const compileShape = (
  shape: BlockShape,
  options: {
    policy?: LayoutPolicy
    protrude?: boolean
    hyphenate?: boolean
    scaleFor?: (run: InlineRun) => StretchScale | null
    track?: number
  } = {},
) => {
  const block = blockOf(shape)
  const compiled = compileBlock({
    block,
    isCode: (run: InlineRun) => codeWrapper(run) !== undefined,
    edgesFor: (run: InlineRun) => runEdgeWidths(block, run),
    metricsFor: () => metrics,
    baseFont: metrics.font,
    atomWidth: () => 0,
    locale: "en-US",
    policy: options.policy ?? texDefaults,
    glue: defaultGlue,
    ...(options.protrude ? { protrude: true } : {}),
    ...(options.hyphenate ? { hyphenate: englishHyphenator } : {}),
    ...(options.scaleFor ? { scaleFor: options.scaleFor } : {}),
    ...(options.track ? { track: options.track } : {}),
  })
  if (!compiled.ok) throw new Error(`compileBlock declined: ${compiled.reason}`)
  return compiled
}

export const compile = (
  texts: readonly string[],
  trailingEdge = 0,
  policy: LayoutPolicy = texDefaults,
): Item[] => compileShape({ texts, trailingEdge }, { policy }).items
