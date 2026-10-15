import type { Item } from "./items"
import { PrefixSum } from "./numeric/prefix"
import {
  capacityBetween,
  correctedCapacity,
  pooledCapacity,
} from "./numeric/flex"

export type Flex = {
  // Builder arrays retain exact sums at untouched endpoints. Writing a changed
  // endpoint gives that cell its current binary64 value; other cells retain
  // their precision. Prepared paragraphs snapshot both values and corrections.
  readonly stretch: Float64Array
  readonly shrink: Float64Array
}

export const budgetFlex = (
  items: readonly Item[],
  up: number,
  down: number,
  uncredited: ReadonlySet<number>,
): Flex => {
  const count = items.length
  const stretch = new PrefixSum(count)
  const shrink = new PrefixSum(count)
  const widthAt = (index: number) => {
    const item = items[index] as Item
    return item.kind === "box" && !uncredited.has(index) ? item.width : 0
  }

  for (let index = 0; index < count; index += 1) {
    const width = widthAt(index)
    stretch.add(width * up)
    shrink.add(width * down)
    stretch.save(index + 1)
    shrink.save(index + 1)
  }

  return {
    stretch: correctedCapacity(
      Float64Array.from(stretch.values),
      stretch.correction((index) => [widthAt(index) * up]),
    ),
    shrink: correctedCapacity(
      Float64Array.from(shrink.values),
      shrink.correction((index) => [widthAt(index) * down]),
    ),
  }
}

export const pooledFlex = (first: Flex, second: Flex): Flex => ({
  stretch: pooledCapacity(first.stretch, second.stretch),
  shrink: pooledCapacity(first.shrink, second.shrink),
})

export const flexBetween = (flex: Flex, start: number, end: number) => ({
  stretch: capacityBetween(flex.stretch, start, end),
  shrink: capacityBetween(flex.shrink, start, end),
})
