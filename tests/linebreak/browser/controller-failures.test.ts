import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import * as rendering from "@linebreak/dom/render"
import * as geometry from "@linebreak/dom/geometry"
import * as measurement from "@linebreak/dom/measure-dom"
import * as stretch from "@linebreak/dom/stretch"
import {
  browserFixture,
  paragraph,
  PROSE,
  mockPreparedLayout,
} from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

test("empty and unsupported blocks retain truthful outcomes until reset", () => {
  const empty = paragraph(""),
    invalid = paragraph()
  invalid.innerHTML = "<div>Unsupported nested block</div>"
  const engine = createLinebreaker({ protrude: false })
  engine.warm(document)
  expect(engine.typeset([empty, invalid]).map((o) => o.status)).toEqual([
    "skipped",
    "declined",
  ])
  engine.refresh()
  expect(engine.typeset([empty, invalid]).map((o) => o.status)).toEqual([
    "skipped",
    "declined",
  ])
  invalid.textContent = PROSE
  engine.reset()
  expect(engine.typeset([invalid])[0]?.status).toBe("typeset")
})

test("already managed markup can be reconsidered after the other owner restores it", () => {
  const p = paragraph()
  p.setAttribute("data-linebreak-typeset", "2")
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "skipped",
    reason: "already-typeset",
  })
  p.removeAttribute("data-linebreak-typeset")
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
})

test("unavailable metrics are declined before a draft can modify content", () => {
  const p = paragraph()
  vi.spyOn(measurement, "metricsForStyle").mockReturnValue(null)
  expect(createLinebreaker().typeset([p])[0]).toMatchObject({
    status: "declined",
    reason: "unmeasurable",
  })
  expect(p.textContent).toBe(PROSE)
})

test("failed segmentation is reported separately from unavailable metrics", () => {
  const p = paragraph()
  vi.spyOn(measurement, "metricsForStyle").mockReturnValue({
    font: "16px serif",
    letterSpacing: 0,
    hyphenWidth: 8,
    measureRun: (t) => t.length * 8,
    measureParagraph: () => null,
  })
  expect(createLinebreaker().typeset([p])[0]).toMatchObject({
    status: "declined",
    reason: "segmentation-mismatch",
  })
})

test("authored spacing and transformations decline instead of silently producing wrong widths", () => {
  for (const [property, value] of [
    ["wordSpacing", "3px"],
    ["textTransform", "uppercase"],
    ["fontStretch", "condensed"],
  ] as const) {
    const p = paragraph()
    p.style[property] = value
    expect(createLinebreaker().typeset([p])[0]).toMatchObject({
      status: "declined",
      reason: "unmeasurable",
    })
  }
})

test("a null render rebuild is reported as a typed render failure", () => {
  const p = paragraph()
  vi.spyOn(rendering, "renderLines").mockReturnValue(null)
  const [outcome] = createLinebreaker().typeset([p])
  expect(outcome).toMatchObject({
    status: "failed",
    reason: "render-failed",
    cause: new Error("line content could not be rebuilt"),
  })
  expect(p.textContent).toBe(PROSE)
})

test("layout mismatch retries with a reduced measure and converges", () => {
  const p = paragraph()
  const mismatch = vi
    .spyOn(geometry, "layoutMismatch")
    .mockReturnValueOnce(true)
    .mockReturnValue(false)
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "typeset",
    retries: 1,
  })
  expect(mismatch).toHaveBeenCalledTimes(2)
  expect(engine.stats()).toMatchObject({ typeset: 1, retries: 1, failed: 0 })
})

test("exhausted retries restore the DOM and remain retryable", () => {
  const p = paragraph()
  const mismatch = vi.spyOn(geometry, "layoutMismatch").mockReturnValue(true)
  const engine = createLinebreaker({ retries: 2 })
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "failed",
    reason: "layout-mismatch",
  })
  expect(engine.stats()).toMatchObject({
    failed: 1,
    retries: 2,
    liveElements: 0,
  })
  expect(p.textContent).toBe(PROSE)
  mismatch.mockReturnValue(false)
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
})

test("a retry becoming infeasible restores content immediately", () => {
  const p = paragraph()
  vi.spyOn(geometry, "layoutMismatch").mockReturnValue(true)
  mockPreparedLayout()
    .mockImplementationOnce((original, width, options) =>
      original(width, options),
    )
    .mockReturnValue({ ok: false, reason: "infeasible" })
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "failed",
    reason: "layout-mismatch",
  })
  expect(p.textContent).toBe(PROSE)
  expect(engine.stats()).toMatchObject({ retries: 1, failed: 1, typeset: 0 })
})

test("a non-Error render exception has a meaningful diagnostic and restores authored markup", () => {
  const p = paragraph()
  const authored = p.innerHTML
  vi.spyOn(rendering, "renderLines").mockImplementation(() => { throw "broken" })
  expect(createLinebreaker().typeset([p])[0]).toMatchObject({
    element: p,
    status: "failed",
    reason: "render-failed",
    cause: new Error("Rendering threw a non-Error value"),
  })
  expect(p.innerHTML).toBe(authored)
})

