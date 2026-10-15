import {
  COMPOSITION_BRAND,
  DECLINE_REASONS,
  SKIP_REASONS,
  type Composition,
  type Outcome,
} from "../types"
import type { Draft, RenderJob } from "./state"
import type { Drafts } from "./drafts"

const SKIPPED: ReadonlySet<string> = new Set(SKIP_REASONS)
const DECLINED: ReadonlySet<string> = new Set(DECLINE_REASONS)

export const statusFor = (reason: string) => {
  if (SKIPPED.has(reason)) return "skipped" as const
  if (DECLINED.has(reason)) return "declined" as const
  return "failed" as const
}

export const readyCompositions = (
  order: readonly Composition[],
  results: Map<Composition, Outcome>,
  drafts: Drafts,
) => {
  const ready: RenderJob[] = []
  for (const composition of order) {
    if (composition?.brand !== COMPOSITION_BRAND) {
      throw new TypeError("linebreak: apply() received a foreign composition")
    }
    const draft = drafts.get(composition)
    if (draft === undefined) {
      throw new TypeError("linebreak: this composition was already applied")
    }
    if (composition.status !== "ready") {
      results.set(composition, {
        element: composition.element,
        status: composition.status,
        reason: composition.reason,
      } as Outcome)
      continue
    }
    // Ready compositions are registered with a draft; settled ones use null.
    ready.push({ composition, draft: draft as Draft })
  }
  return ready
}
export const reportOutcomes = (
  order: readonly Composition[],
  results: Map<Composition, Outcome>,
  counters: {
    typeset: number
    skipped: number
    declined: number
    failed: number
  },
  report?: (outcome: Outcome) => void,
) => {
  // Validation, writing, and settling produce exactly one outcome per composition.
  const outcomes = order.map(
    (composition) => results.get(composition) as Outcome,
  )
  for (const outcome of outcomes) {
    counters[outcome.status] += 1
  }
  // Count the entire applied batch even if a user callback stops delivery.
  if (report) for (const outcome of outcomes) report(outcome)
  return outcomes
}
