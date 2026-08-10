import { METRICS, rankValues, type Triple } from "./scoring"
import { ENGINES, type EngineId, type State } from "./state"
import { effectiveState, type Surface, typesetSurface } from "./typeset"
import { yieldToUi } from "./schedule"

export const FLAGS = ["hyphenate", "protrude", "expand", "track"] as const

export type Flag = (typeof FLAGS)[number]

export type Config = {
  readonly measure: number
  readonly size: number
  readonly sample: string
  readonly flags: Readonly<Record<Flag, boolean>>
}

export type Run = {
  readonly config: Config
  readonly columns: Triple
}

export type Scale = "quick" | "standard" | "thorough"

export type Plan = {
  readonly measures: readonly number[]
  readonly sizes: readonly number[]
  readonly samples: readonly string[]
  readonly permuteFlags: boolean
}

export const planFor = (
  scale: Scale,
  state: State,
  allSamples: readonly string[],
): Plan => {
  if (scale === "quick") {
    return {
      measures: [300, 480, 720],
      sizes: [state.size],
      samples: [state.sample],
      permuteFlags: true,
    }
  }
  if (scale === "standard") {
    return {
      measures: [280, 400, 560, 760],
      sizes: [14, 17, 21],
      samples: [state.sample],
      permuteFlags: true,
    }
  }
  return {
    measures: [280, 400, 560, 760],
    sizes: [14, 17, 21],
    samples: allSamples,
    permuteFlags: true,
  }
}

const flagSets = (permute: boolean, state: State): Record<Flag, boolean>[] => {
  if (!permute) {
    return [
      {
        hyphenate: state.hyphenate,
        protrude: state.protrude,
        expand: state.expand,
        track: state.track,
      },
    ]
  }
  const sets: Record<Flag, boolean>[] = []
  for (let mask = 0; mask < 1 << FLAGS.length; mask += 1) {
    sets.push({
      hyphenate: (mask & 1) !== 0,
      protrude: (mask & 2) !== 0,
      expand: (mask & 4) !== 0,
      track: (mask & 8) !== 0,
    })
  }
  return sets
}

export const configsFor = (plan: Plan, state: State): Config[] => {
  const configs: Config[] = []
  for (const sample of plan.samples) {
    for (const size of plan.sizes) {
      for (const measure of plan.measures) {
        for (const flags of flagSets(plan.permuteFlags, state)) {
          configs.push({ measure, size, sample, flags })
        }
      }
    }
  }
  return configs
}

export type Tally = {
  readonly wins: readonly number[]
  readonly total: number
}

const tallyMetric = (
  runs: readonly Run[],
  metric: (typeof METRICS)[number],
) => {
  const wins = ENGINES.map(() => 0)
  for (const run of runs) {
    const ranks = rankValues(metric, run.columns.map(metric.read))
    for (const [index, rank] of ranks.entries()) {
      if (rank === "best") wins[index] = (wins[index] ?? 0) + 1
    }
  }
  return { wins, total: runs.length }
}

const tallyAll = (runs: readonly Run[]): Tally => {
  const wins = ENGINES.map(() => 0)
  const contested = METRICS.filter((metric) => metric.ranked)
  for (const metric of contested) {
    const one = tallyMetric(runs, metric)
    for (const [index, count] of one.wins.entries()) {
      wins[index] = (wins[index] ?? 0) + count
    }
  }
  return { wins, total: runs.length * contested.length }
}

export type Report = {
  readonly runs: number
  readonly overall: Tally
  readonly byMetric: { key: string; label: string; tally: Tally }[]
  readonly byFlag: { flag: Flag; on: Tally; off: Tally }[]
  readonly byMeasure: { measure: number; tally: Tally }[]
}

export const reportFor = (runs: readonly Run[]): Report => ({
  runs: runs.length,
  overall: tallyAll(runs),
  byMetric: METRICS.filter((metric) => metric.ranked).map((metric) => ({
    key: metric.key,
    label: metric.label,
    tally: tallyMetric(runs, metric),
  })),
  byFlag: FLAGS.map((flag) => ({
    flag,
    on: tallyAll(runs.filter((run) => run.config.flags[flag])),
    off: tallyAll(runs.filter((run) => !run.config.flags[flag])),
  })),
  byMeasure: [...new Set(runs.map((run) => run.config.measure))]
    .sort((a, b) => a - b)
    .map((measure) => ({
      measure,
      tally: tallyAll(runs.filter((run) => run.config.measure === measure)),
    })),
})

export const leaderOf = (tally: Tally): EngineId | null => {
  const top = Math.max(...tally.wins)
  const leaders = ENGINES.filter((_, index) => tally.wins[index] === top)
  return leaders.length === 1 ? (leaders[0] as EngineId) : null
}

export const runBenchmark = async (options: {
  readonly configs: readonly Config[]
  readonly state: State
  readonly host: HTMLElement
  readonly surface: Surface
  readonly signal: AbortSignal
  readonly onRun: (run: Run, done: number, total: number) => void
}) => {
  const { configs, state, host, surface, signal, onRun } = options
  const runs: Run[] = []

  host.style.setProperty("--indent", `${state.indent}em`)

  for (const [index, config] of configs.entries()) {
    if (signal.aborted) return runs

    const at: State = { ...state, ...config.flags, ...config }
    host.style.setProperty("--measure", `${config.measure}px`)
    host.style.setProperty("--size", `${config.size}px`)
    host.style.setProperty(
      "--column",
      `calc(${config.measure}px + 2 * var(--hang))`,
    )

    const { columns } = await typesetSurface(surface, effectiveState(at))
    if (signal.aborted) return runs

    const run: Run = { config, columns }
    runs.push(run)
    onRun(run, index + 1, configs.length)
    await yieldToUi()
  }

  return runs
}
