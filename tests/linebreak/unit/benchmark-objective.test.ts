import { expect, test } from "bun:test"
import { box, glue, penalty } from "@linebreak/layout"
import { scoreBreaks } from "../../../packages/linebreak/benchmarks/solver-data"

test("the independent score distinguishes continuous and integer half-stretch badness", () => {
  const score = scoreBreaks(
    [box(100), glue(0, 100, 0), penalty(-10000)],
    [2],
    150,
  )
  expect(score.demerits).toBe(506.25)
  expect(score.integerDemerits).toBe(484)
  expect(score.infeasibleLines).toBe(0)
  expect(score.integerInfeasibleLines).toBe(0)
})

test("perfect rigid lines have zero badness under both conventions", () => {
  const score = scoreBreaks([box(100), penalty(-10000)], [1], 100)
  expect(score.demerits).toBe(100)
  expect(score.integerDemerits).toBe(100)
})

test("the independent score retains infeasible lines and crossed mandatory breaks", () => {
  const score = scoreBreaks(
    [box(100), penalty(-10000), box(100), penalty(-10000)],
    [3],
    150,
  )
  expect(score.demerits).toBe(100_000_000)
  expect(score.integerDemerits).toBe(100_000_000)
  expect(score.infeasibleLines).toBe(1)
  expect(score.integerInfeasibleLines).toBe(1)
  expect(score.crossedForcedBreaks).toBe(1)
  expect(score.terminal).toBe(true)
})

test("illegal, duplicate, backwards and noninteger endpoints cannot qualify", () => {
  const items = [box(100), penalty(-10000)]
  for (const breaks of [[0, 1], [1, 1], [1, 0], [-1, 1], [0.5, 1], [Infinity, 1]]) {
    expect(scoreBreaks(items, breaks, 100).invalidBreaks).toBeGreaterThan(0)
  }
})

test("nonfinite primitive geometry cannot qualify through a capped cost", () => {
  for (const width of [NaN, Infinity]) {
    expect(scoreBreaks([box(width), penalty(-10000)], [1], 100).nonfiniteLines).toBe(1)
  }
  expect(scoreBreaks([box(100), penalty(-10000)], [1], NaN).nonfiniteLines).toBe(1)
})
