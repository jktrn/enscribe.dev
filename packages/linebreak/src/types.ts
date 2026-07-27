import type { Diagnostic, DiagnosticKind, DiagnosticSink } from "./diagnostics"

export type LinebreakerOptions = {
  locale?: string
  minimumWidth?: number
  onDiagnostic?: DiagnosticSink
  hyphenate?: boolean
  preserveImageAttributes?: readonly string[]
}

export type LinebreakPlan = {
  readonly element: HTMLElement
}

export type LinebreakResult =
  | {
      readonly element: HTMLElement
      readonly state: "typeset"
      readonly lineCount: number
    }
  | {
      readonly element: HTMLElement
      readonly state: "native"
      readonly reason: DiagnosticKind
    }

export type LinebreakMetrics = {
  cachedParagraphs: number
  cachedTypographies: number
}

export interface Linebreaker {
  plan(element: HTMLElement): LinebreakPlan

  commit(plan: LinebreakPlan): LinebreakResult
  commit(plans: Iterable<LinebreakPlan>): LinebreakResult[]

  typeset(element: HTMLElement): LinebreakResult
  typeset(elements: Iterable<HTMLElement>): LinebreakResult[]

  restore(element: HTMLElement): void
  restore(elements: Iterable<HTMLElement>): void

  invalidate(element?: HTMLElement): void
  invalidate(elements: Iterable<HTMLElement>): void
  readMetrics(): LinebreakMetrics

  destroy(): void
}

export type { Diagnostic, DiagnosticKind, DiagnosticSink }
