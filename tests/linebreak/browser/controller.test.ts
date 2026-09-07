import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import { COMPOSITION_BRAND } from "@linebreak/types"
import * as rendering from "@linebreak/dom/render"
import * as measuring from "@linebreak/dom/measure-dom"
import * as segmenting from "@linebreak/text/measure"
import {
  browserFixture,
  paragraph,
  PROSE,
  mockPreparedLayout,
} from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

test("composition is read-only, deduplicates elements, and applies exactly once", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const before = p.innerHTML
  const drafts = engine.compose([p, p])
  expect(drafts).toHaveLength(1)
  expect(drafts[0]?.status).toBe("ready")
  expect(p.innerHTML).toBe(before)
  const outcomes = engine.apply(drafts)
  expect(outcomes[0]?.status).toBe("typeset")
  expect(p.textContent).toBe(PROSE)
  expect(engine.stats()).toMatchObject({
    typeset: 1,
    liveElements: 1,
    cachedFonts: 1,
  })
  expect(() => engine.apply(drafts)).toThrow("already applied")
  engine.restore()
  expect(p.innerHTML).toBe(before)
  expect(engine.stats().liveElements).toBe(0)
  engine.dispose()
  engine.dispose()
  expect(() => engine.warm(document)).toThrow("disposed")
  expect(() => engine.compose([p])).toThrow("disposed")
  expect(() => engine.apply([])).toThrow("disposed")
})

test("foreign compositions cannot mutate an element", () => {
  const p = paragraph()
  const first = createLinebreaker(),
    other = createLinebreaker()
  expect(() => other.apply(first.compose([p]))).toThrow("already applied")
  expect(() =>
    first.apply([
      {
        brand: Symbol("foreign") as typeof COMPOSITION_BRAND,
        element: p,
        status: "ready",
        lines: 1,
        width: 300,
      },
    ]),
  ).toThrow("foreign")
  expect(p.hasAttribute("data-linebreak-typeset")).toBe(false)
})

test("skipped compositions also enforce ownership and single application", () => {
  const p = paragraph("short")
  const engine = createLinebreaker(),
    other = createLinebreaker()
  const pending = engine.compose([p])
  expect(pending[0]?.status).toBe("skipped")
  expect(() => other.apply(pending)).toThrow("already applied")
  expect(engine.apply(pending)[0]?.status).toBe("skipped")
  expect(() => engine.apply(pending)).toThrow("already applied")
  expect(engine.stats().skipped).toBe(1)
})

test("narrow and single-line skips can be retried after width or content changes", () => {
  const p = paragraph("Short", 100)
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "skipped",
    reason: "too-narrow",
  })
  p.style.width = "300px"
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "skipped",
    reason: "single-line",
  })
  p.textContent = PROSE
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(engine.stats().skipped).toBe(2)
})

test.each([
  ["direction", "rtl", "unsupported-direction"],
  ["writingMode", "vertical-rl", "unsupported-writing-mode"],
] as const)("declines unsupported %s without modifying content", (property, value, reason) => {
  const p = paragraph()
  p.style[property] = value
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]).toMatchObject({ status: "declined", reason })
  p.style[property] = ""
  expect(engine.typeset([p])[0]).toMatchObject({ status: "declined", reason })
  engine.reset([p])
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
})

test("restoration preserves author edits and releases detached elements", () => {
  const p = paragraph(),
    other = paragraph()
  const engine = createLinebreaker()
  engine.typeset([p, other])
  p.textContent = "New author content"
  engine.restore([p])
  expect(p.textContent).toBe("New author content")
  expect(p.hasAttribute("data-linebreak-typeset")).toBe(false)
  other.remove()
  engine.apply([])
  expect(engine.stats().liveElements).toBe(0)
  engine.restore([paragraph()])
})

test("reuses font measurements and detects changed font advances", () => {
  const p = paragraph()
  const engine = createLinebreaker({ locale: "de" })
  engine.warm(document)
  engine.typeset([p])
  expect(engine.fontsMoved(document)).toBe(false)
  engine.restore([p])
  p.style.width = "320px"
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(engine.stats().cachedFonts).toBe(1)
  engine.reset()
  expect(engine.stats().cachedFonts).toBe(0)
})

