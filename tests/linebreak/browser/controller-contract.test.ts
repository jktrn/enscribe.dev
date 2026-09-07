import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import * as rendering from "@linebreak/dom/render"
import * as geometry from "@linebreak/dom/geometry"
import * as preparation from "@linebreak/layout/breaker/prepared"
import * as stretch from "@linebreak/dom/stretch"
import {
  browserFixture,
  paragraph,
  mockPreparedLayout,
  PROSE,
} from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

test("repeated resize reuses compiled input and replaces generated lines without explicit restoration", () => {
  const p = paragraph()
  const authored = p.innerHTML
  const hyphenate = vi.fn(() => [])
  const engine = createLinebreaker({ hyphenate })
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  const compiledCalls = hyphenate.mock.calls.length
  expect(compiledCalls).toBeGreaterThan(0)
  const clone = vi.spyOn(p, "cloneNode")
  for (const width of [330, 290, 360]) {
    p.style.width = `${width}px`
    expect(engine.typeset([p])[0]?.status).toBe("typeset")
    expect(p.textContent).toBe(PROSE)
    expect(hyphenate).toHaveBeenCalledTimes(compiledCalls)
  }
  expect(engine.stats().typeset).toBe(4)
  expect(clone).not.toHaveBeenCalled()
  engine.restore()
  expect(p.innerHTML).toBe(authored)
})

test("font changes on generated content restore authored input before recompilation", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  p.style.font = "18px sans-serif"
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  expect(p.textContent).toBe(PROSE)
  expect(
    p.querySelectorAll("[data-linebreak-line] [data-linebreak-line]"),
  ).toHaveLength(0)
})

test.each([
  { preference: "de", expected: "de" },
  { preference: undefined, expected: "en-US" },
  { preference: "", expected: "en-US" },
])("missing language attributes use the configured locale $expected", ({
  preference,
  expected,
}) => {
  document.documentElement.removeAttribute("lang")
  const p = paragraph()
  const hyphenate = vi.fn((_word: string, _locale: string): number[] => [])
  const engine = createLinebreaker({ locale: preference, hyphenate })
  const pending = engine.compose([p])
  expect(engine.apply(pending)[0]?.status).toBe("typeset")
  expect(hyphenate).toHaveBeenCalled()
  expect(hyphenate.mock.calls.every(([, locale]) => locale === expected)).toBe(
    true,
  )
})

test("minimum width is inclusive and configured layout constraints reach every retry", () => {
  const p = paragraph()
  p.style.textIndent = "10px"
  const solve = mockPreparedLayout()
  vi.spyOn(geometry, "layoutMismatch")
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(true)
    .mockReturnValue(false)
  const engine = createLinebreaker({
    minimumWidth: 300,
    safetyMargin: 1.5,
    lastLineMinWidth: 0.25,
    emergencyStretch: 14,
    policy: { hyphenPenalty: 321 },
  })
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "typeset",
    retries: 3,
  })
  expect(solve.mock.calls.map(([, width]) => width)).toEqual([
    298.5, 295.5, 289.5, 271.5,
  ])
  for (const [, , options] of solve.mock.calls) {
    expect(options).toMatchObject({
      indent: 10,
      emergencyStretch: 14,
      lastLineMinWidth: 0.25,
      policy: { hyphenPenalty: 321 },
    })
  }
})

test.each([
  false,
  true,
  undefined,
])("protrusion option %j controls both warming and numeric geometry", (protrude) => {
  const p = paragraph(`“${PROSE}”`)
  vi.mocked(rendering.honoursHangingMargins).mockReturnValue(true)
  const prepare = vi.spyOn(preparation, "prepareParagraph")
  const engine = createLinebreaker({ protrude })
  engine.warm(document)
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  const hangs = prepare.mock.calls[0]?.[1]?.hangs
  if (protrude === false) {
    expect(rendering.honoursHangingMargins).not.toHaveBeenCalled()
    expect(hangs).toBeUndefined()
  } else {
    expect(rendering.honoursHangingMargins).toHaveBeenCalledOnce()
    expect(hangs?.start.some((width) => width > 0)).toBe(true)
    expect(hangs?.end.some((width) => width > 0)).toBe(true)
  }
})

