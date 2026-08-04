export const SKIP_REASONS = [
  "single-line",
  "empty",
  "too-narrow",
  "already-typeset",
] as const

export type SkipReason = (typeof SKIP_REASONS)[number]

export const DECLINE_REASONS = [
  "unsupported-content",
  "unsupported-direction",
  "unsupported-writing-mode",
  "too-long",
  "unmeasurable",
  "segmentation-mismatch",
  "no-feasible-breaking",
] as const

export type DeclineReason = (typeof DECLINE_REASONS)[number]

export type ComposeReason = SkipReason | DeclineReason

export const FAILURE_REASONS = [
  "layout-mismatch",
  "unstable-width",
  "line-height-unresolved",
  "render-failed",
] as const

export type FailureReason = (typeof FAILURE_REASONS)[number]
