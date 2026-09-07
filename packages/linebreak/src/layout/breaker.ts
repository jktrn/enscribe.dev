import { tryStreamedLayout } from "./breaker/streamed-layout"
import { tryStreamedGeneralOnce } from "./breaker/streamed-general"
import { tryStreamedOnce } from "./breaker/streamed"
import type { Item } from "./items"
import { breakWithGeometry, solve } from "./breaker/passes"
import { geometryFor, searchFor } from "./breaker/problem"
import type { LayoutOptions, LayoutResult, PassOptions } from "./breaker/types"

export type {
  BreakKind,
  LayoutDiagnostics,
  LayoutOptions,
  LayoutPass,
  LayoutResult,
  Line,
  PassOptions,
} from "./breaker/types"

export {
  prepareParagraph,
  type PreparationOptions,
  type PreparedParagraph,
  type PreparedLayoutOptions,
  type PreparedPassOptions,
} from "./breaker/prepared"

export const breakParagraphOnce = (
  items: readonly Item[],
  measure: number,
  options: PassOptions,
): LayoutResult =>
  tryStreamedOnce(items, measure, options) ?? tryStreamedGeneralOnce(items, measure, options) ?? solve(searchFor(geometryFor(items, options), measure, options))

export const breakParagraph = (
  items: readonly Item[],
  measure: number,
  options: LayoutOptions = {},
): LayoutResult =>
  tryStreamedLayout(items, measure, options) ?? breakWithGeometry(geometryFor(items, options), measure, options)
