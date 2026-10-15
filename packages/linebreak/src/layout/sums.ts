import type { Flex } from "./flex"
import { PrefixSum } from "./numeric/prefix"
import { addCapacity, capacityTerms as flexTerms } from "./numeric/flex"
import type { Corrections } from "./numeric/range"
import { isForced, isRenderedSpace, type Item, passThroughWidth } from "./items"

export type Sums = {
  readonly integerGeometry?: true
  readonly width: readonly number[]
  readonly stretch: readonly number[]
  readonly shrink: readonly number[]
  readonly spaces: readonly number[]
  readonly autoStretch: number
  readonly corrections: Corrections
  readonly starts: Int32Array
}

const startsLine = (item: Item) =>
  item.kind === "penalty" ? isForced(item.penalty) : item.kind !== "glue"

const lineStarts = (items: readonly Item[]) => {
  const count = items.length
  const starts = new Int32Array(count + 1)
  let next = count
  for (let index = count - 1; index >= 0; index -= 1) {
    const item = items[index] as Item
    const carriesPost = item.kind === "discretionary" && item.postWidth !== 0
    starts[index + 1] = carriesPost ? index + 1 : next
    if (startsLine(item)) next = index
  }
  starts[0] = next
  return starts
}

const positiveGlueMean = (items: readonly Item[]) => {
  let mean = 0
  let count = 0
  for (const item of items) {
    if (item.kind !== "glue" || !(item.width > 0)) continue
    count += 1
    mean += (item.width - mean) / count
  }
  return mean
}

export const automaticStretch = (
  items: readonly Item[],
  width: number,
  count: number,
) => {
  if (count === 0) return 0
  const scaled = 12 * width
  if (Number.isFinite(scaled)) return scaled / count
  // Dividing first avoids overflow; preserve the original order for tiny terms.
  const mean = Number.isFinite(width) ? width / count : positiveGlueMean(items)
  return 12 * mean
}

const uniformShrink = (items: readonly Item[], flex: Flex | undefined) => {
  if (flex) return null
  let unit: number | undefined
  for (const item of items) {
    if (item.kind !== "glue") continue
    if (!isRenderedSpace(item)) {
      if (item.shrink !== 0) return null
      continue
    }
    if (!Number.isFinite(item.shrink)) return null
    if (unit !== undefined && item.shrink !== unit) return null
    unit = item.shrink
  }
  return unit ?? 0
}

export const prefixSums = (
  items: readonly Item[],
  flex: Flex | undefined,
): Sums => {
  const count = items.length
  const shrinkUnit = uniformShrink(items, flex)
  if (!flex && shrinkUnit !== null) {
    const exact = exactIntegerSums(items, shrinkUnit)
    if (exact) return exact
  }
  const width = new PrefixSum(count)
  const stretch = new PrefixSum(count)
  const shrink = shrinkUnit === null ? new PrefixSum(count) : null
  const spaces = [0]
  let glueWidth = 0
  let glueCount = 0
  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    const glue = item.kind === "glue"
    if (glue && item.width > 0) {
      glueWidth += item.width
      glueCount += 1
    }
    spaces[index + 1] =
      (spaces[index] as number) + Number(isRenderedSpace(item))
    width.add(passThroughWidth(item))
    stretch.add(glue ? item.stretch : 0)
    shrink?.add(glue ? item.shrink : 0)
    if (flex) {
      // A supplied sidecar disables uniform shrink certification.
      const flexShrink = shrink as PrefixSum
      addCapacity(stretch, flex.stretch, index, index + 1)
      addCapacity(flexShrink, flex.shrink, index, index + 1)
    }
    width.save(index + 1)
    stretch.save(index + 1)
    shrink?.save(index + 1)
  }
  return {
    width: width.values,
    stretch: stretch.values,
    shrink: shrink ? shrink.values : spaces,
    corrections: {
      width: width.correction((index) => [
        passThroughWidth(items[index] as Item),
      ]),
      stretch: stretch.correction((index) =>
        capacityTerms(items, flex?.stretch, index, "stretch"),
      ),
      shrink: shrink
        ? shrink.correction((index) =>
            capacityTerms(items, flex?.shrink, index, "shrink"),
          )
        : { kind: "uniform", unit: shrinkUnit as number },
    },
    spaces,
    starts: lineStarts(items),
    autoStretch: automaticStretch(items, glueWidth, glueCount),
  }
}

const capacityTerms = (
  items: readonly Item[],
  flex: Float64Array | undefined,
  index: number,
  side: "stretch" | "shrink",
) => {
  const item = items[index] as Item
  const value = item.kind === "glue" ? item[side] : 0
  return flex ? [value, ...flexTerms(flex, index, index + 1)] : [value]
}

/** Integer prefixes below 2^53 are exact; other inputs use compensated sums. */
const exactIntegerSums = (items: readonly Item[], shrinkUnit: number): Sums | null => {
  const width = [0], stretch = [0], spaces = [0]
  let w = 0, t = 0, n = 0, glueWidth = 0, glueCount = 0
  for (let index = 0; index < items.length; index++) {
    const item = items[index] as Item
    const advance = passThroughWidth(item)
    const capacity = item.kind === "glue" ? item.stretch : 0
    if (!Number.isSafeInteger(advance) || !Number.isSafeInteger(capacity)) return null
    w += advance
    t += capacity
    if (!Number.isSafeInteger(w) || !Number.isSafeInteger(t)) return null
    n += Number(isRenderedSpace(item))
    width[index + 1] = w
    stretch[index + 1] = t
    spaces[index + 1] = n
    if (item.kind === "glue" && item.width > 0) {
      glueWidth += item.width
      glueCount++
    }
  }
  return { integerGeometry: true, width, stretch, shrink: spaces, spaces,
    corrections: { width: null, stretch: null, shrink: { kind: "uniform", unit: shrinkUnit } },
    starts: lineStarts(items), autoStretch: automaticStretch(items, glueWidth, glueCount) }
}
