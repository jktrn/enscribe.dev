import type { Item } from "../items"
import { boundedPrefixes, finiteTerms } from "../numeric/bounds"
import { resolvePolicy } from "../policy"
import { prefixSums } from "../sums"
import { breakpoints, openingAt } from "./breakpoints"
import { rejectionRatio } from "./cost"
import { demeritBound } from "./cost-state"
import type { Geometry, PassOptions, Search } from "./types"

export type GeometryOptions = Pick<PassOptions, "flex" | "hangs">

export const geometryFor = (
  items: readonly Item[],
  options: GeometryOptions,
): Geometry => {
  const sums = prefixSums(items, options.flex)
  const hangs = options.hangs ?? null
  const edges = breakpoints(items, sums, hangs)
  return {
    simple: sums.integerGeometry === true && !hangs && edges.every(edge => edge.leading === 0 && edge.trailing === 0),
    itemCount: items.length,
    corrections: sums.corrections,
    validCapacities:
      finiteTerms(sums.corrections.stretch) &&
      finiteTerms(sums.corrections.shrink),
    boundedCapacities:
      boundedPrefixes(sums.stretch, sums.corrections.stretch) &&
      boundedPrefixes(sums.shrink, sums.corrections.shrink),
    opening: openingAt(items, sums, hangs, -1),
    edges,
    finitePenaltyCosts: edges.every((edge) =>
      Number.isFinite(edge.penaltyCost),
    ),
    autoStretch: sums.autoStretch,
  }
}

export const searchFor = (
  geometry: Geometry,
  measure: number,
  options: PassOptions,
): Search => {
  const diagnostics = options.diagnostics ?? null
  if (diagnostics) diagnostics.attemptedPasses = 0
  const policy = resolvePolicy(options.policy)
  const ending = (options.lastLineMinWidth ?? 0) * measure
  return {
    simple: geometry.simple,
    itemCount: geometry.itemCount,
    corrections: geometry.corrections,
    validCapacities: geometry.validCapacities,
    boundedCapacities: geometry.boundedCapacities,
    demeritBound: demeritBound(geometry, policy, ending),
    opening: geometry.opening,
    edges: geometry.edges,
    target: measure,
    tolerance: options.tolerance,
    rejectionRatio: rejectionRatio(options.tolerance, policy.scoring),
    emergencyStretch: options.emergencyStretch ?? 0,
    policy,
    rescuing: options.force === true,
    indent: options.indent ?? 0,
    ending,
    endingStrict: options.strictEnding === true,
    diagnostics,
  }
}
