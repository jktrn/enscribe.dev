import { expect, test } from "bun:test"
import {
  box,
  glue,
  penalty,
  paragraphEnd,
  discretionary,
  breakParagraphOnce,
  type Item,
} from "@linebreak/layout"

const slices = (items: Item[], width = 10) => {
  const result = breakParagraphOnce(items, width, { tolerance: 0 })
  if (!result.ok) throw new Error("Expected exact-width source slices.")
  return result.lines.map((line) => [line.sourceStart, line.sourceEnd])
}

test("selected glue starts the next slice before any later discarded source", () => {
  expect(
    slices([
      box(10, { start: 0, end: 1 }),
      glue(3, 0, 0, { start: 1, end: 2 }),
      glue(3, 0, 0, { start: 2, end: 3 }),
      box(10, { start: 3, end: 4 }),
      penalty(-10000, { source: { start: 4, end: 4 } }),
    ]),
  ).toEqual([
    [0, 1],
    [2, 4],
  ])
})

test("multiple WBR choices preserve the invisible source between real boxes", () => {
  expect(
    slices([
      box(10, { start: 0, end: 1 }),
      penalty(0, { source: { start: 1, end: 1 } }),
      penalty(0, { source: { start: 2, end: 2 } }),
      box(10, { start: 3, end: 4 }),
      penalty(-10000, { source: { start: 5, end: 5 } }),
    ]),
  ).toEqual([
    [0, 1],
    [1, 5],
  ])
})

test("a discretionary continuation uses its split offset rather than the source end", () => {
  expect(
    slices([
      box(8, { start: 0, end: 2 }),
      discretionary({
        preWidth: 2,
        breakOffset: 3,
        source: { start: 2, end: 9 },
      }),
      box(10, { start: 4, end: 5 }),
      penalty(-10000, { source: { start: 5, end: 5 } }),
    ]),
  ).toEqual([
    [0, 3],
    [3, 5],
  ])
})

test("authored breaks own their marker while the next slice retains following invisible source", () => {
  expect(
    slices([
      box(10, { start: 0, end: 1 }),
      penalty(-10000, { source: { start: 1, end: 2 } }),
      box(10, { start: 3, end: 4 }),
      penalty(-10000, { source: { start: 4, end: 4 } }),
    ]),
  ).toEqual([
    [0, 1],
    [2, 4],
  ])
})

test("leading and trailing source-only material belongs to the first and final slices", () => {
  expect(
    slices([
      penalty(10000),
      penalty(10000, { source: { start: 5, end: 6 } }),
      box(10, { start: 7, end: 8 }),
      penalty(-10000, { source: { start: 9, end: 9 } }),
    ]),
  ).toEqual([[5, 9]])
})

test("an unsourced breakpoint still falls back to retained source instead of inventing zero", () => {
  expect(
    slices([
      box(10, { start: 5, end: 6 }),
      penalty(0),
      box(10, { start: 7, end: 8 }),
      penalty(-10000),
    ]),
  ).toEqual([
    [5, 6],
    [7, 8],
  ])
})

test("partial source metadata keeps a known continuation offset when the line end is unsourced", () => {
  expect(
    slices([
      box(10),
      penalty(-10000, { source: { start: 0, end: 1 } }),
      box(10),
      ...paragraphEnd(0),
    ]),
  ).toEqual([
    [0, 0],
    [1, 1],
  ])
})

test("a leading authored forced marker starts its continuation after the marker", () => {
  expect(
    slices([
      penalty(-10000, { source: { start: 1, end: 2 } }),
      box(10, { start: 3, end: 4 }),
      penalty(-10000, { source: { start: 4, end: 4 } }),
    ]),
  ).toEqual([
    [1, 1],
    [2, 4],
  ])
})
