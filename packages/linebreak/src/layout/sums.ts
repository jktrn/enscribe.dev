import type { Flex } from "./flex"
import { type Item, passThroughWidth } from "./items"

export type Sums = {
  readonly width: readonly number[]
  readonly stretch: readonly number[]
  readonly shrink: readonly number[]
  readonly starts: Int32Array
}

type Cached = {
  readonly flex: Flex | undefined
  readonly sums: Sums
}

const sumsCache = new WeakMap<readonly Item[], Cached>()

const lineStarts = (items: readonly Item[]) => {
  const count = items.length
  const starts = new Int32Array(count + 1)
  let next = count
  for (let index = count - 1; index >= 0; index -= 1) {
    const kind = (items[index] as Item).kind
    starts[index + 1] = kind === "discretionary" ? index + 1 : next
    if (kind === "box" || kind === "discretionary") next = index
  }
  starts[0] = next
  return starts
}

const plainSums = (items: readonly Item[]): Sums => {
  const count = items.length
  const width = new Array<number>(count + 1)
  const stretch = new Array<number>(count + 1)
  const shrink = new Array<number>(count + 1)
  width[0] = 0
  stretch[0] = 0
  shrink[0] = 0
  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    const glue = item.kind === "glue"
    width[index + 1] = (width[index] as number) + passThroughWidth(item)
    stretch[index + 1] = (stretch[index] as number) + (glue ? item.stretch : 0)
    shrink[index + 1] = (shrink[index] as number) + (glue ? item.shrink : 0)
  }
  return { width, stretch, shrink, starts: lineStarts(items) }
}

const flexedSums = (items: readonly Item[], flex: Flex): Sums => {
  const { stretch: up, shrink: down } = flex
  const count = items.length
  const width = new Array<number>(count + 1)
  const stretch = new Array<number>(count + 1)
  const shrink = new Array<number>(count + 1)
  width[0] = 0
  stretch[0] = 0
  shrink[0] = 0
  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    const glue = item.kind === "glue"
    width[index + 1] = (width[index] as number) + passThroughWidth(item)
    stretch[index + 1] =
      (stretch[index] as number) +
      (glue ? item.stretch : 0) +
      ((up[index + 1] as number) - (up[index] as number))
    shrink[index + 1] =
      (shrink[index] as number) +
      (glue ? item.shrink : 0) +
      ((down[index + 1] as number) - (down[index] as number))
  }
  return { width, stretch, shrink, starts: lineStarts(items) }
}

export const prefixSums = (items: readonly Item[], flex: Flex | undefined): Sums => {
  const cached = sumsCache.get(items)
  if (cached && cached.flex === flex) return cached.sums

  const sums = flex ? flexedSums(items, flex) : plainSums(items)
  sumsCache.set(items, { flex, sums })
  return sums
}
