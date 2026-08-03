import { budgetFlex, type Flex, flexBetween } from "./flex"
import type { Line } from "./breaker"
import type { LineFit } from "./expansion"
import type { Item } from "./items"

export type LineTrack = {
  readonly gain: number
  readonly shrink: number
}

export const buildTracking = (
  items: readonly Item[],
  budget: number,
  unglyphed: ReadonlySet<number>,
): Flex => budgetFlex(items, budget, budget, unglyphed)

type Pool = { readonly stretch: number; readonly shrink: number }

const ragged = (line: Line) =>
  line.breakKind === "end" || line.breakKind === "forced"

const opening = (
  line: Line,
  slack: number,
  pool: Pool,
  fit: LineFit | undefined,
) => {
  if (ragged(line)) return 0
  const flex = fit ? fit.stretch : line.stretch
  return flex > 0 ? Math.min(slack / flex, 1) * pool.stretch : 0
}

const closing = (
  line: Line,
  excess: number,
  pool: Pool,
  fit: LineFit | undefined,
) => {
  const flex = fit ? fit.shrink : line.shrink
  return flex > 0 ? -Math.min(excess / flex, 1) * pool.shrink : 0
}

export const trackLines = (
  lines: readonly Line[],
  target: number,
  tracking: Flex,
  fits: readonly LineFit[] | null,
): LineTrack[] =>
  lines.map((line, index) => {
    const pool = flexBetween(tracking, line.start, line.end)
    const fit = fits?.[index]
    const slack = target - line.naturalWidth - (fit?.gain ?? 0)
    const gain =
      slack > 0
        ? opening(line, slack, pool, fit)
        : slack < 0
          ? closing(line, -slack, pool, fit)
          : 0
    return { gain, shrink: (fit ? fit.shrink : line.shrink) - pool.shrink }
  })
