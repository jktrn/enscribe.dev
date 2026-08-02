import { type Item, lineEndWidth } from "./items"

export type Hangs = {
  readonly start: Float64Array
  readonly end: Float64Array
}

export const buildHangs = (
  items: readonly Item[],
  startOf: ReadonlyMap<number, number>,
  endOf: ReadonlyMap<number, number>,
): Hangs => {
  const count = items.length

  const end = new Float64Array(count)
  let carried = 0
  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    end[index] = lineEndWidth(item) > 0 ? (endOf.get(index) ?? 0) : carried
    if (item.kind === "box") carried = endOf.get(index) ?? 0
  }

  const start = new Float64Array(count + 1)
  let next = 0
  for (let index = count - 1; index >= 0; index -= 1) {
    if ((items[index] as Item).kind === "box") next = startOf.get(index) ?? 0
    start[index] = next
  }

  return { start, end }
}
