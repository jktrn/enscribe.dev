import { rangeDifference, rangeSum } from "../numeric/range"
import { prefixValue } from "../numeric/prefix"
import { INFINITE_BADNESS_RATIO } from "./cost"
import type { ActiveNode, Edge, Measurement, Search } from "./types"

const adjustmentRatio = (
  search: Search,
  natural: number,
  stretch: number,
  shrink: number,
) => {
  if (!Number.isFinite(natural)) return Number.NEGATIVE_INFINITY
  const slack = search.target - natural
  if (slack < 0) return slack / Math.max(0, shrink)
  if (slack === 0) return 0
  const stretchable = stretch + search.emergencyStretch
  if (!(stretchable > 0)) return INFINITE_BADNESS_RATIO
  if (
    slack === Number.POSITIVE_INFINITY ||
    stretchable === Number.POSITIVE_INFINITY
  )
    return (
      (search.target / 2 - natural / 2) /
      (stretch / 2 + search.emergencyStretch / 2)
    )
  return slack / stretchable
}

const naturalWidth = (
  search: Search,
  from: ActiveNode,
  edge: Edge,
  measured: Measurement,
) => {
  const boundary = from.boundary
  const correction = search.corrections.width
  if (
    from.leading === 0 &&
    edge.trailing === 0 &&
    boundary.hangStart === 0 &&
    edge.hangEnd === 0
  )
    return correction
      ? rangeDifference(
          measured.sum,
          correction,
          boundary.start,
          edge.position,
          boundary.startWidth,
          edge.width,
        )
      : edge.width - boundary.startWidth
  return rangeSum(
    measured.sum,
    correction,
    boundary.start,
    edge.position,
    boundary.startWidth,
    edge.width,
    from.leading,
    edge.trailing,
    -boundary.hangStart,
    -edge.hangEnd,
  )
}

const capacity = (
  search: Search,
  from: ActiveNode,
  edge: Edge,
  measured: Measurement,
  side: "stretch" | "shrink",
) => {
  const boundary = from.boundary
  const before =
    side === "stretch" ? boundary.startStretch : boundary.startShrink
  const correction = search.corrections[side]
  return correction
    ? rangeDifference(
        measured.sum,
        correction,
        boundary.start,
        edge.position,
        before,
        edge[side],
      )
    : edge[side] - before
}

export const measureInto = (
  search: Search,
  from: ActiveNode,
  edge: Edge,
  measured: Measurement,
  complete = false,
): void => {
  const boundary = from.boundary
  // startsLine stops at mandatory breaks; canBreakFrom rejects skipped optional
  // edges. Every measured endpoint therefore lies at or after this opening.
  if (
    boundary.start === edge.position &&
    boundary.leading === 0 &&
    !(from.previous === null && search.indent !== 0) &&
    edge.trailing === 0
  ) {
    measured.natural = 0
    measured.stretch = 0
    measured.shrink = 0
    measured.ratio = 0
    return
  }
  const natural = naturalWidth(search, from, edge, measured)
  const stretch =
    complete || natural < search.target
      ? capacity(search, from, edge, measured, "stretch")
      : 0
  const shrink =
    complete || natural > search.target
      ? capacity(search, from, edge, measured, "shrink")
      : 0
  measured.natural = natural
  measured.stretch = stretch
  measured.shrink = shrink
  measured.ratio = adjustmentRatio(search, natural, stretch, shrink)
}

export const canContinue = (search: Search, from: ActiveNode, edge: Edge) => {
  if (search.diagnostics)
    search.diagnostics.pruningChecks =
      (search.diagnostics.pruningChecks as number) + 1
  const width = from.boundary.startWidth
  const before = width - from.leading + from.boundary.hangStart
  const shrink = prefixValue(
    search.corrections.shrink,
    from.boundary.startShrink,
  )
  // Both bounds are needed: negative shrink cannot reduce a line's width.
  const minimum = Math.min(
    edge.minimumWidth - before,
    edge.minimumTightWidth - before + shrink,
  )
  const scale = Math.max(
    edge.roundingScale,
    Math.abs(width),
    Math.abs(shrink),
    Math.abs(from.leading),
    Math.abs(from.boundary.hangStart),
    Math.abs(before),
    Math.abs(edge.minimumWidth),
    Math.abs(edge.minimumTightWidth),
    Math.abs(search.target),
  )
  // Prefix carries and both reassociated expression chains enlarge the bound.
  const uncertainty =
    2 * (edge.roundingLoss + from.boundary.startLoss) +
    128 * Number.EPSILON * scale +
    64 * Number.MIN_VALUE
  return !(minimum > search.target + uncertainty)
}
