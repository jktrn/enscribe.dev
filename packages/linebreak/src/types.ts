import type { GlueElasticity, LayoutPolicy } from "./layout/policy"

/**
 * Nothing is wrong. The element was left to the browser on purpose, and a
 * different width or a content change might well change that.
 */
export type SkipReason =
  | "single-line"
  | "empty"
  | "too-narrow"
  | "already-typeset"

/**
 * The content cannot be modelled. A capability gap — worth knowing about, not
 * worth panicking about.
 */
export type DeclineReason =
  | "unsupported-content"
  | "unsupported-direction"
  | "unsupported-writing-mode"
  | "too-long"
  | "unmeasurable"
  | "segmentation-mismatch"
  | "no-feasible-breaking"

/** What `compose` can conclude before anything is written. */
export type ComposeReason = SkipReason | DeclineReason

/** Tried, wrote, put it back. Always worth knowing about. */
export type FailureReason =
  | "lines-wrapped"
  /** The element's own width depends on its content, so it can never settle. */
  | "unstable-width"
  | "line-height-unresolved"
  | "no-feasible-breaking"
  | "render-failed"

/**
 * Invariant: anything whose status is not `"typeset"` is left in browser line
 * breaking. The three non-typeset arms differ only in why.
 */
export type Outcome =
  | {
      readonly element: HTMLElement
      readonly status: "typeset"
      readonly lines: number
      /** Re-solves needed before the rendered lines fit. Usually 0. */
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

/** True for outcomes that need no attention: a success or a deliberate skip. */
export const isExpected = (outcome: Outcome) =>
  outcome.status === "typeset" || outcome.status === "skipped"

declare const brand: unique symbol

export const COMPOSITION_BRAND = Symbol("linebreak.composition") as symbol & {
  readonly [brand]: never
}

/**
 * The result of measuring one element, before anything is written.
 *
 * Inspect it to decide whether the write is worth it — `lines` is how many
 * lines it would produce. Compositions are single-use.
 */
export type Composition = {
  readonly brand: typeof COMPOSITION_BRAND
  readonly element: HTMLElement
  readonly status: "ready" | "skipped" | "declined"
  /** Lines this would render. Zero unless `status` is `"ready"`. */
  readonly lines: number
  readonly width: number
  readonly reason?: SkipReason | DeclineReason
}

export type LinebreakerOptions = {
  /** Falls back to the nearest `lang`, then `<html lang>`, then `en-US`. */
  locale?: string
  /** Content box width below which an element is left alone. Default 240. */
  minimumWidth?: number
  /** Dictionary hyphenation inside words. English only. Default false. */
  hyphenate?: boolean
  /** Copied between original and rebuilt images at the same index. */
  preserveImageAttributes?: readonly string[]

  /** TeX tuning: tolerances, demerits, penalties. */
  policy?: Partial<LayoutPolicy>
  /** Interword elasticity as a fraction of the measured space width. */
  glue?: Partial<GlueElasticity>
  /** Sub-pixel pad against browser layout quantization. Default 0.5. */
  safetyMargin?: number
  /** Re-solve rounds when a rendered line wraps anyway. Default 3. */
  retries?: number
  /** Refuse paragraphs longer than this many collapsed characters. */
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

/**
 * The DOM engine: measure, write, verify, restore. One element at a time, with
 * no lifetime management — see `@enscribe/linebreak/auto` for that.
 *
 * Every method takes an iterable. A single element is `typeset([element])`.
 */
export interface Linebreaker {
  /** Layout reads only. Never writes the DOM. */
  compose(elements: Iterable<HTMLElement>): readonly Composition[]

  /** Writes, then verifies and retries. Compositions are single-use. */
  apply(compositions: Iterable<Composition>): readonly Outcome[]

  /** `compose` then `apply`, batched. The default path. */
  typeset(elements: Iterable<HTMLElement>): readonly Outcome[]

  /** Put authored content back. Defaults to every typeset element. */
  restore(elements?: Iterable<HTMLElement>): void

  /** Restore and drop cached measurements. Safe around a content edit. */
  reset(elements?: Iterable<HTMLElement>): void

  /** Forget outcomes a geometry change could flip, keeping measurements. */
  refresh(): void

  stats(): LinebreakerStats

  dispose(): void
}
