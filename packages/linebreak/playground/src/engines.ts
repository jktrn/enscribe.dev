import {
  createLinebreaker,
  type Linebreaker,
  type LinebreakerOptions,
  type Outcome,
  texDefaults,
} from "@enscribe/linebreak"
import { englishHyphenator } from "@enscribe/linebreak/hyphenation"
import { justify, type JustifyController, type JustifyOptions } from "justif"
import { hyphenateEnUS } from "justif/hyphenate/en-us"
import type { State } from "./state"

export const GLUE = { stretch: 0.5, shrink: 1 / 3 } as const
export const EXPANSION_BUDGET = 0.02
export const TRACKING_BUDGET = 0.03

export type ParagraphOutcome = {
  readonly index: number
  readonly status: string
  readonly reason: string
}

export const linebreakOptions = (state: State): LinebreakerOptions => ({
  hyphenate: state.hyphenate ? englishHyphenator : undefined,
  protrude: state.protrude,
  expand: state.expand,
  track: state.track,
  lastLineMinWidth: state.lastLineMinWidth,
  policy: texDefaults,
  glue: GLUE,
  minimumWidth: 160,
})

export const justifOptions = (state: State): JustifyOptions => ({
  hyphenate: state.hyphenate ? hyphenateEnUS : undefined,
  protrusion: state.protrude,
  hangingPunctuation: state.hang,
  expansion: state.expand
    ? { max: EXPANSION_BUDGET, shrink: EXPANSION_BUDGET, step: 0.005 }
    : false,
  tracking: state.track
    ? { max: TRACKING_BUDGET, shrink: TRACKING_BUDGET }
    : false,
  lastLineMinWidth: state.lastLineMinWidth,
  lastLineFit: 0,
  spacing: { ...GLUE, pull: 0, boundaryShrink: 1 },
  tolerance: texDefaults.tolerance,
  pretolerance: texDefaults.pretolerance,
  linePenalty: texDefaults.linePenalty,
  hyphenPenalty: texDefaults.hyphenPenalty,
  exHyphenPenalty: texDefaults.exHyphenPenalty,
  adjDemerits: texDefaults.adjDemerits,
  doubleHyphenDemerits: texDefaults.doubleHyphenDemerits,
  finalHyphenDemerits: texDefaults.finalHyphenDemerits,
  observeResize: false,
})

const outcomeReason = (outcome: Outcome) =>
  outcome.status === "typeset" ? "" : outcome.reason

let breaker: Linebreaker | null = null
let controller: JustifyController | null = null

export const runLinebreak = (
  paragraphs: readonly HTMLElement[],
  state: State,
): ParagraphOutcome[] => {
  breaker?.dispose()
  breaker = createLinebreaker(linebreakOptions(state))

  const reported: ParagraphOutcome[] = []
  for (const outcome of breaker.typeset(paragraphs)) {
    if (outcome.status === "typeset") continue
    reported.push({
      index: paragraphs.indexOf(outcome.element),
      status: outcome.status,
      reason: outcomeReason(outcome),
    })
  }
  return reported
}

export const runJustif = async (
  paragraphs: readonly HTMLElement[],
  state: State,
): Promise<ParagraphOutcome[]> => {
  controller?.destroy()

  const reported: ParagraphOutcome[] = []
  controller = justify(paragraphs, {
    ...justifOptions(state),
    onSkip: (paragraph, reason) => {
      reported.push({
        index: paragraphs.indexOf(paragraph),
        status: "declined",
        reason,
      })
    },
  })
  await controller.ready
  return reported
}

export const releaseEngines = () => {
  breaker?.dispose()
  breaker = null
  controller?.destroy()
  controller = null
}
