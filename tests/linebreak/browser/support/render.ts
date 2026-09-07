import { expect } from "vitest"
import type { Line } from "@linebreak/layout/breaker"
import type { LineFit } from "@linebreak/layout/expansion"
import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import {
  type RenderedLayout,
  renderLines,
  tightenOverset,
} from "@linebreak/dom/render"

export const TEXT = "alpha beta gamma delta epsilon zeta eta theta"

const blockFor = (text: string): ExtractedBlock => {
  const run: InlineRun = {
    kind: "text",
    text,
    start: 0,
    end: text.length,
    wrappers: [],
    sourceElement: document.createElement("span"),
    hyphenates: false,
  }
  return { text, runs: [run], breakRestrictions: [], wrappers: new Map() }
}

const BLOCK = blockFor(TEXT)

export const lineOf = (overrides: Partial<Line> = {}): Line => ({
  start: 0,
  end: 8,
  sourceStart: 0,
  sourceEnd: TEXT.length,
  naturalWidth: 300,
  spaceCount: 7,
  stretch: 20,
  shrink: 12,
  adjustmentRatio: 0,
  breakKind: "end",
  hangStart: 0,
  hangEnd: 0,
  ...overrides,
})

const renderIn = (
  block: ExtractedBlock,
  line: Line,
  target: number,
  fits: readonly LineFit[] | null,
  letterfit: RenderedLayout["letterfit"],
) => {
  const host = document.createElement("p")
  const rendered = renderLines(
    host,
    block,
    { lines: [line], target, fits, letterfit },
    [],
  )
  const span = rendered?.[0]
  if (!span) throw new Error("renderLines declined")
  const measured = { width: 0, calls: 0 }
  span.getBoundingClientRect = () => {
    measured.calls += 1
    return new DOMRect(0, 0, measured.width, 20)
  }
  return Object.assign(span, { measured })
}

export const render = (
  line: Line,
  target: number,
  fits: readonly LineFit[] | null,
  letterfit: RenderedLayout["letterfit"] = null,
) => renderIn(BLOCK, line, target, fits, letterfit)

export const renderText = (
  text: string,
  target: number,
  letterfit: RenderedLayout["letterfit"],
) =>
  renderIn(
    blockFor(text),
    lineOf({
      sourceEnd: text.length,
      breakKind: "space",
      spaceCount: (text.trim().match(/ /g) ?? []).length,
    }),
    target,
    null,
    letterfit,
  )

export const settle = (
  line: Line,
  target: number,
  fits: readonly LineFit[] | null,
  realized: number,
  letterfit: RenderedLayout["letterfit"] = null,
) => {
  const span = renderIn(BLOCK, line, target, fits, letterfit)
  span.measured.width = realized
  const tightened = tightenOverset([
    {
      elements: [span],
      layout: { lines: [line], target, fits, letterfit },
    },
  ])
  return { span, tightened }
}

// CSSOM serializes lengths to six decimal places.
export const expectPx = (actual: string, expected: number) => {
  expect(actual.endsWith("px")).toBe(true)
  expect(Number.parseFloat(actual)).toBeCloseTo(expected, 5)
}