test("width changes between measurement and rendering are reported without retry loops", () => {
  const p = paragraph(),
    engine = createLinebreaker()
  const drafts = engine.compose([p])
  p.style.width = "350px"
  expect(engine.apply(drafts)[0]).toMatchObject({
    status: "failed",
    reason: "unstable-width",
  })
  expect(engine.stats().retries).toBe(0)
  engine.refresh()
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
})

test("consistent batch width shifts are tolerated using the median", () => {
  const elements = [paragraph(), paragraph(), paragraph()]
  const engine = createLinebreaker()
  const drafts = engine.compose(elements)
  for (const p of elements) p.style.width = "320px"
  expect(engine.apply(drafts).every((o) => o.status === "typeset")).toBe(true)
})

test("an unresolved line height reports its actual failure reason", () => {
  const p = paragraph()
  vi.spyOn(geometry, "resolvedLineHeight").mockReturnValue(Number.NaN)
  expect(createLinebreaker().typeset([p])[0]).toMatchObject({
    status: "failed",
    reason: "line-height-unresolved",
  })
})

test("locale falls back through explicit preference, document language, and English", () => {
  const p = paragraph()
  document.documentElement.lang = ""
  expect(createLinebreaker({ locale: "de" }).typeset([p])[0]?.status).toBe(
    "typeset",
  )
  const second = paragraph()
  expect(createLinebreaker().typeset([second])[0]?.status).toBe("typeset")
  document.documentElement.lang = "fr"
  expect(createLinebreaker().typeset([paragraph()])[0]?.status).toBe("typeset")
})

test("tracking and supported font expansion participate in layout", () => {
  const scale = {
    steps: [
      { pct: 98, ratio: 0.98 },
      { pct: 100, ratio: 1 },
      { pct: 102, ratio: 1.02 },
    ],
  }
  vi.spyOn(stretch, "stretchScaleFor").mockReturnValue(scale)
  const p = paragraph()
  const engine = createLinebreaker({
    expand: true,
    track: true,
    hyphenate: (word) => (word.length > 5 ? [3] : []),
  })
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(stretch.stretchScaleFor).toHaveBeenCalled()
  expect(p.textContent).toBe(PROSE)
})

test("unsupported expansion is gracefully omitted and mixed spacing disables tracking", () => {
  vi.spyOn(stretch, "stretchScaleFor").mockReturnValue(null)
  const p = paragraph()
  p.innerHTML = `<em style="letter-spacing:1px">Alpha beta</em> gamma delta epsilon zeta eta theta iota kappa lambda mu nu.`
  expect(
    createLinebreaker({ expand: true, track: true }).typeset([p])[0]?.status,
  ).toBe("typeset")
})

test("font witnesses ignore unavailable probes and detect a later change", () => {
  const p = paragraph(),
    engine = createLinebreaker()
  engine.typeset([p])
  vi.spyOn(measurement, "currentAdvance").mockReturnValue(null)
  expect(engine.fontsMoved(document)).toBe(false)
  vi.spyOn(measurement, "currentAdvance").mockReturnValue(10000)
  expect(engine.fontsMoved(document)).toBe(true)
})

test("font witness sampling is bounded while long text still composes", () => {
  const text = Array.from({ length: 90 }, (_, i) =>
    String.fromCharCode(33 + i),
  ).join(" ")
  const p = paragraph(text)
  expect(
    createLinebreaker({ maximumCharacters: 1000 }).typeset([p])[0]?.status,
  ).toBe("typeset")
  const advance = vi.mocked(measurement.currentAdvance)
  expect(advance.mock.calls.every((args) => args[2].length <= 64)).toBe(true)
})

test("hanging text indentation is declined even when computed style supplies the newer CSS syntax", () => {
  const p = paragraph()
  const read = geometry.styleOf
  vi.spyOn(geometry, "styleOf").mockImplementation((element) => {
    return new Proxy(read(element), {
      get: (style, property) =>
        property === "textIndent"
          ? "20px hanging"
          : Reflect.get(style, property, style),
    })
  })
  expect(createLinebreaker().typeset([p])[0]).toMatchObject({
    status: "declined",
    reason: "unmeasurable",
  })
})

test("unavailable initial font witnesses use zero and later probes stay safe", () => {
  vi.spyOn(measurement, "currentAdvance").mockReturnValue(null)
  const engine = createLinebreaker()
  expect(engine.typeset([paragraph()])[0]?.status).toBe("typeset")
  expect(engine.fontsMoved(document)).toBe(false)
})

test("whitespace-only runs do not create spurious font-change signals", () => {
  const p = paragraph()
  p.innerHTML = `Alpha<em style="font-family:monospace"> </em>beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu.`
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(engine.fontsMoved(document)).toBe(false)
})

test("atomic content is measured and image attributes survive restoration", () => {
  const p = paragraph()
  p.innerHTML = `Alpha <img src="image.png" data-loaded="old"> beta gamma delta epsilon zeta eta theta iota.`
  const engine = createLinebreaker({ preserveImageAttributes: ["data-loaded"] })
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  p.querySelector("img")?.setAttribute("data-loaded", "new")
  engine.restore()
  expect(p.querySelector("img")?.getAttribute("data-loaded")).toBe("new")
})
