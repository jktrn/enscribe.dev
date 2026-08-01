/**
 * `@enscribe/linebreak/layout` — the Knuth-Plass optimizer on its own.
 *
 * No DOM, no canvas, no dependencies. Give it items with widths and a measure;
 * it gives back a set of breakpoints. Runs anywhere JavaScript does.
 *
 * ```ts
 * import { box, breakParagraph, glue, paragraphEnd } from "@enscribe/linebreak/layout"
 *
 * const items = [box(40), glue(4, 2, 1.33), box(55), ...paragraphEnd()]
 * const result = breakParagraph(items, 380)
 * if (result.ok) for (const line of result.lines) draw(line)
 * ```
 */

export {
  breakParagraph,
  breakParagraphOnce,
  type BreakKind,
  type LayoutOptions,
  type LayoutPass,
  type LayoutResult,
  type Line,
  type PassOptions,
} from "./layout/breaker"

export {
  box,
  breakPenalty,
  type Box,
  type Discretionary,
  discretionary,
  type Glue,
  glue,
  isForbidden,
  isForced,
  type Item,
  type ItemSource,
  lineBreak,
  paragraphEnd,
  type Penalty,
  penalty,
} from "./layout/items"

export {
  defaultGlue,
  EJECT_PENALTY,
  type GlueElasticity,
  INFINITE_PENALTY,
  INFINITE_STRETCH,
  type LayoutPolicy,
  texDefaults,
  webDefaults,
} from "./layout/policy"
