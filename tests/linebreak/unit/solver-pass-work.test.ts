import { expect, test } from "bun:test"
import {
  box,
  penalty,
  breakParagraph,
  breakParagraphOnce,
  prepareParagraph,
  type PreparedLayoutOptions,
  type LayoutPass,
} from "@linebreak/layout"

test("pass diagnostics count actual solver attempts including unsuccessful retries", () => {
  const cases: Array<{
    width: number
    boxWidth: number
    options: PreparedLayoutOptions
    attempts: number
    pass: LayoutPass
  }> = [
    { width: 10, boxWidth: 10, options: {}, attempts: 1, pass: "pretolerance" },
    {
      width: 10,
      boxWidth: 10,
      options: { policy: { pretolerance: -1 } },
      attempts: 1,
      pass: "tolerance",
    },
    {
      width: 10,
      boxWidth: 1,
      options: { emergencyStretch: 9 },
      attempts: 3,
      pass: "emergency",
    },
    {
      width: 10,
      boxWidth: 1,
      options: { emergencyStretch: 9, policy: { pretolerance: -1 } },
      attempts: 2,
      pass: "emergency",
    },
    {
      width: 10,
      boxWidth: 1,
      options: { emergencyStretch: 0 },
      attempts: 3,
      pass: "forced",
    },
    {
      width: 10,
      boxWidth: 1,
      options: { emergencyStretch: 0, lastLineMinWidth: 0.5 },
      attempts: 5,
      pass: "forced",
    },
  ]
  for (const entry of cases) {
    const diagnostics = {
      evaluatedLines: 0,
      peakActiveNodes: 0,
      attemptedPasses: 99,
    }
    const items = [box(entry.boxWidth), penalty(-10000)]
    const prepared = prepareParagraph(items)
    for (const run of [
      () =>
        breakParagraph(items, entry.width, { ...entry.options, diagnostics }),
      () =>
        prepared.breakParagraph(entry.width, { ...entry.options, diagnostics }),
    ]) {
      const result = run()
      expect(result.ok && result.pass).toBe(entry.pass)
      expect(diagnostics.attemptedPasses).toBe(entry.attempts)
    }
    expect(
      breakParagraphOnce(items, entry.width, {
        tolerance: 100,
        force: true,
        diagnostics,
      }).ok,
    ).toBe(true)
    expect(diagnostics.attemptedPasses).toBe(1)
  }
})

test("empty input and invalid measures do not count as attempted search passes", () => {
  const diagnostics = {
    evaluatedLines: 0,
    peakActiveNodes: 0,
    attemptedPasses: 99,
  }
  expect(breakParagraph([], 10, { diagnostics }).ok).toBe(false)
  expect(diagnostics.attemptedPasses).toBe(0)
  expect(breakParagraph([box(1), penalty(-10000)], 0, { diagnostics }).ok).toBe(
    false,
  )
  expect(diagnostics.attemptedPasses).toBe(0)
})
