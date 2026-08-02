import { narrowestRatio, type StretchScale, widestRatio } from "../text/stretch"
import type { Line } from "./breaker"
import type { Item } from "./items"

export type Expansion = {
  readonly stretch: Float64Array
  readonly shrink: Float64Array
}

export type LineFit = {
  readonly pct: number
  readonly gain: number
  readonly shrink: number
}

export const buildExpansion = (
  items: readonly Item[],
  scale: StretchScale,
  uncredited: ReadonlySet<number>,
): Expansion => {
  const count = items.length
  const up = widestRatio(scale) - 1
  const down = 1 - narrowestRatio(scale)
  const stretch = new Float64Array(count + 1)
  const shrink = new Float64Array(count + 1)

  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    const width = item.kind === "box" && !uncredited.has(index) ? item.width : 0
    stretch[index + 1] = (stretch[index] as number) + width * up
    shrink[index + 1] = (shrink[index] as number) + width * down
  }

  return { stretch, shrink }
}

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
  expansion: Expansion,
  scale: StretchScale,
): LineFit[] =>
  lines.map((line) => {
    const pool = {
      stretch:
        (expansion.stretch[line.end] as number) -
        (expansion.stretch[line.start] as number),
      shrink:
        (expansion.shrink[line.end] as number) -
        (expansion.shrink[line.start] as number),
    }
    const slack = target - line.naturalWidth
    const choice =
      slack > 0
        ? widen(scale, pool.stretch, line.stretch, slack)
        : slack < 0
          ? narrow(scale, pool.shrink, line.shrink, -slack)
          : NEUTRAL
    return { ...choice, shrink: line.shrink - pool.shrink }
  })
