import { box, discretionary, glue, paragraphEnd, type Item } from "../src/layout/items"
import { withSums } from "./vendor/justif/src/core/items"
import { ItemType, type Item as JustifItem, type RunMetrics } from "./vendor/justif/src/core/types"
import { randomSource } from "./random"

const RUN: RunMetrics = {
  fontKey: "deterministic-boxes", space: { width: 5, stretch: 2.5, shrink: 5 / 3 },
  hyphenWidth: 4, ratioAtMax: 1, ratioAtMin: 1,
}

const justifBox = (width: number): JustifItem => ({
  type: ItemType.Box, width, run: 0, text: "x", lp: 0, lpFirst: 0, rp: 0,
  expStretch: 0, expShrink: 0, trackStretch: 0, trackShrink: 0,
  hangStretch: 0, hangShrink: 0,
})

export type SolverCorpus = "original" | "elastic" | "forced" | "discretionary"

const justifItem = (item: Item): JustifItem => {
  if (item.kind === "box") return justifBox(item.width)
  if (item.kind === "glue") return { type: ItemType.Glue, width: item.width, stretch: item.stretch, stretchFil: 0, shrink: item.shrink, run: 0 }
  const disc = item.kind === "discretionary"
  return { type: ItemType.Penalty, width: disc ? item.preWidth : item.width, penalty: item.penalty, flagged: disc ? item.hyphen : item.flagged, hyphen: disc && item.hyphen, rp: 0, run: 0 }
}

/** Original hard corpus stays fixed. Added corpora preregister broader glue and explicit breaks. */
export const solverItems = (words: number, seed = 20260904, corpus: SolverCorpus = "original") => {
  const random = randomSource(seed)
  const linebreak: Item[] = []
  for (let index = 0; index < words; index += 1) {
    const width = 10 + Math.floor(random() * (corpus === "original" ? 70 : 40))
    if (corpus === "discretionary" && index % 5 === 0) {
      linebreak.push(box(width * 0.6), discretionary({ preWidth: 4, penalty: 50, hyphen: true, breakOffset: 0 }), box(width * 0.4))
    } else linebreak.push(box(width))
    if (index === words - 1) continue
    if (corpus === "forced" && index % 17 === 16) linebreak.push(...paragraphEnd())
    else linebreak.push(glue(5, corpus === "original" ? 2.5 : 10, 5 / 3))
  }
  linebreak.push(...paragraphEnd())
  const justif = linebreak.map(justifItem)
  return { linebreak, justif, runs: [RUN] }
}

export const solverFixture = (words: number, seed = 20260904, corpus: SolverCorpus = "original") => {
  const { linebreak, justif, runs } = solverItems(words, seed, corpus)
  return { linebreak, justif, prepared: withSums(justif, runs), prepare: () => withSums(justif, runs) }
}

/** Recalculate the shared TeX objective from primitive widths, independent of solver scores. */
export const scoreBreaks = (items: readonly Item[], breaks: readonly number[], width: number, tolerance = 200) => {
  let start = 0
  let previousFitness = 1
  let previousIntegerFitness = 1
  let demerits = 0
  let integerDemerits = 0
  let infeasibleLines = 0
  let integerInfeasibleLines = 0
  let previousFlagged = false
  let crossedForcedBreaks = 0
  let invalidBreaks = 0
  let nonfiniteLines = 0
  for (const end of breaks) {
    const endpoint = items[end]
    const legal = endpoint?.kind === "glue" ? items[end - 1]?.kind === "box" :
      (endpoint?.kind === "penalty" || endpoint?.kind === "discretionary") && endpoint.penalty < 10000
    if (!Number.isInteger(end) || end < start || !legal) {
      invalidBreaks += 1
      continue
    }
    let natural = 0
    let stretch = 0
    let shrink = 0
    for (let index = start; index < end; index += 1) {
      const item = items[index]
      if (item?.kind === "box") natural += item.width
      if (item?.kind === "discretionary") natural += item.noBreakWidth
      if (item?.kind === "penalty" && item.penalty <= -10000) crossedForcedBreaks += 1
      if (item?.kind !== "glue") continue
      natural += item.width
      stretch += item.stretch
      shrink += item.shrink
    }
    const edge = items[end]
    const penalty = edge?.kind === "penalty" || edge?.kind === "discretionary" ? edge.penalty : 0
    const flagged = edge?.kind === "penalty" ? edge.flagged : edge?.kind === "discretionary" && edge.hyphen
    if (edge?.kind === "penalty") natural += edge.width
    if (edge?.kind === "discretionary") natural += edge.preWidth
    if (![width, natural, stretch, shrink, penalty].every(Number.isFinite)) {
      nonfiniteLines += 1
      start = end + 1
      continue
    }
    const slack = width - natural
    const capacity = slack >= 0 ? stretch : shrink
    const ratio = slack === 0 ? 0 : capacity > 0 ? slack / capacity : Math.sign(slack) * Infinity
    const badness = Math.min(10000, 100 * Math.abs(ratio) ** 3)
    const integerRatio = slack === 0 ? 0 : capacity > 0 ? Math.floor((297 * Math.abs(slack)) / capacity) : Infinity
    const integerBadness = integerRatio > 1290 ? 10000 : Math.floor((integerRatio ** 3 + 131072) / 262144)
    if (ratio < -1 || badness > tolerance) infeasibleLines += 1
    if (ratio < -1 || integerBadness > tolerance) integerInfeasibleLines += 1
    const fitness = ratio < -0.5 ? 0 : ratio < 0.5 ? 1 : ratio < 1 ? 2 : 3
    const integerFitness = integerBadness <= 12 ? 1 : ratio < 0 ? 0 : integerBadness < 100 ? 2 : 3
    let shared = 0
    if (penalty > 0) shared += penalty ** 2
    else if (penalty > -10000) shared -= penalty ** 2
    if (previousFlagged && flagged) shared += 10000
    if (previousFlagged && end === items.length - 1) shared += 5000
    demerits += Math.min(100_000_000, (10 + badness) ** 2) + shared
    integerDemerits += Math.min(100_000_000, (10 + integerBadness) ** 2) + shared
    if (Math.abs(fitness - previousFitness) > 1) demerits += 10000
    if (Math.abs(integerFitness - previousIntegerFitness) > 1) integerDemerits += 10000
    previousFitness = fitness
    previousIntegerFitness = integerFitness
    previousFlagged = flagged
    start = end + 1
  }
  return { demerits, integerDemerits, infeasibleLines, integerInfeasibleLines, crossedForcedBreaks, invalidBreaks, nonfiniteLines, terminal: breaks.at(-1) === items.length - 1 }
}
