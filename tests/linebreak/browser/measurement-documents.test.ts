import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import { createMetrics } from "@linebreak/text/segments"
import * as metrics from "@linebreak/dom/measure-dom"
import * as rendering from "@linebreak/dom/render"
import { browserFixture, paragraph, PROSE } from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

const otherDocument = () => {
  const doc = document.implementation.createHTMLDocument()
  doc.body.append(document.querySelector("style")!.cloneNode(true))
  return doc
}

const otherParagraph = (doc: Document, text = PROSE) => {
  const element = doc.createElement("p")
  element.style.width = "300px"
  element.textContent = text
  doc.body.append(element)
  return element
}

test("identical font names in different documents keep their own measured widths", () => {
  const doc = otherDocument()
  vi.mocked(metrics.metricsForStyle).mockImplementation((owner, _style, font, letterSpacing) =>
    createMetrics({ font, letterSpacing, measure: (text) => text.length * (owner === doc ? 16 : 8) }))
  const isolated = createLinebreaker({ protrude: false })
  const expected = isolated.compose([otherParagraph(doc)])[0]!
  expect(expected.status).toBe("ready")
  const shared = createLinebreaker({ protrude: false })
  const [first, second] = shared.compose([paragraph(), otherParagraph(doc)])
  expect(first!.status).toBe("ready")
  expect(second!.status).toBe("ready")
  expect(second!.lines).toBe(expected.lines)
  expect(second!.lines).toBeGreaterThan(first!.lines)
  expect(shared.stats().cachedFonts).toBe(2)
  shared.compose([otherParagraph(doc), paragraph()])
  expect(shared.stats().cachedFonts).toBe(2)
  isolated.dispose()
  shared.dispose()
  expect(shared.stats().cachedFonts).toBe(0)
})

test("font-change witnesses compare only the requested document", () => {
  const doc = otherDocument()
  let foreignAdvance = 16
  vi.mocked(metrics.currentAdvance).mockImplementation((owner, _font, text) =>
    text.length * (owner === doc ? foreignAdvance : 8))
  const engine = createLinebreaker({ protrude: false })
  engine.compose([paragraph("alpha beta"), otherParagraph(doc, "gamma delta")])
  expect(engine.fontsMoved(document)).toBe(false)
  expect(engine.fontsMoved(doc)).toBe(false)
  expect(engine.fontsMoved(otherDocument())).toBe(false)
  foreignAdvance = 17
  expect(engine.fontsMoved(document)).toBe(false)
  expect(engine.fontsMoved(doc)).toBe(true)
  engine.reset()
  expect(engine.fontsMoved(document)).toBe(false)
  expect(engine.fontsMoved(doc)).toBe(false)
  expect(engine.stats().cachedFonts).toBe(0)
  engine.dispose()
})

test("hanging support is cached separately for each owner document", () => {
  const doc = otherDocument()
  vi.mocked(rendering.honoursHangingMargins).mockImplementation((owner) => owner === document)
  const engine = createLinebreaker()
  engine.warm(document)
  engine.warm(doc)
  engine.warm(document)
  engine.warm(doc)
  expect(rendering.honoursHangingMargins).toHaveBeenCalledTimes(2)
  expect(rendering.honoursHangingMargins).toHaveBeenCalledWith(document)
  expect(rendering.honoursHangingMargins).toHaveBeenCalledWith(doc)
  engine.dispose()
})
