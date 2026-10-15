import { indentsSomeOtherLine } from "../dom/style"
import { fitLines } from "../layout/expansion"
import { trackLines } from "../layout/tracking"
import type { RenderedLayout, WrittenLines } from "../dom/render"
import { layoutSlack } from "../dom/render"
import {
  contentWidth,
  layoutMismatch,
  resolvedLineHeight,
  styleOf,
} from "../dom/geometry"
import { engineDefaults } from "../policy"
import type { FailureReason } from "../types"
import type { Draft, RenderJob } from "./state"

export const layoutFor = (draft: Draft, target: number): RenderedLayout => {
  const { expansion, tracking, under } = draft.measurement
  const fits = expansion
    ? fitLines(draft.lines, target, expansion.flex, expansion.scale)
    : null
  return {
    lines: draft.lines,
    target,
    breakRuns: draft.measurement.breakRuns,
    fits,
    letterfit: tracking
      ? {
          lines: trackLines(draft.lines, target, tracking, fits),
          inherited: under.letterSpacing,
        }
      : null,
  }
}

export const verifyLayout = (
  element: HTMLElement,
  written: WrittenLines,
  expectedWidth: number,
): FailureReason | null => {
  const style = styleOf(element)

  if (
    Math.abs(contentWidth(element, style) - expectedWidth) >
    engineDefaults.widthEpsilon
  ) {
    return "unstable-width"
  }
  if (!Number.isFinite(resolvedLineHeight(style))) {
    return "line-height-unresolved"
  }
  const { lines } = written.layout
  return layoutMismatch(element, lines.length, layoutSlack(written.layout))
    ? "layout-mismatch"
    : null
}

export const commonShift = (pending: readonly RenderJob[]): number => {
  const deltas: number[] = []
  for (const { composition, draft } of pending) {
    const observed = contentWidth(
      composition.element,
      styleOf(composition.element),
    )
    deltas.push(observed - draft.width)
  }
  if (deltas.length < 2) return 0
  deltas.sort((a, b) => a - b)
  const middle = deltas.length >> 1
  return deltas.length % 2
    ? (deltas[middle] as number)
    : ((deltas[middle - 1] as number) + (deltas[middle] as number)) / 2
}

export const unsupportedIn = (style: CSSStyleDeclaration) => {
  if (style.direction !== "ltr") return "unsupported-direction" as const
  const writingMode = style.writingMode
  if (writingMode && !writingMode.startsWith("horizontal")) {
    return "unsupported-writing-mode" as const
  }
  if (indentsSomeOtherLine(style)) return "unmeasurable" as const
  return null
}
