import { latinProtrusion, protrusionCode } from "../text/protrusion"
import { type Item, lineEndWidth } from "./items"

export type Advance = (character: string) => number

const firstCharacter = (text: string) => {
  for (const character of text) return character
  return ""
}

const lastCharacter = (text: string) => {
  let last = ""
  for (const character of text) last = character
  return last
}

const hangOf = (character: string, side: "l" | "r", advance: Advance) => {
  const code = protrusionCode(latinProtrusion, character, side)
  return code === 0 ? 0 : (code / 1000) * advance(character)
}

export const startHang = (text: string, advance: Advance) =>
  text.length === 0 ? 0 : hangOf(firstCharacter(text), "l", advance)

export const endHang = (text: string, advance: Advance) =>
  text.length === 0 ? 0 : hangOf(lastCharacter(text), "r", advance)

export const hyphenHang = (drawnWidth: number) =>
  drawnWidth === 0
    ? 0
    : (protrusionCode(latinProtrusion, "-", "r") / 1000) * drawnWidth

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
