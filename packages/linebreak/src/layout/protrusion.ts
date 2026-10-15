import { latinProtrusion, protrusionCode } from "../text/protrusion"
import { type Item, lineEndWidth } from "./items"

export type Advance = (character: string) => number

const hangOf = (character: string, side: "l" | "r", advance: Advance) => {
  const code = protrusionCode(latinProtrusion, character, side)
  return code === 0 ? 0 : (code / 1000) * advance(character)
}

// This Latin table contains only single UTF-16 code units. Empty strings and
// surrogate halves have no entry, so both receive zero credit without probing.
export const startHang = (text: string, advance: Advance) =>
  hangOf(text.charAt(0), "l", advance)

export const endHang = (text: string, advance: Advance) =>
  hangOf(text.slice(-1), "r", advance)

export const hyphenHang = (drawnWidth: number) =>
  (protrusionCode(latinProtrusion, "-", "r") / 1000) * drawnWidth

export type Hangs = {
  readonly start: Float64Array
  readonly end: Float64Array
}

const endHangs = (
  items: readonly Item[],
  endOf: ReadonlyMap<number, number>,
) => {
  const end = new Float64Array(items.length)
  let carried = 0
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as Item
    end[index] = lineEndWidth(item) > 0 ? (endOf.get(index) ?? 0) : carried
    if (item.kind === "box") carried = endOf.get(index) ?? 0
  }
  return end
}

const startHangs = (
  items: readonly Item[],
  startOf: ReadonlyMap<number, number>,
) => {
  const start = new Float64Array(items.length + 1)
  let next = 0
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if ((items[index] as Item).kind === "box") next = startOf.get(index) ?? 0
    start[index] = next
  }
  return start
}

export const buildHangs = (
  items: readonly Item[],
  startOf: ReadonlyMap<number, number>,
  endOf: ReadonlyMap<number, number>,
): Hangs => ({
  start: startHangs(items, startOf),
  end: endHangs(items, endOf),
})
