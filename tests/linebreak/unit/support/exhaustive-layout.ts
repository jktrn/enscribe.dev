import type { Item } from "@linebreak/layout/items"
import type { PassOptions } from "@linebreak/layout/breaker"

// Deliberately no production helpers: this oracle enumerates every complete
// path and measures its items directly, without prefix sums or active pruning.
type Route = {
  breaks: number[]
  cost: number
  fitness: number
  flagged: boolean
}
type Problem = { items: readonly Item[]; width: number; options: PassOptions }
type Metrics = {
  natural: number
  stretch: number
  shrink: number
  start: number
  empty: boolean
}

const penaltyAt = (items: readonly Item[], at: number) => {
  const item = items[at] as Item
  if (item.kind === "box") return null
  if (item.kind !== "glue") return item.penalty < 10000 ? item.penalty : null
  const previous = items[at - 1]
  return previous?.kind === "box" || previous?.kind === "discretionary"
    ? 0
    : null
}

const startAfter = (items: readonly Item[], previous: number) => {
  const item = items[previous]
  let at = previous + 1
  if (item?.kind === "discretionary" && item.postWidth !== 0) return at
  while (at < items.length) {
    const next = items[at] as Item
    if (next.kind === "box" || next.kind === "discretionary") break
    if (next.kind === "penalty" && next.penalty <= -10000) break
    at += 1
  }
  return at
}

const measure = (problem: Problem, previous: number, end: number): Metrics => {
  const { items, options } = problem
  const start = Math.min(startAfter(items, previous), end)
  const before = items[previous]
  const after = items[end] as Item
  let natural =
    before?.kind === "discretionary"
      ? before.postWidth
      : before?.kind === "penalty"
        ? (before.continuationWidth ?? 0)
        : 0
  const indent = previous === -1 ? (options.indent ?? 0) : 0
  const endingWidth =
    after.kind === "discretionary"
      ? after.preWidth
      : after.kind === "penalty"
        ? after.width
        : 0
  if (start === end && natural === 0 && indent === 0 && endingWidth === 0)
    return { natural: 0, stretch: 0, shrink: 0, start, empty: true }
  natural += indent
  let stretch = 0
  let shrink = 0
  for (let at = start; at < end; at += 1) {
    const item = items[at] as Item
    if (item.kind === "box" || item.kind === "glue") natural += item.width
    if (item.kind === "discretionary") natural += item.noBreakWidth
    if (item.kind === "glue") {
      stretch += item.stretch
      shrink += item.shrink
    }
    if (options.flex) {
      stretch += options.flex.stretch[at + 1]! - options.flex.stretch[at]!
      shrink += options.flex.shrink[at + 1]! - options.flex.shrink[at]!
    }
  }
  if (after.kind === "penalty") natural += after.width
  if (after.kind === "discretionary") natural += after.preWidth
  natural -= options.hangs?.start[previous + 1] ?? 0
  natural -= options.hangs?.end[end] ?? 0
  return { natural, stretch, shrink, start, empty: false }
}

const adjustment = (problem: Problem, metrics: Metrics) => {
  const { natural, stretch, shrink } = metrics
  if (metrics.empty) return 0
  const slack = problem.width - natural
  if (slack === 0) return 0
  if (slack < 0) return shrink > 0 ? slack / shrink : -Infinity
  const available = stretch + (problem.options.emergencyStretch ?? 0)
  return available > 0 ? slack / available : Math.cbrt(100)
}

const fitness = (ratio: number, badness: number, integer: boolean) => {
  if (integer) return badness <= 12 ? 1 : ratio < 0 ? 0 : badness < 100 ? 2 : 3
  return ratio < -0.5 ? 0 : ratio < 0.5 ? 1 : ratio < 1 ? 2 : 3
}

const lineBadness = (problem: Problem, measured: Metrics, ratio: number) => {
  if (problem.options.policy?.scoring !== "integer")
    return Math.min(10000, 100 * Math.abs(ratio * ratio * ratio))
  const difference = problem.width - measured.natural
  const available =
    difference < 0
      ? measured.shrink
      : measured.stretch + (problem.options.emergencyStretch ?? 0)
  const quantum =
    ratio === 0
      ? 0
      : available > 0
        ? Math.floor((297 * Math.abs(difference)) / available)
        : 1291
  return quantum > 1290 ? 10000 : Math.floor((quantum ** 3 + 2 ** 17) / 2 ** 18)
}

const lineCost = (
  problem: Problem,
  lineBadness: number,
  natural: number,
  end: number,
  penalty: number,
) => {
  const policy = problem.options.policy
  let badness = lineBadness
  const floor =
    end === problem.items.length - 1
      ? problem.width * (problem.options.lastLineMinWidth ?? 0)
      : 0
  if (floor > 0 && floor > natural)
    badness += 200 * ((floor - natural) / floor) ** 3
  const base = (policy?.linePenalty ?? 10) + badness
  let cost = Math.abs(base) >= 10000 ? 100000000 : base * base
  if (penalty > 0) cost += penalty * penalty
  if (penalty < 0 && penalty > -10000) cost -= penalty * penalty
  return cost
}

const advance = (
  problem: Problem,
  route: Route,
  end: number,
  penalty: number,
): Route | null => {
  const previous = route.breaks.at(-1) ?? -1
  const measured = measure(problem, previous, end)
  if (
    ![measured.natural, measured.stretch, measured.shrink].every(
      Number.isFinite,
    )
  )
    return null
  const start = startAfter(problem.items, previous)
  if (penalty > -10000 && (start > end || (start === end && measured.empty)))
    return null
  const ratio = adjustment(problem, measured)
  if (!Number.isFinite(ratio)) return null
  const { options, items } = problem
  const badness = lineBadness(problem, measured, ratio)
  if (ratio < -1 || options.tolerance < 0 || badness > options.tolerance)
    return null
  const floor = problem.width * (options.lastLineMinWidth ?? 0)
  if (
    options.strictEnding &&
    end === items.length - 1 &&
    floor > 0 &&
    measured.natural < floor
  )
    return null
  const item = items[end] as Item
  const flagged =
    item.kind === "discretionary"
      ? item.hyphen
      : item.kind === "penalty" && item.flagged
  let cost = lineCost(problem, badness, measured.natural, end, penalty)
  if (route.flagged && flagged)
    cost += options.policy?.doubleHyphenDemerits ?? 10000
  if (route.flagged && !flagged && end === items.length - 1)
    cost += options.policy?.finalHyphenDemerits ?? 5000
  const nextFitness = fitness(
    ratio,
    badness,
    options.policy?.scoring === "integer",
  )
  if (Math.abs(nextFitness - route.fitness) > 1)
    cost += options.policy?.adjDemerits ?? 10000
  cost += route.cost
  if (!Number.isFinite(cost)) return null
  return { breaks: [...route.breaks, end], cost, fitness: nextFitness, flagged }
}

export const exhaustiveLayout = (problem: Problem): Route | null => {
  const visit = (route: Route): Route | null => {
    const previous = route.breaks.at(-1) ?? -1
    if (previous === problem.items.length - 1) return route
    let best: Route | null = null
    for (let end = previous + 1; end < problem.items.length; end += 1) {
      const penalty = penaltyAt(problem.items, end)
      if (penalty === null) continue
      const next = advance(problem, route, end, penalty)
      const result = next ? visit(next) : null
      if (result && (!best || result.cost < best.cost)) best = result
      if (penalty <= -10000) break
    }
    return best
  }
  return visit({ breaks: [], cost: 0, fitness: 1, flagged: false })
}
