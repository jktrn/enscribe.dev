import { budgetFlex, type Flex, flexBetween } from "./flex"
import { narrowestRatio, type StretchScale, widestRatio } from "../text/stretch"
import type { Line } from "./breaker"
import type { Item } from "./items"

export type LineFit = {
  readonly pct: number
  readonly gain: number
  readonly stretch: number
  readonly shrink: number
}

export const buildExpansion = (
  items: readonly Item[],
  scale: StretchScale,
  uncredited: ReadonlySet<number>,
): Flex =>
  budgetFlex(
    items,
    widestRatio(scale) - 1,
    1 - narrowestRatio(scale),
    uncredited,
  )

type Choice = { readonly pct: number; readonly gain: number }

const NEUTRAL: Choice = { pct: 100, gain: 0 }

const widen = (
  scale: StretchScale,
  pool: number,
  flex: number,
  slack: number,
): Choice => {
  const span = widestRatio(scale) - 1
  if (pool <= 0 || span <= 0) return NEUTRAL
  const want = Math.min(slack / flex, 1) * pool

  let chosen = NEUTRAL
  for (const step of scale.steps) {
    if (step.pct <= 100) continue
    const gain = pool * ((step.ratio - 1) / span)
    if (gain > want) break
    chosen = { pct: step.pct, gain }
  }
  return chosen
}

const narrow = (
  scale: StretchScale,
  pool: number,
  flex: number,
  excess: number,
): Choice => {
  const span = 1 - narrowestRatio(scale)
  if (pool <= 0 || span <= 0) return NEUTRAL
  const want = Math.min(excess / flex, 1) * pool

  let chosen = NEUTRAL
  for (const step of scale.steps) {
    if (step.pct >= 100) break
    const loss = pool * ((1 - step.ratio) / span)
    if (loss >= want) chosen = { pct: step.pct, gain: -loss }
  }
  return chosen
}

export const fitLines = (
  lines: readonly Line[],
  target: number,
  expansion: Flex,
  scale: StretchScale,
): LineFit[] =>
  lines.map((line) => {
    const pool = flexBetween(expansion, line.start, line.end)
    const slack = target - line.naturalWidth
    const choice =
      slack > 0
        ? widen(scale, pool.stretch, line.stretch, slack)
        : slack < 0
          ? narrow(scale, pool.shrink, line.shrink, -slack)
          : NEUTRAL
    return {
      ...choice,
      stretch: line.stretch - pool.stretch,
      shrink: line.shrink - pool.shrink,
    }
  })
