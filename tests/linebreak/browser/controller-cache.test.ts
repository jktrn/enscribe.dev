import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import { createMetrics } from "@linebreak/text/segments"
import * as measurement from "@linebreak/dom/measure-dom"
import { browserFixture, paragraph } from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

test.each([
  "font",
  "letterSpacing",
  "locale",
])("changing %s invalidates compiled measurements", (property) => {
  const p = paragraph()
  const engine = createLinebreaker()
  engine.typeset([p])
  engine.restore([p])
  if (property === "font") p.style.font = "18px sans-serif"
  if (property === "letterSpacing") p.style.letterSpacing = "1px"
  if (property === "locale") p.lang = "de"
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(measurement.metricsForStyle).toHaveBeenCalledTimes(2)
  engine.dispose()
})

test("unchanged restored content reuses the compiled measurements", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  engine.typeset([p])
  engine.restore([p])
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(measurement.metricsForStyle).toHaveBeenCalledOnce()
  engine.dispose()
})

test("reset after font loading produces the same layout as a fresh controller", () => {
  const p = paragraph(),
    fresh = paragraph()
  const engine = createLinebreaker()
  engine.typeset([p])
  vi.mocked(measurement.metricsForStyle).mockImplementation(
    (_doc, _style, font, letterSpacing) =>
      createMetrics({
        font,
        letterSpacing,
        measure: (text) => text.length * 12,
      }),
  )
  engine.reset([p])
  const expected = createLinebreaker().typeset([fresh])[0]
  const actual = engine.typeset([p])[0]
  expect(actual?.status).toBe("typeset")
  expect(expected?.status).toBe("typeset")
  if (actual?.status === "typeset" && expected?.status === "typeset") {
    expect(actual.lines).toBe(expected.lines)
  }
  expect(engine.stats().cachedFonts).toBe(1)
  engine.dispose()
})

test("a shared width shift is recognized for a batch of two", () => {
  const p = [paragraph(), paragraph()]
  const engine = createLinebreaker()
  const drafts = engine.compose(p)
  for (const element of p) element.style.width = "310px"
  expect(engine.apply(drafts).map((o) => o.status)).toEqual([
    "typeset",
    "typeset",
  ])
  engine.dispose()
})

test("the median batch shift tolerates a single unsorted outlier", () => {
  const p = [paragraph(), paragraph(), paragraph(), paragraph()]
  const engine = createLinebreaker()
  const drafts = engine.compose(p)
  const widths = [310, 350, 310, 310]
  p.forEach((element, i) => {
    element.style.width = `${widths[i]}px`
  })
  expect(engine.apply(drafts).map((o) => o.status)).toEqual([
    "typeset",
    "failed",
    "typeset",
    "typeset",
  ])
  engine.dispose()
})

test("exactly half a pixel of width drift is accepted", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const drafts = engine.compose([p])
  p.style.width = "300.5px"
  expect(engine.apply(drafts)[0]?.status).toBe("typeset")
  engine.dispose()
})

test("declined outcomes are counted once alongside skipped outcomes", () => {
  const p = paragraph(),
    short = paragraph("short")
  p.style.direction = "rtl"
  const engine = createLinebreaker()
  const outcomes = engine.typeset([p, short])
  expect(outcomes.map((o) => o.status)).toEqual(["declined", "skipped"])
  expect(engine.stats()).toMatchObject({
    declined: 1,
    skipped: 1,
    failed: 0,
    typeset: 0,
  })
  engine.dispose()
})

test("language changes make a pending draft stale even if the text is unchanged", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const drafts = engine.compose([p])
  p.lang = "fr"
  expect(() => engine.apply(drafts)).toThrow("stale")
  engine.dispose()
})

test("a missing composition is rejected with the public ownership diagnostic", () => {
  expect(() => createLinebreaker().apply([undefined as never])).toThrow(
    "foreign composition",
  )
})
