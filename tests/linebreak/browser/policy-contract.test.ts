import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import * as measurement from "@linebreak/dom/measure-dom"
import { browserFixture, paragraph, PROSE } from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

test("a custom character limit declines a longer paragraph before shaping", () => {
  const source = paragraph("alpha beta")
  const original = source.innerHTML
  const engine = createLinebreaker({ maximumCharacters: 5 })
  expect(engine.typeset([source])[0]).toMatchObject({
    status: "declined",
    reason: "too-long",
  })
  expect(source.innerHTML).toBe(original)
  expect(measurement.metricsForStyle).not.toHaveBeenCalled()
})

test("the exact custom limit accepts text after authored whitespace collapse", () => {
  const source = paragraph(`  ${PROSE.replace(" ", " \n ")}  `)
  const engine = createLinebreaker({ maximumCharacters: PROSE.length })
  expect(engine.typeset([source])[0]).toMatchObject({ status: "typeset" })
  expect(source.textContent).toBe(PROSE)
})
