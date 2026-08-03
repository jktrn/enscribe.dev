import type { GlueElasticity, LayoutPolicy } from "./layout/policy"
import type { DeclineReason, FailureReason, SkipReason } from "./reasons"
import type { Hyphenator } from "./text/source"

export {
  DECLINE_REASONS,
  FAILURE_REASONS,
  SKIP_REASONS,
} from "./reasons"
export type {
  ComposeReason,
  DeclineReason,
  FailureReason,
  SkipReason,
} from "./reasons"
export type { Hyphenator } from "./text/source"

export type Outcome =
  | {
      readonly element: HTMLElement
      readonly status: "typeset"
      readonly lines: number
      readonly retries: number
    }
  | {
      readonly element: HTMLElement
      readonly status: "skipped"
      readonly reason: SkipReason
    }
  | {
      readonly element: HTMLElement
      readonly status: "declined"
      readonly reason: DeclineReason
    }
  | {
      readonly element: HTMLElement
      readonly status: "failed"
      readonly reason: FailureReason
      readonly cause?: unknown
    }

export const isExpected = (outcome: Outcome) =>
  outcome.status === "typeset" || outcome.status === "skipped"

declare const brand: unique symbol

export const COMPOSITION_BRAND = Symbol("linebreak.composition") as symbol & {
  readonly [brand]: never
}

export type Composition = {
  readonly brand: typeof COMPOSITION_BRAND
  readonly element: HTMLElement
  readonly status: "ready" | "skipped" | "declined" | "failed"
  readonly lines: number
  readonly width: number
  readonly reason?: SkipReason | DeclineReason | FailureReason
}

export type LinebreakerOptions = {
  locale?: string
  minimumWidth?: number
  hyphenate?: Hyphenator
  protrude?: boolean
  expand?: boolean
  track?: boolean
  lastLineMinWidth?: number
  preserveImageAttributes?: readonly string[]

  policy?: Partial<LayoutPolicy>
  glue?: Partial<GlueElasticity>
  safetyMargin?: number
  retries?: number
  maximumCharacters?: number

  onOutcome?: (outcome: Outcome) => void
}

export type LinebreakerStats = {
  readonly typeset: number
  readonly skipped: number
  readonly declined: number
  readonly failed: number
  readonly retries: number
  readonly liveElements: number
  readonly cachedFonts: number
}

export interface Linebreaker {
  compose(elements: Iterable<HTMLElement>): readonly Composition[]
  apply(compositions: Iterable<Composition>): readonly Outcome[]
  typeset(elements: Iterable<HTMLElement>): readonly Outcome[]
  restore(elements?: Iterable<HTMLElement>): void
  reset(elements?: Iterable<HTMLElement>): void
  refresh(): void
  stats(): LinebreakerStats
  dispose(): void
}
