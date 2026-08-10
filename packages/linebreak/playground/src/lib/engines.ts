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

const spaceWidthOf = (paragraph: HTMLElement | undefined) => {
  if (paragraph === undefined) return 0
  const style = getComputedStyle(paragraph)
  const probe = document.createElement("span")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText =
    "position:absolute;left:-100000px;top:0;visibility:hidden;" +
    "pointer-events:none;white-space:pre;contain:layout style paint"
  probe.style.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  probe.style.letterSpacing = style.letterSpacing
  probe.textContent = "x x"
  document.body.append(probe)

  const range = document.createRange()
  const node = probe.firstChild as Text
  range.setStart(node, 1)
  range.setEnd(node, 2)
  const width = range.getBoundingClientRect().width
  probe.remove()
  return width
}

export const linebreakOptions = (
  state: State,
  spaceWidth: number,
): LinebreakerOptions => ({
  hyphenate: state.hyphenate ? englishHyphenator : undefined,
  protrude: state.protrude,
  expand: state.expand,
  track: state.track,
  lastLineMinWidth: state.lastLineMinWidth,
  emergencyStretch: state.emergencyStretch * spaceWidth,
  policy: texDefaults,
  glue: GLUE,
  minimumWidth: 160,
})

export const justifOptions = (
  state: State,
  spaceWidth: number,
): JustifyOptions => ({
  hyphenate: state.hyphenate ? hyphenateEnUS : undefined,
  protrusion: state.protrude,
  hangingPunctuation: state.protrude ? state.hang : "none",
  expansion: state.expand
    ? { max: EXPANSION_BUDGET, shrink: EXPANSION_BUDGET, step: 0.005 }
    : false,
  tracking: state.track
    ? { max: TRACKING_BUDGET, shrink: TRACKING_BUDGET }
    : false,
  lastLineMinWidth: state.lastLineMinWidth,
  emergencyStretch: state.emergencyStretch * spaceWidth,
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
  breaker = createLinebreaker(
    linebreakOptions(state, spaceWidthOf(paragraphs[0])),
  )
  breaker.warm(document)

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
    ...justifOptions(state, spaceWidthOf(paragraphs[0])),
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
