import { EXPANSION_BUDGET, TRACKING_BUDGET } from "./engines"
import type { HangMode, State } from "./state"

export type Segment = { readonly code: boolean; readonly text: string }

export type Asymmetry = {
  readonly title: string
  readonly body: readonly Segment[]
}

const HANG_LABELS: Record<HangMode, string> = {
  none: "none",
  "line-end-only": "line ends",
  "first-line-and-line-ends": "line ends + first line start",
  "all-line-edges": "all line edges",
}

const segments = (body: string): Segment[] =>
  body
    .split("`")
    .map((text, index) => ({ code: index % 2 === 1, text }))
    .filter((segment) => segment.text !== "")

const note = (title: string, body: string): Asymmetry => ({
  title,
  body: segments(body.replace(/\s+/g, " ").trim()),
})

export const asymmetriesFor = (
  state: State,
  widthResponse: number,
): Asymmetry[] => [
  note(
    "Hanging punctuation",
    `justif is set to “${HANG_LABELS[state.hang]}”. linebreak has one model —
     microtype-style partial protrusion at both line edges, from a fixed table —
     and applies it whenever protrusion is on, whatever this control says.
     Nothing here changes linebreak's output. justif treats hanging as
     independent of protrusion, so it would keep hanging stops and quotes past
     the margin with protrusion off; this playground forces the mode to “none”
     there instead, so that switch means the same thing on both sides.`,
  ),
  note(
    "Protrusion table",
    `justif rasterizes each font's glyphs and derives per-font optical values;
     linebreak ships microtype's fixed Latin punctuation table. Same feature,
     different source of truth.`,
  ),
  note(
    "Font expansion",
    `Both spend a ±${EXPANSION_BUDGET * 100}% glyph budget on the wdth axis.
     justif quantizes to 0.5% steps; linebreak calibrates the face's real
     response in 1% steps, at most four per side, and stops once the budget is
     reached. The selected face moves ${(widthResponse * 100).toFixed(2)}% of
     its width per 2% of font-stretch.`,
  ),
  note(
    "Emergency stretch",
    `Neither exposes it here. linebreak's automatic value is 14 × the mean glue
     width; justif's is 12 × the dominant space width, so the last-resort pass
     is not the same pass on both sides.`,
  ),
  note(
    "Last-line colour",
    `justif's eTeX \\lastlinefit is pinned to 0 for this comparison; linebreak
     has no equivalent. Both get the same \`lastLineMinWidth\` =
     ${state.lastLineMinWidth}.`,
  ),
  note(
    "Space elasticity",
    `Both are pinned to TeX's ½ stretch and ⅓ shrink of the space width, and
     justif's \`pull\` is set to 0 and \`boundaryShrink\` to 1 so its
     font-boundary spaces behave like linebreak's. Its shipped defaults are 0.7
     and 0.`,
  ),
  note(
    "Letterfit",
    `${state.track ? "On" : "Off"} on both, on the same
     ±${TRACKING_BUDGET * 100}% budget.`,
  ),
  note(
    "Browser column",
    `Native \`text-align: justify\`, with
     \`hyphens: ${state.hyphenate ? "auto" : "none"}\` and
     \`hyphenate-limit-chars: 5 2 3\` to match both engines' hyphenation
     minima. No other control reaches it.`,
  ),
]
