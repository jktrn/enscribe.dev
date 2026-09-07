import { breakStreamedLayout } from "./streamed-layout"
import { streamSnapshot, solveSnapshot } from "./streamed-snapshot"
import type { Item } from "../items"
import { breakWithGeometry, solve } from "./passes"
import { geometryFor, searchFor, type GeometryOptions } from "./problem"
import type { LayoutOptions, LayoutResult, PassOptions } from "./types"

export type PreparationOptions = GeometryOptions
type FixedGeometry = { readonly flex?: never; readonly hangs?: never }
export type PreparedLayoutOptions = Omit<LayoutOptions, "flex" | "hangs"> &
  FixedGeometry
export type PreparedPassOptions = Omit<PassOptions, "flex" | "hangs"> &
  FixedGeometry

export type PreparedParagraph = {
  readonly itemCount: number
  readonly breakParagraphOnce: (
    measure: number,
    options: PreparedPassOptions,
  ) => LayoutResult
  readonly breakParagraph: (
    measure: number,
    options?: PreparedLayoutOptions,
  ) => LayoutResult
}

const fixedOptions = <Options extends FixedGeometry>(
  options: Options,
): Options => {
  if ("flex" in options || "hangs" in options)
    throw new TypeError("Prepared paragraph geometry cannot be overridden.")
  return options
}

/** Materialize numeric geometry; no caller-owned items or sidecars are retained. */
export const prepareParagraph = (
  items: readonly Item[],
  options: PreparationOptions = {},
): PreparedParagraph => {
  const streamed = !(options.flex || options.hangs) ? streamSnapshot(items) : null
  if (streamed) {
    let saved: ReturnType<typeof geometryFor> | null = null
    const fallback = () => saved ??= geometryFor(streamed.items, {})
    return Object.freeze({
      itemCount: streamed.items.length,
      breakParagraphOnce: (measure: number, pass: PreparedPassOptions) => {
        const fixed = fixedOptions(pass)
        return solveSnapshot(streamed, measure, fixed) ?? solve(searchFor(fallback(), measure, fixed))
      },
      breakParagraph: (measure: number, layout: PreparedLayoutOptions = {}) => {
        const fixed = fixedOptions(layout)
        return breakStreamedLayout(streamed, measure, fixed, fallback) ?? breakWithGeometry(fallback(), measure, fixed)
      },
    })
  }
  const geometry = geometryFor(items, options)
  return Object.freeze({
    itemCount: items.length,
    breakParagraphOnce: (measure: number, pass: PreparedPassOptions) =>
      solve(searchFor(geometry, measure, fixedOptions(pass))),
    breakParagraph: (measure: number, layout: PreparedLayoutOptions = {}) =>
      breakWithGeometry(geometry, measure, fixedOptions(layout)),
  })
}
