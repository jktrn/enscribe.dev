import { EXPANSION_BUDGET, TRACKING_BUDGET } from "./engines"
import type { ColumnMetrics } from "./metrics"
import type { State } from "./state"

export type Triple = readonly [ColumnMetrics, ColumnMetrics, ColumnMetrics]

type Direction = "lower" | "near-one"

type Row = {
  readonly label: string
  readonly values: readonly number[]
  readonly format: (value: number) => string
  readonly direction: Direction
}

const percent = (value: number) => `${Math.round(value * 100)}%`

const relative = (value: number) =>
  `${value >= 1 ? "+" : "−"}${Math.round(Math.abs(value - 1) * 100)}%`

const count = (value: number) => String(Math.round(value))

const badness = (value: number) => Math.round(value).toLocaleString("en-US")

const rowsFor = (columns: Triple): { title: string; rows: Row[] }[] => {
  const pick = (read: (metrics: ColumnMetrics) => number) => columns.map(read)
  return [
    {
      title: "lines",
      rows: [
        {
          label: "count",
          values: pick((m) => m.lines),
          format: count,
          direction: "lower",
        },
        {
          label: "hyphenated breaks",
          values: pick((m) => m.hyphens),
          format: count,
          direction: "lower",
        },
        {
          label: "overfull lines",
          values: pick((m) => m.overfull),
          format: count,
          direction: "lower",
        },
        {
          label: "short last lines (< ⅓ measure)",
          values: pick((m) => m.shortLast),
          format: count,
          direction: "lower",
        },
      ],
    },
    {
      title: "spacing",
      rows: [
        {
          label: "mean space (100% = natural)",
          values: pick((m) => m.meanSpace),
          format: percent,
          direction: "near-one",
        },
        {
          label: "avg deviation from natural",
          values: pick((m) => m.deviation),
          format: percent,
          direction: "lower",
        },
        {
          label: "spread σ",
          values: pick((m) => m.sigma),
          format: percent,
          direction: "lower",
        },
        {
          label: "loosest space",
          values: pick((m) => m.loosest),
          format: relative,
          direction: "near-one",
        },
        {
          label: "tightest space",
          values: pick((m) => m.tightest),
          format: relative,
          direction: "near-one",
        },
      ],
    },
    {
      title: "quality",
      rows: [
        {
          label: "total badness",
          values: pick((m) => m.totalBadness),
          format: badness,
          direction: "lower",
        },
        {
          label: "worst-line badness",
          values: pick((m) => m.worstBadness),
          format: badness,
          direction: "lower",
        },
      ],
    },
  ]
}

const scoreOf = (row: Row, value: number) =>
  row.direction === "lower" ? value : Math.abs(value - 1)

const classesFor = (row: Row) => {
  const scores = row.values.map((value) => scoreOf(row, value))
  const best = Math.min(...scores)
  const worst = Math.max(...scores)
  if (best === worst) return scores.map(() => "")
  return scores.map((score) => {
    if (score === best) return "better"
    return score === worst ? "worse" : ""
  })
}

const renderRow = (row: Row) => {
  const cells = classesFor(row)
  const tr = document.createElement("tr")
  const head = document.createElement("td")
  head.textContent = row.label
  tr.append(head)
  for (const [index, value] of row.values.entries()) {
    const td = document.createElement("td")
    td.className = cells[index] ?? ""
    td.textContent = row.format(value)
    tr.append(td)
  }
  return tr
}

export const renderMetrics = (table: HTMLTableElement, columns: Triple) => {
  for (const body of [...table.tBodies]) body.remove()
  for (const group of rowsFor(columns)) {
    const body = document.createElement("tbody")
    body.className = "group"
    const header = document.createElement("tr")
    const cell = document.createElement("th")
    cell.colSpan = 4
    cell.textContent = group.title
    header.append(cell)
    body.append(header, ...group.rows.map(renderRow))
    table.append(body)
  }
}

const HANG_LABELS: Record<State["hang"], string> = {
  none: "none",
  "line-end-only": "line ends",
  "first-line-and-line-ends": "line ends + first line start",
  "all-line-edges": "all line edges",
}

const asymmetryItems = (state: State, widthResponse: number) => [
  `<b>Hanging punctuation.</b> justif is set to “${HANG_LABELS[state.hang]}”.
   linebreak has one model — microtype-style partial protrusion at both line
   edges, from a fixed table — and applies it whenever protrusion is on,
   whatever this control says. Nothing here changes linebreak's output.
   justif treats hanging as independent of protrusion, so it would keep
   hanging stops and quotes past the margin with protrusion off; this
   playground forces the mode to “none” there instead, so that switch means
   the same thing on both sides.`,
  `<b>Protrusion table.</b> justif rasterizes each font's glyphs and derives
   per-font optical values; linebreak ships microtype's fixed Latin
   punctuation table. Same feature, different source of truth.`,
  `<b>Font expansion.</b> Both spend a ±${EXPANSION_BUDGET * 100}% glyph
   budget on the wdth axis. justif quantizes to 0.5% steps; linebreak
   calibrates the face's real response in 1% steps, at most four per side,
   and stops once the budget is reached. The selected face moves
   ${(widthResponse * 100).toFixed(2)}% of its width per 2% of font-stretch.`,
  `<b>Emergency stretch.</b> Neither exposes it here. linebreak's automatic
   value is 14 × the mean glue width; justif's is 12 × the dominant space
   width, so the last-resort pass is not the same pass on both sides.`,
  `<b>Last-line colour.</b> justif's eTeX \\lastlinefit is pinned to 0 for
   this comparison; linebreak has no equivalent. Both get the same
   <code>lastLineMinWidth</code> = ${state.lastLineMinWidth}.`,
  `<b>Space elasticity.</b> Both are pinned to TeX's ½ stretch and ⅓ shrink
   of the space width, and justif's <code>pull</code> is set to 0 and
   <code>boundaryShrink</code> to 1 so its font-boundary spaces behave like
   linebreak's. Its shipped defaults are 0.7 and 0.`,
  `<b>Letterfit.</b> ${state.track ? "On" : "Off"} on both, on the same
   ±${TRACKING_BUDGET * 100}% budget.`,
  `<b>Browser column.</b> Native <code>text-align: justify</code>, with
   <code>hyphens: ${state.hyphenate ? "auto" : "none"}</code> and
   <code>hyphenate-limit-chars: 5 2 3</code> to match both engines'
   hyphenation minima. No other control reaches it.`,
]

export const renderAsymmetries = (
  list: HTMLElement,
  state: State,
  widthResponse: number,
) => {
  list.replaceChildren()
  for (const item of asymmetryItems(state, widthResponse)) {
    const li = document.createElement("li")
    li.innerHTML = item
    list.append(li)
  }
}
