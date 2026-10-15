import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import * as rendering from "@linebreak/dom/render"
import { browserFixture, paragraph } from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

test("statistics count the complete applied batch before a reporting callback throws", () => {
  const narrow = paragraph("narrow", 100)
  const unsupported = paragraph()
  unsupported.style.direction = "rtl"
  const anotherNarrow = paragraph("also narrow", 100)
  const problem = new Error("reporter stopped")
  const report = vi.fn(() => {
    throw problem
  })
  const engine = createLinebreaker({ onOutcome: report })
  const pending = engine.compose([narrow, unsupported, anotherNarrow])
  expect(() => engine.apply(pending)).toThrow(problem)
  expect(report).toHaveBeenCalledTimes(1)
  expect(engine.stats()).toMatchObject({
    skipped: 2,
    declined: 1,
    typeset: 0,
    failed: 0,
  })
  expect(() => engine.apply(pending)).toThrow("already applied")
})

test("remembered failure outcomes contribute to the same counters as fresh failures", () => {
  const p = paragraph()
  const problem = new Error("cannot render")
  const render = vi.spyOn(rendering, "renderLines").mockImplementation(() => {
    throw problem
  })
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "failed",
    reason: "render-failed",
    cause: problem,
  })
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "failed",
    reason: "render-failed",
  })
  expect(render).toHaveBeenCalledTimes(1)
  expect(engine.stats().failed).toBe(2)
})
