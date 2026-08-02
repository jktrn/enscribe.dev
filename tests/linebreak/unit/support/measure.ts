import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import type { Item } from "@linebreak/layout/items"
import {
  defaultGlue,
  type LayoutPolicy,
  texDefaults,
} from "@linebreak/layout/policy"
import type { FontMetrics, MeasuredSegment } from "@linebreak/text/measure"

export const CHARACTER = 10
export const HYPHEN = 5
export const SHY = "­"

const segmentsOf = (text: string): MeasuredSegment[] => {
  const segments: MeasuredSegment[] = []
  let pending = ""

  const flush = (at: number) => {
    if (pending.length === 0) return
    segments.push({
      text: pending,
      start: at - pending.length,
      end: at,
      kind: "text",
      width: pending.length * CHARACTER,
      lineEndWidth: 0,
    })
    pending = ""
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] as string
    if (character !== " " && character !== SHY) {
      pending += character
      continue
    }
    flush(index)
    segments.push({
      text: character,
      start: index,
      end: index + 1,
      kind: character === " " ? "space" : "soft-hyphen",
      width: character === " " ? CHARACTER : 0,
      lineEndWidth: character === " " ? 0 : HYPHEN,
    })
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

const element = () => ({}) as HTMLElement

export const blockOf = (
  texts: readonly string[],
  trailingEdge: number,
): ExtractedBlock => {
  const wrapper = element()
  const runs: InlineRun[] = []
  let offset = 0
  for (const [index, text] of texts.entries()) {
    runs.push({
      kind: "text",
      text,
      start: offset,
      end: offset + text.length,
      wrappers: index === 0 ? [wrapper] : [],
      sourceElement: element(),
      hyphenates: false,
    })
    offset += text.length
  }

  const first = runs[0] as InlineRun
  return {
    text: texts.join(""),
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
          leading: { nodes: [], width: 0 },
          trailing: { nodes: [], width: trailingEdge },
        },
      ],
    ]),
  }
}

export const compile = (
  texts: readonly string[],
  trailingEdge = 0,
  policy: LayoutPolicy = texDefaults,
): Item[] => {
  const compiled = compileBlock({
    block: blockOf(texts, trailingEdge),
    metricsFor: () => metrics,
    atomWidth: () => 0,
    locale: "en-US",
    policy,
    glue: defaultGlue,
  })
  if (!compiled.ok) throw new Error(`compileBlock declined: ${compiled.reason}`)
  return compiled.items
}
