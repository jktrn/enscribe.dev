import { quantile } from "./statistics"
import { randomSource } from "./random"
import type { ProcessCase, SolverEngine } from "./solver-process-cases"

export type ProcessObservation = {
  case: number; repeat: number; position: number
  config: ProcessCase; recorded: { elapsedMs: number; nsPerOp: number }
}
const median = (values: number[]) => quantile(values, .5)
const geometricMean = (values: number[]) => values.length ?
  Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length) : null
const legal = (score: ProcessCase["score"]) => score.terminal && !score.invalidBreaks &&
  !score.crossedForcedBreaks && !score.nonfiniteLines

const interval = (ours: number[], reference: number[], seed: number) => {
  const random = randomSource(seed), estimates: number[] = []
  for (let sample = 0; sample < 5000; sample++) {
    const indices = ours.map(() => Math.floor(random() * ours.length))
    estimates.push(median(indices.map(index => reference[index]!)) / median(indices.map(index => ours[index]!)))
  }
  return { lower: quantile(estimates, .025), upper: quantile(estimates, .975) }
}

export const processReport = (cases: ProcessCase[][], observations: ProcessObservation[], repeats: number) => {
  const rows = [], incomplete: number[] = []
  for (const configs of cases) {
    const descriptor = configs[0]!, id = descriptor.case
    const times = (engine: SolverEngine) => observations.filter(row => row.case === id && row.config.engine === engine)
      .sort((a, b) => a.repeat - b.repeat).map(row => row.recorded.nsPerOp)
    const reference = configs.find(config => config.engine === "justif")!, referenceTimes = times("justif")
    if (configs.some(config => times(config.engine).length !== repeats)) { incomplete.push(id); continue }
    for (const mode of ["continuous", "integer"] as const) {
      const own = configs.find(config => config.engine === mode)!, ownTimes = times(mode)
      const cost = mode === "continuous" ? "demerits" : "integerDemerits"
      const infeasible = mode === "continuous" ? "infeasibleLines" : "integerInfeasibleLines"
      const rankable = legal(own.score) && legal(reference.score) && !own.score[infeasible] && !reference.score[infeasible]
      const qualityLoss = own.score[cost] > reference.score[cost] + Math.max(1e-8, 1e-10 * Math.abs(reference.score[cost]))
      rows.push({ case: id, corpus: own.corpus, words: own.words, width: own.width, lane: own.lane, mode,
        rankable, qualityLoss, oursScore: own.score, justifScore: reference.score,
        speedup: median(referenceTimes) / median(ownTimes), oursNs: median(ownTimes), justifNs: median(referenceTimes),
        ...(repeats >= 6 ? interval(ownTimes, referenceTimes, 20260914 + id) : {}),
        observations: { ours: ownTimes, justif: referenceTimes } })
    }
  }
  const groups = []
  for (const lane of [...new Set(rows.map(row => row.lane))]) for (const mode of ["continuous", "integer"] as const) {
    const all = rows.filter(row => row.lane === lane && row.mode === mode), valid = all.filter(row => row.rankable)
    groups.push({ lane, mode, cases: all.length, rankable: valid.length,
      geomean: geometricMean(valid.map(row => row.speedup)), minimum: valid.length ? Math.min(...valid.map(row => row.speedup)) : null,
      pointWins: valid.filter(row => row.speedup > 1).length,
      intervalWins: valid.filter(row => row.lower !== undefined && row.lower > 1).length,
      qualityLosses: valid.filter(row => row.qualityLoss).map(row => row.case) })
  }
  return { groups, rows, incomplete, minimumBatchMs: observations.length ? Math.min(...observations.map(row => row.recorded.elapsedMs)) : null }
}
