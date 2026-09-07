import { breakParagraphOnce } from "@linebreak/layout/breaker"
import {
  type Discretionary,
  type Item,
  paragraphEnd,
} from "@linebreak/layout/items"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"

export const SPACE = 10
export const WORD = 25
export const MEASURE = 400

export const source = { start: 0, end: 0 }

export const box = (width: number): Item => ({ kind: "box", width, source })

export const glue = (shrinkRatio = defaultGlue.shrink): Item => ({
  kind: "glue",
  width: SPACE,
  stretch: SPACE * defaultGlue.stretch,
  shrink: SPACE * shrinkRatio,
  source: { start: 0, end: 1 },
})

export const finish = () => paragraphEnd(0)

export const paragraph = (widths: number[]): Item[] => {
  const items: Item[] = []
  for (const [index, width] of widths.entries()) {
    if (index > 0) items.push(glue())
    items.push(box(width))
  }
  return [...items, ...finish()]
}

export const evenWords = (count: number) =>
  paragraph(Array.from({ length: count }, () => WORD))

export const wordsWithPenaltyAt = (count: number, at: number): Item[] => {
  const items: Item[] = []
  for (let index = 0; index < count; index += 1) {
    if (index > 0) items.push(glue())
    items.push(box(WORD))
    if (index !== at) continue
    items.push({
      kind: "penalty",
      width: 0,
      penalty: 0,
      flagged: false,
      source,
    })
    items.push(box(WORD))
  }
  return items
}

export const glueBetween = (
  items: readonly Item[],
  from: number,
  to: number,
) => {
  let count = 0
  for (let index = from; index < to; index += 1) {
    if (items[index]?.kind === "glue") count += 1
  }
  return count
}

export const strictPass = (
  items: readonly Item[],
  measure = MEASURE,
  force = false,
) =>
  breakParagraphOnce(items, measure, {
    tolerance: texDefaults.pretolerance,
    force,
  })

export const discretionary = (
  overrides: Partial<Discretionary> = {},
): Discretionary => ({
  kind: "discretionary",
  preWidth: 43,
  postWidth: 50,
  noBreakWidth: 90,
  penalty: texDefaults.hyphenPenalty,
  hyphen: true,
  source,
  breakOffset: 0,
  ...overrides,
})
