import type { ColumnMetrics } from "./metrics"
import { ENGINES, type EngineId } from "./state"

export type Triple = readonly [ColumnMetrics, ColumnMetrics, ColumnMetrics]

/** Whether a smaller number is better, or one closer to natural (1.0). */
export type Direction = "lower" | "near-one"

export type Rank = "best" | "worst" | "mid"

export type Metric = {
  readonly key: string
  readonly label: string
  readonly group: "lines" | "spacing" | "quality"
  readonly read: (metrics: ColumnMetrics) => number
  readonly format: (value: number) => string
  readonly direction: Direction
  /** Included in the sweep dialog's six small multiples. */
  readonly charted: boolean
}

const percent = (value: number) => `${Math.round(value * 100)}%`

const relative = (value: number) =>
  `${value >= 1 ? "+" : "−"}${Math.round(Math.abs(value - 1) * 100)}%`

const count = (value: number) => String(Math.round(value))

const badness = (value: number) => Math.round(value).toLocaleString("en-US")

export const METRICS: readonly Metric[] = [
  {
    key: "lines",
    label: "lines",
    group: "lines",
    read: (m) => m.lines,
    format: count,
    direction: "lower",
    charted: true,
  },
  {
    key: "hyphens",
    label: "hyphenated",
    group: "lines",
    read: (m) => m.hyphens,
    format: count,
    direction: "lower",
    charted: true,
  },
  {
    key: "overfull",
    label: "overfull",
    group: "lines",
    read: (m) => m.overfull,
    format: count,
    direction: "lower",
    charted: false,
  },
  {
    key: "shortLast",
    label: "short last line",
    group: "lines",
    read: (m) => m.shortLast,
    format: count,
    direction: "lower",
    charted: false,
  },
  {
    key: "meanSpace",
    label: "mean space",
    group: "spacing",
    read: (m) => m.meanSpace,
    format: percent,
    direction: "near-one",
    charted: true,
  },
  {
    key: "deviation",
    label: "deviation",
    group: "spacing",
    read: (m) => m.deviation,
    format: percent,
    direction: "lower",
    charted: true,
  },
  {
    key: "sigma",
    label: "spread σ",
    group: "spacing",
    read: (m) => m.sigma,
    format: percent,
    direction: "lower",
    charted: true,
  },
  {
    key: "loosest",
    label: "loosest",
    group: "spacing",
    read: (m) => m.loosest,
    format: relative,
    direction: "near-one",
    charted: false,
  },
  {
    key: "tightest",
    label: "tightest",
    group: "spacing",
    read: (m) => m.tightest,
    format: relative,
    direction: "near-one",
    charted: false,
  },
  {
    key: "totalBadness",
    label: "total badness",
    group: "quality",
    read: (m) => m.totalBadness,
    format: badness,
    direction: "lower",
    charted: true,
  },
  {
    key: "worstBadness",
    label: "worst line",
    group: "quality",
    read: (m) => m.worstBadness,
    format: badness,
    direction: "lower",
    charted: false,
  },
]

export const CHARTED = METRICS.filter((metric) => metric.charted)

export const GROUP_TITLES = ["lines", "spacing", "quality"] as const

const scoreOf = (direction: Direction, value: number) =>
  direction === "lower" ? value : Math.abs(value - 1)

/**
 * Ranks one row's values. A row where every engine ties ranks every cell
 * `mid`, so a tie never reads as a win.
 */
export const rankValues = (
  direction: Direction,
  values: readonly number[],
): Rank[] => {
  const scores = values.map((value) => scoreOf(direction, value))
  const best = Math.min(...scores)
  const worst = Math.max(...scores)
  if (best === worst) return scores.map(() => "mid")
  return scores.map((score) => {
    if (score === best) return "best"
    return score === worst ? "worst" : "mid"
  })
}

export type Row = {
  readonly metric: Metric
  readonly values: readonly number[]
  readonly formatted: readonly string[]
  readonly ranks: readonly Rank[]
}

export type Group = {
  readonly title: string
  readonly rows: readonly Row[]
}

export const rowFor = (metric: Metric, columns: Triple): Row => {
  const values = columns.map(metric.read)
  return {
    metric,
    values,
    formatted: values.map(metric.format),
    ranks: rankValues(metric.direction, values),
  }
}

export const groupsFor = (columns: Triple): Group[] =>
  GROUP_TITLES.map((title) => ({
    title,
    rows: METRICS.filter((metric) => metric.group === title).map((metric) =>
      rowFor(metric, columns),
    ),
  }))

export type Verdict = {
  readonly wins: readonly { engine: EngineId; count: number }[]
  readonly leader: EngineId | null
  readonly total: number
}

/**
 * Counts outright row wins per engine. Rows where every engine ties count for
 * nobody, so `wins` need not sum to `total`.
 */
export const verdictFor = (groups: readonly Group[]): Verdict => {
  const rows = groups.flatMap((group) => group.rows)
  const wins = ENGINES.map((engine, index) => ({
    engine,
    count: rows.filter((row) => row.ranks[index] === "best").length,
  }))
  const top = Math.max(...wins.map((win) => win.count))
  const leaders = wins.filter((win) => win.count === top)
  return {
    wins,
    leader: leaders.length === 1 ? (leaders[0]?.engine ?? null) : null,
    total: rows.length,
  }
}
