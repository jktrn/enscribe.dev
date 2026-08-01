import {
  breakPenalty,
  drawsHyphen,
  isFlaggedBreak,
  isForced,
  isParagraphEnd,
  isRenderedSpace,
  type Item,
  lineEndWidth,
  lineStartWidth,
  passThroughWidth,
} from "./items"
import { type LayoutPolicy, resolvePolicy } from "./policy"

/**
 * What ended a line.
 *
 * `end` is the paragraph terminator; `forced` is an authored break such as
 * `<br>`. TeX models both as `\penalty-10000`, but consumers need to tell them
 * apart — only `forced` corresponds to a newline in the source text.
 */
export type BreakKind = "space" | "hyphen" | "forced" | "none" | "end"

export type Line = {
  /** Item index of the first item on the line, inclusive. */
  readonly start: number
  /** Item index of the breakpoint that ended the line, exclusive. */
  readonly end: number
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly naturalWidth: number
  readonly spaceCount: number
  readonly stretch: number
  readonly shrink: number
  readonly adjustmentRatio: number
  readonly breakKind: BreakKind
}

/** Which pass of TeX's fallback ladder produced a result. */
export type LayoutPass = "pretolerance" | "tolerance" | "emergency" | "forced"

export type LayoutResult =
  | {
      readonly ok: true
      readonly lines: readonly Line[]
      readonly pass: LayoutPass
      readonly demerits: number
    }
  | { readonly ok: false; readonly reason: "empty" | "infeasible" }

export type LayoutOptions = {
  readonly policy?: Partial<LayoutPolicy>
  /**
   * TeX `\emergencystretch`, in the same units as the item widths.
   * `"auto"` derives roughly 3.5em from the mean glue width.
   */
  readonly emergencyStretch?: number | "auto"
}

export type PassOptions = {
  /** Threshold as badness, matching TeX's `\tolerance`. */
  readonly tolerance: number
  readonly policy?: Partial<LayoutPolicy>
  readonly emergencyStretch?: number
  readonly force?: boolean
}

type ActiveNode = {
  readonly position: number
  readonly line: number
  readonly fitness: number
  readonly demerits: number
  readonly previous: ActiveNode | null
  readonly ratio: number
  readonly breakKind: BreakKind
}

type Sums = {
  readonly width: readonly number[]
  readonly stretch: readonly number[]
  readonly shrink: readonly number[]
}

/**
 * Prefix sums are memoized on array identity so that re-solving the same items
 * at a different measure stays O(1) per candidate line. Keeping the cache
 * private also removes the hazard of a caller supplying sums that do not match
 * their items.
 */
const sumsCache = new WeakMap<readonly Item[], Sums>()

const prefixSums = (items: readonly Item[]): Sums => {
  const cached = sumsCache.get(items)
  if (cached) return cached

  const width = [0]
  const stretch = [0]
  const shrink = [0]
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as Item
    width.push((width[index] as number) + passThroughWidth(item))
    stretch.push(
      (stretch[index] as number) + (item.kind === "glue" ? item.stretch : 0),
    )
    shrink.push(
      (shrink[index] as number) + (item.kind === "glue" ? item.shrink : 0),
    )
  }
  const sums = { width, stretch, shrink }
  sumsCache.set(items, sums)
  return sums
}

/**
 * Fitness classes, using the adjustment-ratio bands from Knuth & Plass p.1155.
 * TeX classifies on integer badness instead, whose crossovers sit at
 * r = 0.50169 and r = 1.0 — a mismatch band under 1% wide, which only ever
 * changes whether `\adjdemerits` is charged.
 *
 * The numbering runs tight -> very loose, the reverse of tex.web. Only
 * `|difference| > 1` is ever tested, so the direction does not matter.
 */
const fitnessClass = (ratio: number) => {
  if (ratio < -0.5) return 0
  if (ratio < 0.5) return 1
  if (ratio < 1) return 2
  return 3
}

const badness = (ratio: number) => 100 * Math.abs(ratio) ** 3

