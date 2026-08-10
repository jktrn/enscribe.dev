import { type ParagraphOutcome, runJustif, runLinebreak } from "./engines"
import { fontById, widthAxisResponse } from "./fonts"
import { type ColumnMetrics, measureColumn } from "./metrics"
import { SAMPLES } from "./samples"
import type { Triple } from "./scoring"
import { ENGINES, type EngineId, type State } from "./state"

export type Slot = {
  readonly engine: EngineId
  readonly typeset: HTMLElement
  readonly native: HTMLElement | null
}

export type Surface = readonly Slot[]

export type Outcomes = Partial<Record<EngineId, ParagraphOutcome[]>>

const AXIS_FLOOR = 0.001

export const sampleHtml = (id: string) =>
  SAMPLES.find((sample) => sample.id === id)?.html ?? ""

export const applyNativeHyphens = (element: HTMLElement, on: boolean) => {
  element.style.hyphens = on ? "auto" : "none"
  element.style.setProperty("-webkit-hyphens", on ? "auto" : "none")
  element.style.setProperty("hyphenate-limit-chars", "5 2 3")
}

export const effectiveState = (state: State): State => {
  const response = widthAxisResponse(fontById(state.font).stack, state.size)
  return {
    ...state,
    expand: state.expand && response >= AXIS_FLOOR,
    hang: state.protrude ? state.hang : "none",
  }
}

export const widthResponseOf = (state: State) =>
  widthAxisResponse(fontById(state.font).stack, state.size)

const paragraphsOf = (slot: Slot) => [...slot.typeset.querySelectorAll("p")]

const slotFor = (surface: Surface, engine: EngineId) =>
  surface.find((slot) => slot.engine === engine)

export const fillSample = (surface: Surface, state: State) => {
  const html = sampleHtml(state.sample)
  for (const slot of surface) {
    slot.typeset.innerHTML = html
    if (slot.native !== null) slot.native.innerHTML = html
  }
  for (const slot of surface) {
    const mirror = slot.engine === "browser" ? slot.typeset : slot.native
    if (mirror !== null) applyNativeHyphens(mirror, state.hyphenate)
  }
}

const facesSettled = async (host: Element) => {
  if (!document.fonts) return
  for (let attempt = 0; attempt < 3; attempt += 1) {
    host.getBoundingClientRect()
    await document.fonts.ready
    if (document.fonts.status !== "loading") return
  }
}

export const typesetSurface = async (
  surface: Surface,
  state: State,
): Promise<{ outcomes: Outcomes; columns: Triple }> => {
  fillSample(surface, state)
  const first = surface[0]
  if (first !== undefined) await facesSettled(first.typeset)

  const outcomes: Outcomes = {}
  const linebreak = slotFor(surface, "linebreak")
  if (linebreak !== undefined) {
    outcomes.linebreak = runLinebreak(paragraphsOf(linebreak), state)
  }
  const justif = slotFor(surface, "justif")
  if (justif !== undefined) {
    outcomes.justif = await runJustif(paragraphsOf(justif), state)
  }

  const columns = ENGINES.map((engine) => {
    const slot = slotFor(surface, engine)
    if (slot === undefined) throw new Error(`typeset: no slot for ${engine}`)
    return measureColumn(slot.typeset, engine)
  }) as unknown as [ColumnMetrics, ColumnMetrics, ColumnMetrics]

  return { outcomes, columns }
}