test.each([
  false,
  true,
  undefined,
])("font expansion and tracking %j reach rendered adjustments", (enabled) => {
  const p = paragraph()
  const scale = {
    steps: [
      { pct: 98, ratio: 0.98 },
      { pct: 100, ratio: 1 },
      { pct: 102, ratio: 1.02 },
    ],
  }
  vi.spyOn(stretch, "stretchScaleFor").mockReturnValue(scale)
  const render = vi.spyOn(rendering, "renderLines")
  const engine = createLinebreaker({ expand: enabled, track: enabled })
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
  const layout = render.mock.calls[0]?.[2]
  if (enabled) {
    expect(layout?.fits).not.toBeNull()
    expect(layout?.letterfit).not.toBeNull()
  } else {
    expect(layout?.fits).toBeNull()
    expect(layout?.letterfit).toBeNull()
  }
})

test("warming caches an unsupported hanging-margin capability before composition", () => {
  vi.mocked(rendering.honoursHangingMargins).mockReturnValue(false)
  const engine = createLinebreaker()
  engine.warm(document)
  expect(rendering.honoursHangingMargins).toHaveBeenCalledOnce()
  engine.warm(document)
  engine.compose([paragraph(), paragraph()])
  expect(rendering.honoursHangingMargins).toHaveBeenCalledOnce()
})

test("global reset restores every live paragraph and discards its measurements", () => {
  const paragraphs = [paragraph(), paragraph()]
  const authored = paragraphs.map((p) => p.innerHTML)
  const hyphenate = vi.fn(() => [])
  const engine = createLinebreaker({ hyphenate })
  expect(
    engine.typeset(paragraphs).every(({ status }) => status === "typeset"),
  ).toBe(true)
  const calls = hyphenate.mock.calls.length
  engine.reset()
  expect(paragraphs.map((p) => p.innerHTML)).toEqual(authored)
  expect(engine.stats().liveElements).toBe(0)
  expect(
    engine.typeset(paragraphs).every(({ status }) => status === "typeset"),
  ).toBe(true)
  expect(hyphenate).toHaveBeenCalledTimes(calls * 2)
})

test.each([
  "restore",
  "reset",
] as const)("global %s invalidates unapplied work even when no element is live", (operation) => {
  const p = paragraph()
  const engine = createLinebreaker()
  const pending = engine.compose([p])
  engine[operation]()
  expect(() => engine.apply(pending)).toThrow("stale")
})

test.each([
  "restore",
  "reset",
] as const)("partial %s leaves unrelated pending work usable", (operation) => {
  const first = paragraph(),
    second = paragraph()
  const engine = createLinebreaker()
  engine.compose([first])
  const unaffected = engine.compose([second])
  engine[operation]([first])
  expect(engine.apply(unaffected)[0]?.status).toBe("typeset")
})

test("failed recomposition invalidates an older snapshot before solving starts", () => {
  const p = paragraph()
  const solve = mockPreparedLayout()
  const engine = createLinebreaker()
  const pending = engine.compose([p])
  solve.mockImplementationOnce(() => {
    throw new Error("solver interrupted")
  })
  expect(() => engine.compose([p])).toThrow("solver interrupted")
  expect(() => engine.apply(pending)).toThrow("stale")
})

test("width refresh does not erase a remembered content or style decline", () => {
  const p = paragraph()
  p.style.direction = "rtl"
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]?.status).toBe("declined")
  p.style.direction = "ltr"
  engine.refresh()
  expect(engine.typeset([p])[0]).toMatchObject({
    status: "declined",
    reason: "unsupported-direction",
  })
  engine.reset([p])
  expect(engine.typeset([p])[0]?.status).toBe("typeset")
})

test("dispose restores live content and releases font measurements exactly once", () => {
  const p = paragraph()
  const engine = createLinebreaker()
  engine.typeset([p])
  const restore = vi.spyOn(engine, "restore")
  engine.dispose()
  engine.dispose()
  expect(restore).toHaveBeenCalledOnce()
  expect(engine.stats()).toMatchObject({ liveElements: 0, cachedFonts: 0 })
  expect(p.hasAttribute("data-linebreak-typeset")).toBe(false)
})

test("an even batch uses the midpoint of distinct central width shifts", () => {
  const first = paragraph(),
    second = paragraph()
  const engine = createLinebreaker()
  const pending = engine.compose([first, second])
  first.style.width = "310px"
  second.style.width = "320px"
  expect(engine.apply(pending).map((outcome) => outcome.status)).toEqual([
    "failed",
    "failed",
  ])
})
