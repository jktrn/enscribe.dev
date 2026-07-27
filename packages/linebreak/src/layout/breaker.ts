import { policy } from "../policy"
import {
  breakPenalty,
  drawsHyphen,
  isFlaggedBreak,
  isForced,
  isRenderedSpace,
  type Item,
  lineEndWidth,
  lineStartWidth,
  passThroughWidth,
} from "./items"

export type BreakKind = "space" | "hyphen" | "forced" | "none"

export type Line = {
  readonly start: number
  readonly end: number
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly naturalWidth: number
  readonly spaceCount: number
  readonly adjustmentRatio: number
  readonly breakKind: BreakKind
}

export type BreakResult =
  | { readonly ok: true; readonly lines: readonly Line[] }
  | { readonly ok: false }

export type BreakOptions = {
  readonly tolerance?: number
  readonly force?: boolean
  readonly sums?: Sums
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

export type Sums = {
  readonly width: readonly number[]
  readonly stretch: readonly number[]
  readonly shrink: readonly number[]
}

const fitnessClass = (ratio: number) => {
  if (ratio < -0.5) return 0
  if (ratio < 0.5) return 1
  if (ratio < 1) return 2
  return 3
}

const badness = (ratio: number) => 100 * Math.abs(ratio) ** 3

const lineDemerits = (ratio: number, penalty: number) => {
  const base = 1 + badness(ratio)
  if (penalty >= 0) return (base + penalty) ** 2
  if (isForced(penalty)) return base ** 2
  return base ** 2 - penalty ** 2
}

export const prefixSums = (items: readonly Item[]): Sums => {
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
  return { width, stretch, shrink }
}

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
  if (item?.kind === "penalty" && isForced(item.penalty)) return "forced"
  for (
    let index = position + 1;
    index < lineStart(items, position);
    index += 1
  ) {
    if (isRenderedSpace(items[index])) return "space"
  }
  return "none"
}

const bandDistance = (ratio: number, tolerance: number) => {
  if (ratio < -1) return -1 - ratio
  if (ratio > tolerance) return ratio - tolerance
  return 0
}

type Search = {
  readonly items: readonly Item[]
  readonly sums: Sums
  readonly target: number
  readonly tolerance: number
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
  const slack = search.target - natural
  const stretch = (sums.stretch[to] as number) - (sums.stretch[start] as number)
  const shrink = (sums.shrink[to] as number) - (sums.shrink[start] as number)

  let ratio = 0
  if (slack > 0)
    ratio = stretch > 0 ? slack / stretch : Number.POSITIVE_INFINITY
  if (slack < 0) ratio = shrink > 0 ? slack / shrink : Number.NEGATIVE_INFINITY
  return { natural, ratio }
}

const stepTo = (
  search: Search,
  actives: readonly ActiveNode[],
  to: number,
  penalty: number,
  forced: boolean,
): Step => {
  const { items, tolerance } = search
  const admitted: Array<ActiveNode | null> = [null, null, null, null]
  const survivors: ActiveNode[] = []
  let minimum = Number.POSITIVE_INFINITY
  let rescue: { node: ActiveNode; ratio: number; distance: number } | null =
    null

  for (const active of actives) {
    const { ratio } = measureLine(search, active, to)

    const tooLong = ratio < -1
    if (!tooLong && !forced) survivors.push(active)

    if (lineStart(items, active.position) >= to) continue

    const distance = bandDistance(ratio, tolerance)
    if (
      !rescue ||
      distance < rescue.distance ||
      (distance === rescue.distance && active.demerits < rescue.node.demerits)
    ) {
      rescue = { node: active, ratio, distance }
    }

    if (ratio < -1 || ratio > tolerance) continue

    const fitness = fitnessClass(ratio)
    let demerits = active.demerits + lineDemerits(ratio, penalty)
    if (
      active.position >= 0 &&
      isFlaggedBreak(items[active.position]) &&
      isFlaggedBreak(items[to])
    ) {
      demerits += policy.demerits.consecutiveFlagged
    }
    if (active.line > 0 && Math.abs(fitness - active.fitness) > 1) {
      demerits += policy.demerits.fitnessJump
    }

    if (demerits < (admitted[fitness]?.demerits ?? Number.POSITIVE_INFINITY)) {
      admitted[fitness] = {
        position: to,
        line: active.line + 1,
        fitness,
        demerits,
        previous: active,
        ratio,
        breakKind: breakKindAt(items, to),
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
    const { natural } = measureLine(search, from, node.position)
    const start = lineStart(items, from.position)
    const breakItem = items[node.position]

    const sourceEnd =
      breakItem?.kind === "discretionary"
        ? breakItem.breakOffset
        : (breakItem?.source.start ?? items.at(-1)?.source.end ?? 0)

    let spaceCount = 0
    for (let index = start; index < node.position; index += 1) {
      if (isRenderedSpace(items[index])) spaceCount += 1
    }

    lines.push({
      start,
      end: node.position,
      sourceStart: items[start]?.source.start ?? sourceEnd,
      sourceEnd,
      naturalWidth: natural,
      spaceCount,
      adjustmentRatio: node.ratio,
      breakKind: node.breakKind,
    })
  }
  return lines.reverse()
}

export const breakParagraph = (
  items: readonly Item[],
  target: number,
  options: BreakOptions = {},
): BreakResult => {
  if (items.length === 0) return { ok: false }
  const search: Search = {
    items,
    sums: options.sums ?? prefixSums(items),
    target,
    tolerance: options.tolerance ?? policy.fit.tolerance,
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
    const penalty = breakPenalty(items, to)
    if (penalty === null) continue
    const forced = isForced(penalty)
    const step = stepTo(search, actives, to, penalty, forced)
    actives = step.actives

    if (step.minimum === Number.POSITIVE_INFINITY) {
      if (actives.length > 0) continue
      if (!options.force || !step.rescue) return { ok: false }
      actives = [forcedNode(items, step.rescue, to)]
      continue
    }

    const ceiling = step.minimum + policy.demerits.fitnessJump
    for (let fitness = 0; fitness < 4; fitness += 1) {
      const candidate = step.admitted[fitness]
      if (candidate && candidate.demerits <= ceiling) {
        actives.push(candidate)
      }
    }
    if (forced) actives = actives.filter((node) => node.position === to)
  }

  const final = actives.reduce<ActiveNode | null>(
    (best, node) => (!best || node.demerits < best.demerits ? node : best),
    null,
  )
  if (!final || final.line === 0) return { ok: false }
  return { ok: true, lines: linesFrom(search, final) }
}

export const breakParagraphWithFallback = (
  items: readonly Item[],
  target: number,
  sums: Sums = prefixSums(items),
): BreakResult => {
  const pass = (options: BreakOptions) =>
    breakParagraph(items, target, { ...options, sums })

  const strict = pass({ tolerance: policy.fit.tolerance })
  if (strict.ok) return strict

  const relaxed = pass({ tolerance: policy.fit.relaxedTolerance })
  if (relaxed.ok) return relaxed

  return pass({ tolerance: policy.fit.relaxedTolerance, force: true })
}