/**
 * TeX §859:
 *
 * ```
 * d := line_penalty + b;
 * if abs(d) >= 10000 then d := 100000000 else d := d*d;
 * if pi > 0 then d := d + pi*pi
 * else if pi > eject_penalty then d := d - pi*pi;
 * ```
 *
 * Note the positive-penalty case is additive. The 1981 paper instead squares
 * the sum, `(l + b + p)^2`, which couples badness to penalty; TeX82 avoids
 * that deliberately and this package follows TeX82.
 */
const lineDemerits = (
  ratio: number,
  penaltyValue: number,
  policy: LayoutPolicy,
) => {
  const base = policy.linePenalty + badness(ratio)
  const squared = Math.abs(base) >= 10_000 ? 100_000_000 : base ** 2
  if (penaltyValue > 0) return squared + penaltyValue ** 2
  if (isForced(penaltyValue)) return squared
  if (penaltyValue < 0) return squared - penaltyValue ** 2
  return squared
}

/** Index of the first item on the line that starts after a break at `position`. */
const lineStart = (items: readonly Item[], position: number) => {
  if (position >= 0 && items[position]?.kind === "discretionary") {
    return position + 1
  }

  let index = position + 1
  while (index < items.length) {
    const item = items[index] as Item
    if (item.kind === "box" || item.kind === "discretionary") break
    index += 1
  }
  return index
}

const breakKindAt = (items: readonly Item[], position: number): BreakKind => {
  const item = items[position]
  if (drawsHyphen(item)) return "hyphen"
  if (isRenderedSpace(item)) return "space"
  if (item?.kind === "penalty" && isForced(item.penalty)) {
    return isParagraphEnd(items, position) ? "end" : "forced"
  }
  const limit = lineStart(items, position)
  for (let index = position + 1; index < limit; index += 1) {
    if (isRenderedSpace(items[index])) return "space"
  }
  return "none"
}

/** How far a ratio sits outside the feasible band, for rescue ranking. */
const bandDistance = (ratio: number, tolerance: number) => {
  if (ratio < -1) return -1 - ratio
  if (ratio > tolerance) return ratio - tolerance
  return 0
}

type Search = {
  readonly items: readonly Item[]
  readonly sums: Sums
  readonly target: number
  readonly toleranceRatio: number
  readonly emergencyStretch: number
  readonly policy: LayoutPolicy
}

type Step = {
  readonly actives: ActiveNode[]
  readonly admitted: Array<ActiveNode | null>
  readonly minimum: number
  readonly rescue: { node: ActiveNode; ratio: number } | null
}

const measureLine = (search: Search, from: ActiveNode, to: number) => {
  const { items, sums } = search
  const start = lineStart(items, from.position)
  const previousItem = from.position < 0 ? undefined : items[from.position]
  const leading = previousItem ? lineStartWidth(previousItem) : 0
  const endItem = items[to]
  const natural =
    (sums.width[to] as number) -
    (sums.width[start] as number) +
    leading +
    (endItem ? lineEndWidth(endItem) : 0)

  const stretch = (sums.stretch[to] as number) - (sums.stretch[start] as number)
  const shrink = (sums.shrink[to] as number) - (sums.shrink[start] as number)

  if (!Number.isFinite(natural)) {
    return { natural: Number.NaN, ratio: Number.NEGATIVE_INFINITY, stretch, shrink }
  }

  const slack = search.target - natural
  let ratio = 0
  if (slack > 0) {
    const stretchable = stretch + search.emergencyStretch
    ratio = stretchable > 0 ? slack / stretchable : Number.POSITIVE_INFINITY
  }
  if (slack < 0) ratio = shrink > 0 ? slack / shrink : Number.NEGATIVE_INFINITY
  return { natural, ratio, stretch, shrink }
}

