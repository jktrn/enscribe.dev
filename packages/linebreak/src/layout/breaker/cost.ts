import { INFINITE_BADNESS, type LayoutPolicy } from "../policy"
import type { ActiveNode, Edge, Measurement, Search } from "./types"
import {
  integerBadness,
  integerFitness,
  integerRejectionRatio,
} from "./integer"

export const INFINITE_BADNESS_RATIO = Math.cbrt(INFINITE_BADNESS / 100)

const fitnessClass = (ratio: number) => {
  if (ratio < -0.5) return 0
  if (ratio < 0.5) return 1
  if (ratio < 1) return 2
  return 3
}

const badness = (ratio: number) =>
  Math.min(INFINITE_BADNESS, 100 * Math.abs(ratio * ratio * ratio))

export const badnessOf = (search: Search, line: Measurement) =>
  search.policy.scoring === "integer"
    ? integerBadness(search, line)
    : badness(line.ratio)

export const fitnessOf = (search: Search, ratio: number, value: number) =>
  search.policy.scoring === "integer"
    ? integerFitness(ratio, value)
    : fitnessClass(ratio)

/** Exact integer cube thresholds reject distant candidates without evaluating a cube. */
export const rejectionRatio = (
  tolerance: number,
  scoring?: LayoutPolicy["scoring"],
) => {
  if (scoring === "integer") return integerRejectionRatio(tolerance)
  for (let ratio = 1; ratio < 5; ratio += 1) {
    if (tolerance <= 100 * (ratio * ratio * ratio)) return ratio
  }
  // Infinite adjustment cannot be rendered even when badness saturates.
  // MAX_VALUE retains every finite ratio without another candidate check.
  return tolerance < INFINITE_BADNESS ? 5 : Number.MAX_VALUE
}

const endingThreshold = (search: Search, edge: Edge) =>
  edge.final ? search.ending : 0

const endingBadness = (threshold: number, natural: number) => {
  if (!(threshold > 0)) return 0
  const shortfall = Math.max(0, threshold - natural) / threshold
  return 200 * (shortfall * shortfall * shortfall)
}

const lineDemerits = (
  lineBadness: number,
  penaltyCost: number,
  policy: LayoutPolicy,
  ending: number,
) => {
  const base = policy.linePenalty + lineBadness + ending
  const squared = Math.min(100_000_000, base ** 2)
  return squared + penaltyCost
}

const hyphenDemerits = (search: Search, edge: Edge) => {
  if (edge.flagged) return search.policy.doubleHyphenDemerits
  return edge.final ? search.policy.finalHyphenDemerits : 0
}

export const demeritsOf = (
  search: Search,
  from: ActiveNode,
  edge: Edge,
  measured: Measurement,
  lineBadness: number,
  fitness: number,
) => {
  const { natural } = measured
  let cost = lineDemerits(
    lineBadness,
    edge.penaltyCost,
    search.policy,
    endingBadness(endingThreshold(search, edge), natural),
  )
  if (from.boundary.flagged) cost += hyphenDemerits(search, edge)
  if (Math.abs(fitness - from.fitness) > 1) {
    cost += search.policy.adjDemerits
  }
  return from.demerits + cost
}

export const admittedBadness = (
  search: Search,
  edge: Edge,
  line: Measurement,
) => {
  if (line.ratio < -1 || line.ratio > search.rejectionRatio) return null
  const ending = endingThreshold(search, edge)
  if (search.endingStrict && ending > 0 && ending > line.natural) {
    return null
  }
  if (search.diagnostics) {
    search.diagnostics.evaluatedBadness =
      (search.diagnostics.evaluatedBadness as number) + 1
  }
  const value = badnessOf(search, line)
  return value <= search.tolerance ? value : null
}
