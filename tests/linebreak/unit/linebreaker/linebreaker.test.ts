import { describe, expect, test } from "bun:test"
import { optimizeParagraph } from "@linebreak/layout/knuth-plass"
import {
  type BreakOpportunity,
  ParagraphLineModel,
  type PreparedParagraph,
} from "@linebreak/layout/line-model"
import { optimizeMeasurement } from "@linebreak/linebreaker/plan"

const segments = ["aa", " ", "bb", " ", "cc", " ", "dd", " ", "ee"]

const measurement = () => {
  let sourceOffset = 0
  const prepared: PreparedParagraph = {
    segments: segments.map((text) => {
      const sourceStart = sourceOffset
      sourceOffset += text.length
      const breakAfter: BreakOpportunity =
        text === " " ? { kind: "space" } : { kind: "none" }
      return {
        text,
        sourceStart,
        sourceEnd: sourceOffset,
        width: [...text].length * 10,
        edgeWidth: 0,
        discretionaryHyphenWidth: 5,
        breakAfter,
      }
    }),
  }
  return { paragraph: new ParagraphLineModel(prepared) }
}

const countedOptimizer = () => {
  let calls = 0
  const optimize: typeof optimizeParagraph = (...arguments_) => {
    calls += 1
    return optimizeParagraph(...arguments_)
  }
  return { optimize, calls: () => calls }
}

describe("per-paragraph optimization cache", () => {
  test("reuses only the last exact width", () => {
    const cached = measurement()
    const counter = countedOptimizer()

    const first = optimizeMeasurement(cached, 55, counter.optimize)
    const repeated = optimizeMeasurement(cached, 55, counter.optimize)
    expect(first).toEqual(optimizeParagraph(measurement().paragraph, 55))
    expect(repeated).toBe(first)
    expect(counter.calls()).toBe(1)

    const resized = optimizeMeasurement(cached, 75, counter.optimize)
    expect(resized).toEqual(optimizeParagraph(measurement().paragraph, 75))
    expect(resized).not.toBe(first)
    expect(counter.calls()).toBe(2)

    const restored = optimizeMeasurement(cached, 55, counter.optimize)
    expect(restored).toEqual(first)
    expect(restored).not.toBe(first)
    expect(counter.calls()).toBe(3)
  })

  test("caches an infeasible result", () => {
    const cached = measurement()
    const counter = countedOptimizer()

    expect(optimizeMeasurement(cached, 60, counter.optimize)).toBeNull()
    expect(optimizeMeasurement(cached, 60, counter.optimize)).toBeNull()
    expect(counter.calls()).toBe(1)
  })

  test("does not share results across paragraphs", () => {
    const counter = countedOptimizer()
    const first = optimizeMeasurement(measurement(), 55, counter.optimize)
    const fresh = optimizeMeasurement(measurement(), 55, counter.optimize)

    expect(fresh).toEqual(first)
    expect(fresh).not.toBe(first)
    expect(counter.calls()).toBe(2)
  })
})
