export type NativeReason =
  | "destroyed"
  | "unsupported-direction"
  | "insufficient-width"
  | "unsupported-content"
  | "infeasible"
  | "render-failed"

export type SourceRange = {
  start: number
  end: number
}

export type LinebreakPlan = {
  readonly element: HTMLElement
}

export type LinebreakResult = {
  readonly element: HTMLElement
  readonly state: "typeset" | "native" | "stale"
  readonly reason?: NativeReason
  readonly lineCount?: number
}

export type LinebreakError = {
  readonly element: HTMLElement
  readonly phase: "measure" | "optimize" | "render"
  readonly cause: unknown
}

export type LinebreakerOptions = {
  locale?: string
  minimumWidth?: number
  resizeTolerance?: number
  onError?: (error: LinebreakError) => void
  preserveImageAttributes?: readonly string[]
}

export type PretextPreparationPhase = "paragraph" | "styled-batch"

export type PretextPreparationStat = {
  calls: number
  characters: number
  milliseconds: number
}

export type LinebreakMetrics = {
  cachedParagraphs: number
  exactRetries: number
  preparation: Partial<Record<PretextPreparationPhase, PretextPreparationStat>>
}

export interface Linebreaker {
  plan(element: HTMLElement): LinebreakPlan
  commit(plan: LinebreakPlan): LinebreakResult
  commit(plans: Iterable<LinebreakPlan>): LinebreakResult[]
  typeset(element: HTMLElement): LinebreakResult
  typeset(elements: Iterable<HTMLElement>): LinebreakResult[]
  restore(element: HTMLElement): void
  restore(elements: Iterable<HTMLElement>): void
  invalidate(element: HTMLElement): void
  invalidate(elements: Iterable<HTMLElement>): void
  readMetrics(): LinebreakMetrics
  destroy(): void
}
