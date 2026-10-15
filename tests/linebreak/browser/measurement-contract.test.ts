import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { BrowserMeasurements } from "@linebreak/browser/measurement"
import { createLinebreaker } from "@linebreak/linebreaker"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"
import { computedFont, cssPixels, variantKey } from "@linebreak/dom/style"
import * as geometry from "@linebreak/dom/geometry"
import * as metrics from "@linebreak/dom/measure-dom"
import * as segmenting from "@linebreak/text/measure"
import * as stretch from "@linebreak/dom/stretch"
import * as solver from "@linebreak/layout/breaker/prepared"
import type { Hyphenator } from "@linebreak/types"
import { browserFixture, paragraph } from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

const compile = (
  p: HTMLElement,
  expand = false,
  track = false,
  protrude = false,
  hyphenate?: Hyphenator,
) => {
  const prepare = vi.spyOn(solver, "prepareParagraph")
  const measurer = new BrowserMeasurements({
    maximumCharacters: 3000,
    expand,
    track,
    policy: texDefaults,
    glue: defaultGlue,
    ...(hyphenate ? { hyphenate } : {}),
  })
  const style = geometry.styleOf(p)
  const built = measurer.build(
    p,
    style,
    {
      locale: "en-US",
      font: computedFont(style),
      letterSpacing: cssPixels(style.letterSpacing),
      variant: variantKey(style),
    },
    protrude,
  )
  if (!built.ok) throw new Error(built.reason)
  const [items, options] = prepare.mock.lastCall!
  prepare.mockRestore()
  return {
    ...built.measurement,
    items,
    hangs: options?.hangs ?? null,
    flex: options?.flex ?? null,
  }
}

const scale = {
  steps: [
    { pct: 98, ratio: 0.98 },
    { pct: 100, ratio: 1 },
    { pct: 102, ratio: 1.02 },
  ],
}

test("expansion and tracking remain absent unless enabled", () => {
  const probe = vi.spyOn(stretch, "stretchScaleFor").mockReturnValue(scale)
  const built = compile(paragraph())
  expect(built.expansion).toBeNull()
  expect(built.tracking).toBeNull()
  expect(built.flex).toBeNull()
  expect(probe).not.toHaveBeenCalled()
})

test("supported expansion and uniform tracking contribute positive shared flexibility", () => {
  vi.spyOn(stretch, "stretchScaleFor").mockReturnValue(scale)
  const built = compile(paragraph(), true, true)
  expect(built.expansion?.scale).toBe(scale)
  expect(built.expansion?.flex.stretch.at(-1)).toBeGreaterThan(0)
  expect(built.tracking?.stretch.at(-1)).toBeGreaterThan(0)
  expect(built.flex?.stretch.at(-1)).toBeCloseTo(
    built.expansion!.flex.stretch.at(-1)! + built.tracking!.stretch.at(-1)!,
  )
})

test("an unavailable width axis contributes no expansion", () => {
  vi.spyOn(stretch, "stretchScaleFor").mockReturnValue(null)
  const built = compile(paragraph(), true)
  expect(built.expansion).toBeNull()
  expect(built.flex).toBeNull()
})

test("different authored letter spacing disables shared tracking", () => {
  const p = paragraph()
  p.innerHTML =
    '<em style="letter-spacing:1px">Alpha beta</em> gamma delta epsilon zeta eta theta.'
  const built = compile(p, false, true)
  expect(built.tracking).toBeNull()
  expect(built.flex).toBeNull()
})

test.each([
  "a<em>\u0301</em>b",
  "<em>👩‍</em>👩‍👧‍👦",
])("a grapheme divided across text runs disables optional tracking: %s", (html) => {
  const p = paragraph()
  p.innerHTML = `${html} alpha beta gamma delta epsilon zeta.`
  const built = compile(p, false, true)
  expect(built.tracking).toBeNull()
  expect(built.flex).toBeNull()
  expect(built.items.length).toBeGreaterThan(3)
})