const stepTo = (
  search: Search,
  actives: readonly ActiveNode[],
  to: number,
  penaltyValue: number,
  forced: boolean,
): Step => {
  const { items, toleranceRatio, policy } = search
  const admitted: Array<ActiveNode | null> = [null, null, null, null]
  const survivors: ActiveNode[] = []
  const kind = breakKindAt(items, to)
  const flaggedHere = isFlaggedBreak(items[to])
  const atParagraphEnd = isParagraphEnd(items, to)
  let minimum = Number.POSITIVE_INFINITY
  let rescue: { node: ActiveNode; ratio: number; distance: number } | null = null

  for (const active of actives) {
    // The line would be empty, which inverts the measured range. Two adjacent
    // forced breaks legitimately produce a blank line, so admit one at zero
    // badness rather than deactivating the node on a garbage ratio.
    if (lineStart(items, active.position) >= to) {
      if (!forced) {
        survivors.push(active)
        continue
      }
      const demerits = active.demerits + lineDemerits(0, penaltyValue, policy)
      if (demerits < (admitted[1]?.demerits ?? Number.POSITIVE_INFINITY)) {
        admitted[1] = {
          position: to,
          line: active.line + 1,
          fitness: 1,
          demerits,
          previous: active,
          ratio: 0,
          breakKind: kind,
        }
        if (demerits < minimum) minimum = demerits
      }
      continue
    }

    const { ratio } = measureLine(search, active, to)

    const tooLong = ratio < -1
    if (!tooLong && !forced) survivors.push(active)

    const distance = bandDistance(ratio, toleranceRatio)
    if (
      !rescue ||
      distance < rescue.distance ||
      (distance === rescue.distance && active.demerits < rescue.node.demerits)
    ) {
      rescue = { node: active, ratio, distance }
    }

    if (ratio < -1 || ratio > toleranceRatio) continue

    const fitness = fitnessClass(ratio)
    let demerits = active.demerits + lineDemerits(ratio, penaltyValue, policy)

    if (active.position >= 0 && isFlaggedBreak(items[active.position])) {
      if (flaggedHere) demerits += policy.doubleHyphenDemerits
      else if (atParagraphEnd) demerits += policy.finalHyphenDemerits
    }
    if (Math.abs(fitness - active.fitness) > 1) {
      demerits += policy.adjDemerits
    }

    if (demerits < (admitted[fitness]?.demerits ?? Number.POSITIVE_INFINITY)) {
      admitted[fitness] = {
        position: to,
        line: active.line + 1,
        fitness,
        demerits,
        previous: active,
        ratio,
        breakKind: kind,
      }
      if (demerits < minimum) minimum = demerits
    }
  }

  return {
    actives: survivors,
    admitted,
    minimum,
    rescue: rescue && { node: rescue.node, ratio: rescue.ratio },
  }
}

/** TeX's `artificial_demerits`: rescue a line at zero cost on the final pass. */
const forcedNode = (
  items: readonly Item[],
  rescue: { node: ActiveNode; ratio: number },
  to: number,
): ActiveNode => {
  const ratio = Number.isFinite(rescue.ratio) ? rescue.ratio : -1
  return {
    position: to,
    line: rescue.node.line + 1,
    fitness: fitnessClass(ratio),
    demerits: rescue.node.demerits,
    previous: rescue.node,
    ratio,
    breakKind: breakKindAt(items, to),
  }
}

const linesFrom = (search: Search, final: ActiveNode): Line[] => {
  const { items } = search
  const lines: Line[] = []
  for (
    let node: ActiveNode | null = final;
    node?.previous;
    node = node.previous
  ) {
    const from = node.previous
    // A blank line between two forced breaks has no items at all; clamping
    // keeps `start <= end` so callers can slice without a special case.
    const start = Math.min(lineStart(items, from.position), node.position)
    const empty = start >= node.position
    const { natural, stretch, shrink } = empty
      ? { natural: 0, stretch: 0, shrink: 0 }
      : measureLine(search, from, node.position)
    const breakItem = items[node.position]

    const sourceEnd =
      breakItem?.kind === "discretionary"
        ? breakItem.breakOffset
        : (breakItem?.source?.start ?? items.at(-1)?.source?.end ?? 0)

    let spaceCount = 0
    for (let index = start; index < node.position; index += 1) {
      if (isRenderedSpace(items[index])) spaceCount += 1
    }

    lines.push({
      start,
      end: node.position,
      sourceStart: items[start]?.source?.start ?? sourceEnd,
      sourceEnd,
      naturalWidth: natural,
      spaceCount,
      stretch,
      shrink,
      adjustmentRatio: node.ratio,
      breakKind: node.breakKind,
    })
  }
  return lines.reverse()
}

/**
 * One `try_break` pass at an explicit tolerance.
 *
 * Most callers want {@link breakParagraph}, which runs TeX's full fallback
 * ladder. This entry point exists for differential testing against
 * `\tracingparagraphs=1` output and for callers implementing their own ladder.
 */
