import { afterEach, beforeEach, expect, test, vi } from "vitest"
import * as pretext from "@chenglou/pretext"

vi.mock("@chenglou/pretext", { spy: true })
import {
  configureLocale,
  createFontMetrics,
  invalidateMeasurements,
} from "@linebreak/text/measure"
import { currentAdvance } from "@linebreak/dom/measure-dom"

type Prepared = ReturnType<typeof pretext.prepareWithSegments>
const raw = (segments: string[], kinds: string[], widths: number[]): Prepared =>
  ({ segments, kinds, widths }) as Prepared

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(pretext, "prepareWithSegments").mockImplementation((text) =>
    raw([text], ["text"], [text.length * 8]),
  )
  vi.spyOn(pretext, "clearCache").mockImplementation(() => {})
  vi.spyOn(pretext, "setLocale").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

test("font runs memoize widths and measure empty text without an external call", () => {
  const metrics = createFontMetrics("16px serif", 0)
  expect(metrics.measureRun("")).toBe(0)
  expect(metrics.measureRun("word")).toBe(32)
  expect(metrics.measureRun("word")).toBe(32)
  expect(pretext.prepareWithSegments).toHaveBeenCalledTimes(2)
})

test("pretext kinds preserve spaces, zero-width breaks, and unfamiliar segmentation kinds", () => {
  const metrics = createFontMetrics("16px serif", 1)
  vi.mocked(pretext.prepareWithSegments).mockReturnValue(
    raw(
      ["a", " ", "\u200b", "\t", "\u00ad"],
      ["text", "space", "zero-width-break", "tab", "soft-hyphen"],
      [8, 8, 0, 32, 0],
    ),
  )
  const measured = metrics.measureParagraph("a \u200b\t\u00ad")
  expect(measured?.segments.map((s) => s.kind)).toEqual([
    "text",
    "space",
    "break-opportunity",
    "other",
    "soft-hyphen",
  ])
  expect(measured?.segments.at(-1)?.lineEndWidth).toBe(8)
  expect(measured?.segments.slice(0, -1).map((segment) => segment.lineEndWidth)).toEqual([0, 0, 0, 0])
  expect(measured?.segments.map((segment) => segment.width)).toEqual([8, 8, 0, 32, 0])
  expect(pretext.prepareWithSegments).toHaveBeenLastCalledWith("a \u200b\t\u00ad", "16px serif", { letterSpacing: 1, whiteSpace: "pre-wrap" })
})

test("misaligned external segmentation is rejected", () => {
  const metrics = createFontMetrics("16px serif", 0)
  for (const prepared of [
    raw(["word"], [], [32]),
    raw(["word"], ["text"], []),
    raw(["short"], ["text"], [40]),
    raw(["fake"], ["text"], [32]),
    raw(["wor"], ["text"], [24]),
  ]) {
    vi.mocked(pretext.prepareWithSegments).mockReturnValue(prepared)
    expect(metrics.measureParagraph("word")).toBeNull()
  }
})

test("DOM width sources warm paragraph segments and supply their actual advances", () => {
  const advance = vi.fn((text: string) => text.length * 11),
    warm = vi.fn()
  const metrics = createFontMetrics("small-caps 16px serif", 0.5, {
    paragraph: { advance, warm },
  })
  expect(metrics.hyphenWidth).toBe(11)
  expect(metrics.measureParagraph("word")?.segments[0]?.width).toBe(44)
  expect(warm).toHaveBeenCalledWith(["word"])
})

test("formatting-only break segments remain zero-width with an isolated DOM spacing artifact", () => {
  const metrics = createFontMetrics("16px serif", 0.5, {
    paragraph: { advance: (text) => text.length * 10 + 0.5, warm: () => {} },
  })
  vi.mocked(pretext.prepareWithSegments).mockReturnValue(raw(
    ["x", "\u200b", "y", "\u00ad"],
    ["text", "zero-width-break", "text", "soft-hyphen"],
    [8, 0.5, 8, 0.5],
  ))
  const measured = metrics.measureParagraph("x\u200by\u00ad")
  expect(measured?.segments.map(({ width }) => width)).toEqual([10.5, 0, 10.5, 0])
  expect(measured?.segments.map(({ start, end }) => [start, end])).toEqual([[0, 1], [1, 2], [2, 3], [3, 4]])
  expect(measured?.segments.map(({ lineEndWidth }) => lineEndWidth)).toEqual([0, 0, 0, 10.5])
})

test("a run advance skips repeated paragraph analysis while paragraph widths keep their source", () => {
  const advance = vi.fn((text: string) => text.length * 11)
  const metrics = createFontMetrics("16px serif", 0.5, { run: advance })
  expect(metrics.hyphenWidth).toBe(11)
  expect(metrics.measureRun("")).toBe(0)
  expect(metrics.measureRun("pre")).toBe(33)
  expect(metrics.measureRun("pre")).toBe(33)
  expect(advance).toHaveBeenCalledTimes(2)
  expect(pretext.prepareWithSegments).not.toHaveBeenCalled()
  expect(metrics.measureParagraph("prefix")?.segments[0]?.width).toBe(48)
  expect(pretext.prepareWithSegments).toHaveBeenCalledOnce()
  expect(advance).toHaveBeenCalledTimes(2)
})

test("locale changes trim inputs, avoid redundant updates, and reset to default", () => {
  configureLocale("fr")
  configureLocale("  de  ")
  configureLocale("de")
  expect(pretext.setLocale).toHaveBeenLastCalledWith("de")
  expect(pretext.setLocale).toHaveBeenCalledTimes(2)
  configureLocale("   ")
  expect(pretext.setLocale).toHaveBeenLastCalledWith(undefined)
  configureLocale()
  expect(pretext.setLocale).toHaveBeenCalledTimes(3)
  invalidateMeasurements()
  expect(pretext.clearCache).toHaveBeenCalledOnce()
})

test("font witness probes report unavailable canvas and measured advances", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  expect(currentAdvance(document, "16px serif", "word")).toBeNull()
  const context = {
    font: "",
    measureText: vi.fn(() => ({ width: 37 }) as TextMetrics),
  } as Pick<
    CanvasRenderingContext2D,
    "font" | "measureText"
  > as CanvasRenderingContext2D
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
  expect(currentAdvance(document, "18px sans-serif", "word")).toBe(37)
  expect(context.font).toBe("18px sans-serif")
  expect(context.measureText).toHaveBeenCalledWith("word")
  expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("2d")
})