test("ordinary text-run boundaries retain tracking", () => {
  const p = paragraph()
  p.innerHTML = "<em>alpha</em>beta gamma<em> </em>delta epsilon zeta."
  expect(compile(p, false, true).tracking?.stretch.at(-1)).toBeGreaterThan(0)
})

test("protrusion credits survive compilation when enabled", () => {
  const built = compile(
    paragraph("“Alpha beta gamma delta epsilon zeta eta theta.”"),
    false,
    false,
    true,
  )
  expect(built.hangs).not.toBeNull()
  expect([...built.hangs!.start].some((credit) => credit > 0)).toBe(true)
  expect([...built.hangs!.end].some((credit) => credit > 0)).toBe(true)
})

test("measured wrapper borders, padding and margins contribute to natural width", () => {
  const plain = compile(paragraph("Alpha beta"))
  const p = paragraph()
  p.innerHTML =
    '<em style="padding-inline-start:5px;border-inline-start-width:2px;border-inline-start-style:solid;margin-inline-start:3px;padding-inline-end:7px">Alpha beta</em>'
  const wrapped = compile(p)
  const width = (measurement: typeof plain) =>
    measurement.items.reduce(
      (sum, item) =>
        sum + (item.kind === "box" || item.kind === "glue" ? item.width : 0),
      0,
    )
  expect(width(wrapped) - width(plain)).toBe(17)
})

test("font witnesses contain each visible character once and no whitespace", () => {
  const p = paragraph("aa bba ccc")
  const engine = createLinebreaker()
  engine.compose([p])
  const samples = vi
    .mocked(metrics.currentAdvance)
    .mock.calls.map((call) => call[2])
  expect(samples).toContain("abc")
  expect(samples.every((text) => !/\s/u.test(text))).toBe(true)
  engine.dispose()
})

test("font witness content is reused when a later paragraph adds no characters", () => {
  const engine = createLinebreaker()
  engine.compose([paragraph("alpha beta")])
  vi.mocked(metrics.currentAdvance).mockClear()
  engine.compose([paragraph("beta alpha")])
  expect(metrics.currentAdvance).not.toHaveBeenCalled()
  expect(metrics.metricsForStyle).toHaveBeenCalledOnce()
  engine.dispose()
})

test("reset drops witnesses and invalidates both shared measurement caches", () => {
  const fonts = vi.spyOn(segmenting, "invalidateMeasurements")
  const scales = vi.spyOn(stretch, "invalidateStretchScales")
  const engine = createLinebreaker()
  engine.compose([paragraph()])
  engine.reset()
  vi.mocked(metrics.currentAdvance).mockReturnValue(10000)
  expect(engine.fontsMoved(document)).toBe(false)
  expect(fonts).toHaveBeenCalledOnce()
  expect(scales).toHaveBeenCalledOnce()
  engine.dispose()
})

test("whitespace-only font runs are not probed for font changes", () => {
  const p = paragraph()
  p.innerHTML =
    'Alpha<em style="font-family:monospace"> </em>beta gamma delta epsilon zeta eta.'
  const engine = createLinebreaker()
  engine.compose([p])
  vi.mocked(metrics.currentAdvance).mockClear()
  engine.fontsMoved(document)
  expect(
    vi
      .mocked(metrics.currentAdvance)
      .mock.calls.every((call) => call[2].length > 0),
  ).toBe(true)
  engine.dispose()
})

test("missing font metrics cannot enter the successful cache or font witnesses", () => {
  const engine = createLinebreaker()
  vi.mocked(metrics.metricsForStyle).mockReturnValue(null)
  const composition = engine.compose([paragraph()])
  expect(composition).toEqual([
    expect.objectContaining({ status: "declined", reason: "unmeasurable" }),
  ])
  expect(engine.stats().cachedFonts).toBe(0)
  vi.mocked(metrics.currentAdvance).mockClear()
  expect(engine.fontsMoved(document)).toBe(false)
  expect(metrics.currentAdvance).not.toHaveBeenCalled()
  engine.dispose()
})