export const breakParagraphOnce = (
  items: readonly Item[],
  measure: number,
  options: PassOptions,
): LayoutResult => {
  if (items.length === 0) return { ok: false, reason: "empty" }

  const policy = resolvePolicy(options.policy)
  const search: Search = {
    items,
    sums: prefixSums(items),
    target: measure,
    // Tolerance is published as badness, matching TeX; the search compares
    // adjustment ratios, so invert `badness(r) = 100 * r^3` here.
    toleranceRatio: (options.tolerance / 100) ** (1 / 3),
    emergencyStretch: options.emergencyStretch ?? 0,
    policy,
  }

  let actives: ActiveNode[] = [
    {
      position: -1,
      line: 0,
      fitness: 1,
      demerits: 0,
      previous: null,
      ratio: 0,
      breakKind: "none",
    },
  ]

  for (let to = 0; to < items.length; to += 1) {
    const penaltyValue = breakPenalty(items, to)
    if (penaltyValue === null) continue
    const forced = isForced(penaltyValue)
    const step = stepTo(search, actives, to, penaltyValue, forced)
    actives = step.actives

    if (step.minimum === Number.POSITIVE_INFINITY) {
      if (actives.length > 0) continue
      if (!options.force || !step.rescue) return { ok: false, reason: "infeasible" }
      actives = [forcedNode(items, step.rescue, to)]
      continue
    }

    const ceiling = step.minimum + policy.adjDemerits
    for (let fitness = 0; fitness < 4; fitness += 1) {
      const candidate = step.admitted[fitness]
      if (candidate && candidate.demerits <= ceiling) actives.push(candidate)
    }
  }

  const final = actives.reduce<ActiveNode | null>(
    (best, node) => (!best || node.demerits < best.demerits ? node : best),
    null,
  )
  if (!final || final.line === 0) return { ok: false, reason: "infeasible" }
  return {
    ok: true,
    lines: linesFrom(search, final),
    pass: options.force ? "forced" : "tolerance",
    demerits: final.demerits,
  }
}

const meanGlueWidth = (items: readonly Item[]) => {
  let total = 0
  let count = 0
  for (const item of items) {
    if (item.kind === "glue" && item.width > 0) {
      total += item.width
      count += 1
    }
  }
  return count > 0 ? total / count : 0
}

/** Roughly 3.5em at a typical 0.25em space, following TeX's `\emergencystretch`. */
const EMERGENCY_STRETCH_SPACES = 14

/**
 * TeX's four-pass ladder: `\pretolerance`, then `\tolerance`, then
 * `\emergencystretch`, then artificial demerits.
 *
 * Emergency stretch is added to the badness *denominator*, never as real glue —
 * this is `background[2] := background[2] + emergency_stretch` in tex.web. It
 * keeps over-tolerance lines finite so they compete on demerits instead of
 * collapsing the search to a single rescued path.
 */
export const breakParagraph = (
  items: readonly Item[],
  measure: number,
  options: LayoutOptions = {},
): LayoutResult => {
  if (items.length === 0) return { ok: false, reason: "empty" }
  const policy = resolvePolicy(options.policy)
  const shared = { policy: options.policy }

  const strict = breakParagraphOnce(items, measure, {
    ...shared,
    tolerance: policy.pretolerance,
  })
  if (strict.ok) return { ...strict, pass: "pretolerance" }

  const relaxed = breakParagraphOnce(items, measure, {
    ...shared,
    tolerance: policy.tolerance,
  })
  if (relaxed.ok) return { ...relaxed, pass: "tolerance" }

  const emergencyStretch =
    options.emergencyStretch === undefined || options.emergencyStretch === "auto"
      ? meanGlueWidth(items) * EMERGENCY_STRETCH_SPACES
      : options.emergencyStretch

  if (emergencyStretch > 0) {
    const emergency = breakParagraphOnce(items, measure, {
      ...shared,
      tolerance: policy.tolerance,
      emergencyStretch,
    })
    if (emergency.ok) return { ...emergency, pass: "emergency" }
  }

  return breakParagraphOnce(items, measure, {
    ...shared,
    tolerance: policy.tolerance,
    emergencyStretch,
    force: true,
  })
}