test("render exceptions restore content and report a typed cause", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  vi.spyOn(rendering, "renderLines").mockImplementation(() => {
    throw "failure"
  })
  const [outcome] = engine.typeset([p])
  expect(outcome).toMatchObject({
    status: "failed",
    reason: "render-failed",
    cause: expect.any(Error),
  })
  expect(p.textContent).toBe(PROSE)
  expect(engine.stats().failed).toBe(1)
  expect(engine.typeset([p])[0]?.status).toBe("failed")
})

test("infeasible layout is retryable after refresh", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const solve = mockPreparedLayout().mockReturnValue({
    ok: false,
    reason: "infeasible",
  })
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "declined",
    reason: "no-feasible-breaking",
  })
  solve.mockRestore()
  expect(engine.typeset([p])[0]?.status).toBe("declined")
  engine.refresh()
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
})

test("outcome handlers cannot re-enter application", () => {
  const p = paragraph()
  let reentered = false
  const engine = createLinebreaker({
    onOutcome: () => {
      if (reentered) return
      reentered = true
      expect(() => engine.apply([])).toThrow("re-entered")
    },
  })
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
})

test("applying a repeated composition writes and reports it once", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const drafts = engine.compose([p])
  expect(engine.apply([...drafts, ...drafts])).toHaveLength(1)
  expect(engine.stats().typeset).toBe(1)
})

test.each([
  "restore",
  "reset",
] as const)("%s invalidates unapplied compositions", (action) => {
  const p = paragraph()
  const engine = createLinebreaker()
  const pending = engine.compose([p])
  engine[action]([p])
  expect(() => engine.apply(pending)).toThrow("stale")
  expect(p.textContent).toBe(PROSE)
})

test("a newer composition replaces an earlier draft for the same element", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const old = engine.compose([p])
  const latest = engine.compose([p])
  expect(() => engine.apply(old)).toThrow("stale")
  expect(engine.apply(latest)[0]?.status).toBe("typeset")
})

test("applying after author edits rejects the batch before writing any elements", () => {
  const p = paragraph(),
    other = paragraph()
  const engine = createLinebreaker()
  const pending = engine.compose([p, other])
  other.innerHTML = `<em>${PROSE}</em>`
  expect(() => engine.apply(pending)).toThrow("stale")
  expect(p.hasAttribute("data-linebreak-typeset")).toBe(false)
  expect(other.querySelector("em")?.textContent).toBe(PROSE)
})

test("restoration preserves markup edits even when their text is unchanged", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  engine.typeset([p])
  p.innerHTML = `<strong>${PROSE}</strong>`
  engine.restore([p])
  expect(p.innerHTML).toBe(`<strong>${PROSE}</strong>`)
  expect(p.hasAttribute("data-linebreak-typeset")).toBe(false)
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  engine.restore([p])
  expect(p.innerHTML).toBe(`<strong>${PROSE}</strong>`)
})

test("reset without an element list drops measurements for pending compositions", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const old = engine.compose([p])
  engine.reset()
  expect(() => engine.apply(old)).toThrow("stale")
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(measuring.metricsForStyle).toHaveBeenCalledTimes(2)
})

test("font-feature changes invalidate root measurements and unapplied drafts", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  const old = engine.compose([p])
  p.style.fontFeatureSettings = '"kern" 0'
  expect(() => engine.apply(old)).toThrow("stale")
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(measuring.metricsForStyle).toHaveBeenCalledTimes(2)
})

test("permitted image attribute updates survive restoration without invalidating content", () => {
  const p = paragraph()
  p.innerHTML = `${PROSE} <img src="before.png" alt="Diagram"> ${PROSE}`
  const image = p.querySelector("img")!
  image.style.width = "20px"
  image.style.height = "20px"
  const engine = createLinebreaker({ preserveImageAttributes: ["src"] })
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  p.querySelector("img")!.setAttribute("src", "after.png")
  engine.restore([p])
  expect(p.querySelector("img")?.getAttribute("src")).toBe("after.png")
  expect(p.querySelector("[data-linebreak-line]")).toBeNull()
})

test("disposing releases local caches without flushing measurements shared by other controllers", () => {
  const invalidate = vi.spyOn(segmenting, "invalidateMeasurements")
  const engine = createLinebreaker()
  engine.typeset([paragraph()])
  engine.dispose()
  expect(invalidate).not.toHaveBeenCalled()
  expect(engine.stats().cachedFonts).toBe(0)
})
