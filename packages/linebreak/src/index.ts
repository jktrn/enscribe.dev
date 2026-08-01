/**
 * `@enscribe/linebreak` — the DOM engine.
 *
 * Measures an element, chooses breaks for the paragraph as a whole, and
 * rebuilds it with one span per line. Bring your own scheduler; if you would
 * rather not, use `@enscribe/linebreak/auto`.
 */

export { handleCopy } from "./dom/clipboard"
export {
  DEFAULT_SKIP,
  type DiscoverOptions,
  proseBlocks,
} from "./dom/discover"
export { createLinebreaker } from "./linebreaker"
export { ATTRIBUTES, consoleReporter, LINE_SELECTOR, TYPESET_SELECTOR } from "./report"
export {
  type Composition,
  type ComposeReason,
  type DeclineReason,
  type FailureReason,
  isExpected,
  type Linebreaker,
  type LinebreakerOptions,
  type LinebreakerStats,
  type Outcome,
  type SkipReason,
} from "./types"
export type { BreakKind, LayoutPass } from "./layout/breaker"
export type { GlueElasticity, LayoutPolicy } from "./layout/policy"
export { texDefaults, webDefaults } from "./layout/policy"
