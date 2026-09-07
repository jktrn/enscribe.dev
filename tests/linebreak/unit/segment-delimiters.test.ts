import { expect, test } from "bun:test"
import { createMetrics, segmentText } from "@linebreak/text"

test.each([
  ["form feed", "\f"],
  ["en space", "\u2002"],
  ["thin space", "\u2009"],
])("%s remains a measured, breakable space", (_name, separator) => {
  const text = `a${separator}b`
  const metrics = createMetrics({ measure: (value) => value.length * 10 })
  expect(metrics.measureParagraph(text)?.segments).toEqual([
    { text: "a", start: 0, end: 1, kind: "text", width: 10, lineEndWidth: 0 },
    { text: separator, start: 1, end: 2, kind: "space", width: 10, lineEndWidth: 0 },
    { text: "b", start: 2, end: 3, kind: "text", width: 10, lineEndWidth: 0 },
  ])
})

test("a horizontal bar separates words and retains following punctuation", () => {
  expect(segmentText("alpha―beta")).toEqual([
    { text: "alpha", start: 0, end: 5, kind: "text" },
    { text: "―", start: 5, end: 6, kind: "text" },
    { text: "beta", start: 6, end: 10, kind: "text" },
  ])
  expect(segmentText("alpha―)").map(({ text }) => text)).toEqual(["alpha", "―)"])
})

test("provider metrics expose default and explicit font and spacing metadata", () => {
  const measure = (text: string) => text.length
  expect(createMetrics({ measure }).font).toBe("")
  expect(createMetrics({ measure, font: "16px serif" }).font).toBe("16px serif")
  expect(createMetrics({ measure }).letterSpacing).toBe(0)
  for (const letterSpacing of [-0.5, 0, 0.25]) {
    const metrics = createMetrics({ measure, letterSpacing })
    expect(metrics.letterSpacing).toBe(letterSpacing)
    expect(metrics.measureRun("ab")).toBe(2)
  }
})
