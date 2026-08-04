import type { Item } from "./items"

export type Flex = {
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
  const stretch = new Float64Array(count + 1)
  const shrink = new Float64Array(count + 1)

  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    const width = item.kind === "box" && !uncredited.has(index) ? item.width : 0
    stretch[index + 1] = (stretch[index] as number) + width * up
    shrink[index + 1] = (shrink[index] as number) + width * down
  }

  return { stretch, shrink }
}

export const pooledFlex = (first: Flex, second: Flex): Flex => {
  const count = first.stretch.length
  const stretch = new Float64Array(count)
  const shrink = new Float64Array(count)

  for (let index = 0; index < count; index += 1) {
    stretch[index] =
      (first.stretch[index] as number) + (second.stretch[index] as number)
    shrink[index] =
      (first.shrink[index] as number) + (second.shrink[index] as number)
  }

  return { stretch, shrink }
}

export const flexBetween = (flex: Flex, start: number, end: number) => ({
  stretch: (flex.stretch[end] as number) - (flex.stretch[start] as number),
  shrink: (flex.shrink[end] as number) - (flex.shrink[start] as number),
})
