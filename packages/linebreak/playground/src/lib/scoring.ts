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
  /**
   * Whether the row colours a winner. A setting an engine spends to buy quality
   * elsewhere is reported but not scored: counting it charges the engine twice
   * for one decision.
   */
  readonly ranked: boolean
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
    ranked: false,
    charted: true,
  },
  {
    key: "hyphens",
    label: "hyphenated",
    group: "lines",
    read: (m) => m.hyphens,
    format: count,
    direction: "lower",
    ranked: false,
    charted: true,
  },
  {
    key: "overfull",
    label: "overfull",
    group: "lines",
    read: (m) => m.overfull,
    format: count,
    direction: "lower",
    ranked: true,
    charted: false,
  },
  {
    key: "shortLast",
    label: "short last line",
    group: "lines",
    read: (m) => m.shortLast,
    format: count,
    direction: "lower",
    ranked: true,
    charted: false,
  },
  {
    key: "meanSpace",
    label: "mean space",
    group: "spacing",
    read: (m) => m.meanSpace,
    format: percent,
    direction: "near-one",
    ranked: true,
    charted: true,
  },
  {
    key: "deviation",
    label: "deviation",
    group: "spacing",
    read: (m) => m.deviation,
    format: percent,
    direction: "lower",
    ranked: true,
    charted: true,
  },
  {
    key: "sigma",
    label: "spread σ",
    group: "spacing",
    read: (m) => m.sigma,
    format: percent,
    direction: "lower",
    ranked: true,
    charted: true,
  },
  {
    key: "loosest",
    label: "loosest",
    group: "spacing",
    read: (m) => m.loosest,
    format: relative,
    direction: "near-one",
    ranked: true,
    charted: false,
  },
  {
    key: "tightest",
    label: "tightest",
    group: "spacing",
    read: (m) => m.tightest,
    format: relative,
    direction: "near-one",
    ranked: true,
    charted: false,
  },
  {
    key: "totalBadness",
    label: "total badness",
    group: "quality",
    read: (m) => m.totalBadness,
    format: badness,
    direction: "lower",
    ranked: true,
    charted: true,
  },
  {
    key: "worstBadness",
    label: "worst line",
    group: "quality",
    read: (m) => m.worstBadness,
    format: badness,
    direction: "lower",
    ranked: true,
    charted: false,
  },
]

export const CHARTED = METRICS.filter((metric) => metric.charted)

export const GROUP_TITLES = ["lines", "spacing", "quality"] as const

const scoreOf = (direction: Direction, value: number) =>
  direction === "lower" ? value : Math.abs(value - 1)

/**
 * The browser is the baseline both optimizers are trying to beat, not a third
 * competitor. Ranking it wins rows nobody was contesting: it never shrinks a
 * space below its natural width, so it takes any tightness row by declining to
 * do the work.
 */
const BASELINE: EngineId = "browser"

const RANKED_COLUMNS = ENGINES.flatMap((engine, index) =>
  engine === BASELINE ? [] : [index],
)

/**
 * Ranks one row's contested columns. An unranked metric, or one where the
 * optimizers tie, ranks every cell `mid`, so neither reads as a win.
 */
export const rankValues = (
  metric: Metric,
  values: readonly number[],
): Rank[] => {
  const ranks: Rank[] = values.map(() => "mid")
  if (!metric.ranked) return ranks

  const scores = RANKED_COLUMNS.map((column) =>
    scoreOf(metric.direction, values[column] as number),
  )
  const best = Math.min(...scores)
  if (best === Math.max(...scores)) return ranks

  for (const [index, column] of RANKED_COLUMNS.entries()) {
    ranks[column] = scores[index] === best ? "best" : "worst"
  }
  return ranks
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
    ranks: rankValues(metric, values),
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
 * Counts outright row wins per engine over the ranked rows only. Ties and
 * unranked rows count for nobody, so `wins` need not sum to `total`.
 */
export const verdictFor = (groups: readonly Group[]): Verdict => {
  const rows = groups
    .flatMap((group) => group.rows)
    .filter((row) => row.metric.ranked)
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
