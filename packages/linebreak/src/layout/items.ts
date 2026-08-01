import {
  EJECT_PENALTY,
  INFINITE_PENALTY,
  INFINITE_STRETCH,
} from "./policy"

export type ItemSource = { readonly start: number; readonly end: number }

export type Box = {
  readonly kind: "box"
  readonly width: number
  readonly source?: ItemSource
}

export type Glue = {
  readonly kind: "glue"
  readonly width: number
  readonly stretch: number
  readonly shrink: number
  readonly source?: ItemSource
}

export type Penalty = {
  readonly kind: "penalty"
  readonly width: number
  readonly penalty: number
  readonly flagged: boolean
  readonly source?: ItemSource
}

export type Discretionary = {
  readonly kind: "discretionary"
  readonly preWidth: number
  readonly postWidth: number
  readonly noBreakWidth: number
  readonly penalty: number
  readonly hyphen: boolean
  readonly breakOffset: number
  readonly source?: ItemSource
}

export type Item = Box | Glue | Penalty | Discretionary

export const box =(width: number, source?: ItemSource): Box => ({
  kind: "box",
  width,
  source,
})

export const glue = (
  width: number,
  stretch: number,
  shrink: number,
  source?: ItemSource,
): Glue => ({ kind: "glue", width, stretch, shrink, source })

export const penalty = (
  value: number,
  options: {
    width?: number
    flagged?: boolean
    source?: ItemSource
  } = {},
): Penalty => ({
  kind: "penalty",
  width: options.width ?? 0,
  penalty: value,
  flagged: options.flagged ?? false,
  source: options.source,
})

export const discretionary = (options: {
  preWidth?: number
  postWidth?: number
  noBreakWidth?: number
  penalty?: number
  hyphen?: boolean
  breakOffset: number
  source?: ItemSource
}): Discretionary => ({
  kind: "discretionary",
  preWidth: options.preWidth ?? 0,
  postWidth: options.postWidth ?? 0,
  noBreakWidth: options.noBreakWidth ?? 0,
  penalty: options.penalty ?? 0,
  hyphen: options.hyphen ?? false,
  breakOffset: options.breakOffset,
  source: options.source,
})

export const isForbidden = (value: number) => value >= INFINITE_PENALTY

export const isForced = (value: number) => value <= EJECT_PENALTY

export const passThroughWidth = (item: Item): number => {
  switch (item.kind) {
    case "box":
      return item.width
    case "glue":
      return item.width
    case "penalty":
      return 0
    case "discretionary":
      return item.noBreakWidth
  }
}

export const lineEndWidth = (item: Item): number => {
  switch (item.kind) {
    case "penalty":
      return item.width
    case "discretionary":
      return item.preWidth
    default:
      return 0
  }
}

export const lineStartWidth = (item: Item): number =>
  item.kind === "discretionary" ? item.postWidth : 0

/**
 * The penalty for breaking at `index`, or `null` if no break is legal there.
 *
 * Follows TeX §868: glue is a legal breakpoint only when preceded by a
 * non-discardable item, a penalty is legal below `\inf_penalty`, and a box is
 * never a breakpoint.
 */
export const breakPenalty = (items: readonly Item[], index: number) => {
  const item = items[index]
  if (!item) return null
  if (item.kind === "glue") {
    const previous = items[index - 1]
    if (!previous) return null
    if (previous.kind !== "box" && previous.kind !== "discretionary") {
      return null
    }
    return 0
  }
  if (item.kind === "penalty" || item.kind === "discretionary") {
    return isForbidden(item.penalty) ? null : item.penalty
  }
  return null
}

export const drawsHyphen = (item: Item | undefined) =>
  item?.kind === "discretionary" && item.hyphen

export const isFlaggedBreak = (item: Item | undefined) =>
  item?.kind === "penalty" ? item.flagged : drawsHyphen(item)

/**
 * Whether this glue stands for a real space in the source text, as opposed to
 * synthetic glue such as `\parfillskip`.
 *
 * Glue with no `source` is assumed to be a space, which is what a caller
 * laying out plain strings means. Synthetic glue carries a degenerate source
 * (`start === end`) and is excluded.
 */
export const isRenderedSpace = (item: Item | undefined) =>
  item?.kind === "glue" &&
  (item.source === undefined || item.source.end > item.source.start)

/** TeX's `\nobreak\hfil\break` — an authored forced line break. */
export const lineBreak = (offset = 0, end = offset): Item[] => {
  const source = { start: offset, end: offset }
  return [
    penalty(INFINITE_PENALTY, { source }),
    glue(0, INFINITE_STRETCH, 0, source),
    penalty(EJECT_PENALTY, { source: { start: offset, end } }),
  ]
}

/**
 * TeX's `\parfillskip=0pt plus 1fil` followed by `\penalty-10000`.
 * Every paragraph must end with this.
 */
export const paragraphEnd = (offset = 0): Item[] => {
  const source = { start: offset, end: offset }
  return [
    penalty(INFINITE_PENALTY, { source }),
    glue(0, INFINITE_STRETCH, 0, source),
    penalty(EJECT_PENALTY, { source, flagged: false }),
  ]
}

/**
 * True when `index` addresses the `\penalty-10000` that terminates a
 * paragraph, as opposed to an authored `<br>`.
 */
export const isParagraphEnd = (items: readonly Item[], index: number) =>
  index === items.length - 1 &&
  items[index]?.kind === "penalty" &&
  isForced((items[index] as Penalty).penalty)
