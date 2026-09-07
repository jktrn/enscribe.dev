import type { LayoutPolicy } from "../policy"
import type { Geometry } from "./types"

/** Magnitude certificate for finite sequential costs, including rounded additions. */
export const demeritBound = (
  geometry: Geometry,
  policy: LayoutPolicy,
  ending: number,
) => {
  if (
    !geometry.finitePenaltyCosts ||
    !Number.isFinite(policy.linePenalty) ||
    !Number.isFinite(ending)
  )
    return null
  const perLine =
    200_000_000 +
    Math.abs(policy.adjDemerits) +
    Math.max(
      Math.abs(policy.doubleHyphenDemerits),
      Math.abs(policy.finalHyphenDemerits),
    )
  // At most one line per edge. The factor-four reserve also covers rounded
  // additions for every representable JavaScript array length.
  const bound = geometry.edges.length * perLine
  return bound <= Number.MAX_VALUE / 4 ? bound : null
}
