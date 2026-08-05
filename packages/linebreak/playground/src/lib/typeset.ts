import { type ParagraphOutcome, runJustif, runLinebreak } from "./engines"
import { fontById, widthAxisResponse } from "./fonts"
import { type ColumnMetrics, measureColumn } from "./metrics"
import { SAMPLES } from "./samples"
import type { Triple } from "./scoring"
import { ENGINES, type EngineId, type State } from "./state"

/** One engine's slot in a rendering surface: the live canvas, or the sweep. */
export type Slot = {
  readonly engine: EngineId
  readonly typeset: HTMLElement
  readonly native: HTMLElement | null
}

export type Surface = readonly Slot[]

export type Outcomes = Partial<Record<EngineId, ParagraphOutcome[]>>

/** A width axis this shallow cannot carry the expansion budget. */
const AXIS_FLOOR = 0.001

export const sampleHtml = (id: string) =>
  SAMPLES.find((sample) => sample.id === id)?.html ?? ""

export const applyNativeHyphens = (element: HTMLElement, on: boolean) => {
  element.style.hyphens = on ? "auto" : "none"
  element.style.setProperty("-webkit-hyphens", on ? "auto" : "none")
  element.style.setProperty("hyphenate-limit-chars", "5 2 3")
}

/**
 * Resolves the two controls whose availability depends on the chosen face and
 * on another control, so both engines are asked for the same thing.
 */
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

/**
 * Waits for every face the filled sample actually needs, not just the body
 * face. A code chip carries its own family, and that request only starts once
 * the sample is in the document and laid out. Measuring before it arrives
 * sizes the chip in the fallback and overruns the measure. Reading geometry
 * first starts the request; the second round covers a face that only became
 * reachable once the first one resolved.
 */
const facesSettled = async (host: Element) => {
  if (!document.fonts) return
  for (let attempt = 0; attempt < 3; attempt += 1) {
    host.getBoundingClientRect()
    await document.fonts.ready
    if (document.fonts.status !== "loading") return
  }
}

/**
 * Fills, typesets, and measures one surface. The browser column is left to the
 * native engine; the other two are driven and may decline paragraphs.
 */
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
