import { expect, test } from "bun:test"
import { box, glue, paragraphEnd, penalty } from "@linebreak/layout"
import { enumerateOptima, regret } from "../../../packages/linebreak/benchmarks/solver-optimality"
import { scoreBreaks, solverFixture } from "../../../packages/linebreak/benchmarks/solver-data"

test("exhaustive benchmark finds the unique two-line zero-badness plan", () => {
  const items = [box(5), glue(0, 10, 0), box(5), glue(0, 10, 0),
    box(5), glue(0, 10, 0), box(5), ...paragraphEnd()]
  const result = enumerateOptima(items, 10, 800)
  expect(result.complete).toBe(true)
  expect(result.completePlans).toBe(1)
  expect(result.optima.continuous?.breaks).toEqual([3, 9])
  expect(result.optima.integer?.breaks).toEqual([3, 9])
  expect(result.optima.continuous?.score.demerits).toBe(200)
  expect(result.optima.joint).toHaveLength(1)
  expect(regret(scoreBreaks(items, [3, 9], 10, 800), result)).toEqual({
    continuous: 0, integer: 0, jointlyFeasible: true, pareto: true,
  })
})

test("mandatory boundaries cannot be skipped by exhaustive enumeration", () => {
  const items = [box(10), penalty(-10000), box(10), ...paragraphEnd()]
  const result = enumerateOptima(items, 10, 800)
  expect(result.completePlans).toBe(1)
  expect(result.optima.continuous?.breaks).toEqual([1, 5])
})

test("a stopped enumeration cannot produce an optimality verdict", () => {
  const items = [box(10), ...paragraphEnd()]
  const result = enumerateOptima(items, 10, 800, 0)
  expect(result.complete).toBe(false)
  expect(result.prefixes).toBe(0)
  expect(result.completePlans).toBe(0)
  expect(regret(scoreBreaks(items, [3], 10, 800), result)).toBe(null)
})

test("enumeration rejects invalid prefix budgets", () => {
  for (const budget of [-1, 0.5, NaN, Infinity, -Infinity]) {
    expect(() => enumerateOptima([], 10, 800, budget)).toThrow(RangeError)
  }
})

test("a zero budget can certify that there are no legal endpoints", () => {
  expect(enumerateOptima([], 10, 800, 0)).toEqual({
    complete: true, prefixes: 0, completePlans: 0,
    optima: { continuous: null, integer: null, joint: [] },
  })
})

test("using the final budget slot does not truncate an exhausted search", () => {
  const result = enumerateOptima([box(10), ...paragraphEnd()], 10, 800, 1)
  expect(result.complete).toBe(true)
  expect(result.prefixes).toBe(1)
  expect(result.completePlans).toBe(1)
})

test("a prefix limit suppresses rankings even after finding a complete plan", () => {
  const items = [box(10), glue(0, 10, 0), box(10), ...paragraphEnd()]
  const truncated = enumerateOptima(items, 10, 800, 2)
  expect(truncated.complete).toBe(false)
  expect(truncated.prefixes).toBe(2)
  expect(truncated.completePlans).toBe(1)
  expect(regret(scoreBreaks(items, [1, 5], 10, 800), truncated)).toBe(null)
  const complete = enumerateOptima(items, 10, 800, 3)
  expect(complete.complete).toBe(true)
  expect(complete.prefixes).toBe(3)
  expect(complete.optima).toEqual(truncated.optima)
})

for (const [seed, continuousBreaks, integerBreaks] of [
  [230, [9, 19, 27, 37], [11, 21, 31, 37]],
  [707, [11, 21, 31, 37], [11, 21, 29, 37]],
] as const) {
  test(`distinct objective optima both remain on the complete Pareto frontier (${seed})`, () => {
    const { linebreak: items } = solverFixture(18, seed, "elastic")
    const result = enumerateOptima(items, 180, 800)
    expect(result.complete).toBe(true)
    expect(result.optima.continuous?.breaks).toEqual(continuousBreaks)
    expect(result.optima.integer?.breaks).toEqual(integerBreaks)
    expect(result.optima.joint).toHaveLength(2)
    const first = regret(scoreBreaks(items, continuousBreaks, 180, 800), result)
    const second = regret(scoreBreaks(items, integerBreaks, 180, 800), result)
    expect(first?.continuous).toBe(0)
    expect(first?.integer).toBeGreaterThan(0)
    expect(second?.integer).toBe(0)
    expect(second?.continuous).toBeGreaterThan(0)
    expect(first?.pareto).toBe(true)
    expect(second?.pareto).toBe(true)
  })
}