test("font-change tolerance ignores the exact threshold after an unavailable witness", () => {
  vi.mocked(metrics.currentAdvance).mockReturnValue(null)
  const engine = createLinebreaker()
  engine.compose([paragraph("alpha beta")])
  vi.mocked(metrics.currentAdvance).mockReturnValue(0.01)
  expect(engine.fontsMoved(document)).toBe(false)
  vi.mocked(metrics.currentAdvance).mockReturnValue(0.010001)
  expect(engine.fontsMoved(document)).toBe(true)
  engine.dispose()
})

test("an unsupported base font disables expansion even for supported descendant fonts", () => {
  const p = paragraph()
  p.innerHTML =
    '<em style="font-family:sans-serif">Alpha beta gamma delta epsilon.</em>'
  const probe = vi
    .spyOn(stretch, "stretchScaleFor")
    .mockImplementation((_document, font) =>
      font.includes("sans-serif") ? scale : null,
    )
  const built = compile(p, true)
  expect(built.expansion).toBeNull()
  expect(probe).toHaveBeenCalledOnce()
})

test("DOM code wrappers create nonprinting code opportunities", () => {
  const p = paragraph()
  p.innerHTML = "<code>alphaBeta.gamma</code>"
  const code = compile(p).items.filter((item) => item.kind === "discretionary")
  expect(code.length).toBeGreaterThan(0)
  expect(code.every((item) => item.preWidth === 0 && !item.hyphen)).toBe(true)
})

test("configured hyphenation reaches measured text with its locale", () => {
  const hyphenate = vi.fn((text: string) => (text === "alphabet" ? [3] : []))
  const compiled = compile(
    paragraph("alphabet"),
    false,
    false,
    false,
    hyphenate,
  )
  expect(hyphenate).toHaveBeenCalledWith("alphabet", "en-US")
  expect(
    compiled.items.filter((item) => item.kind === "discretionary"),
  ).toEqual([
    expect.objectContaining({ hyphen: true, breakOffset: 3, preWidth: 8 }),
  ])
})

test("the requested locale is configured before shaping a DOM paragraph", () => {
  const configure = vi.spyOn(segmenting, "configureLocale")
  const engine = createLinebreaker()
  const p = paragraph()
  p.lang = "fr-CA"
  engine.compose([p])
  expect(configure).toHaveBeenCalledExactlyOnceWith("fr-CA")
  expect(configure.mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(metrics.metricsForStyle).mock.invocationCallOrder[0]!,
  )
  engine.dispose()
})

test("font sampling includes exactly the bounded prefix of distinct characters", () => {
  const text = Array.from({ length: 90 }, (_, i) =>
    String.fromCharCode(33 + i),
  ).join(" ")
  const engine = createLinebreaker()
  engine.compose([paragraph(text)])
  const samples = vi
    .mocked(metrics.currentAdvance)
    .mock.calls.map((call) => call[2])
  expect(Math.max(...samples.map((text) => text.length))).toBe(64)
  engine.dispose()
})


test("inline runs measure their completed font witness once", () => {
  const p = paragraph()
  p.innerHTML = "alpha <span>beta</span> gamma <span>delta</span> epsilon"
  compile(p)
  const calls = vi.mocked(metrics.currentAdvance).mock.calls
  expect(calls).toHaveLength(1)
  expect(new Set(calls[0]![2])).toEqual(new Set("alphabetgmdsion"))
})

test("a throwing hyphenator still records the collected font witness", () => {
  expect(() => compile(paragraph("alphabetic words"), false, false, false, () => {
    throw new Error("hyphenation interrupted")
  })).toThrow("hyphenation interrupted")
  expect(vi.mocked(metrics.currentAdvance).mock.calls).toHaveLength(1)
  expect(vi.mocked(metrics.currentAdvance).mock.calls[0]![2]).toContain("a")
})
