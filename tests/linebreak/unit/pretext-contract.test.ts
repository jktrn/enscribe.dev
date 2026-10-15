import { describe, expect, test } from "bun:test"

const ADVANCE = 6.5

class StubContext {
  font = ""
  measureText(text: string) {
    return { width: [...text].length * ADVANCE }
  }
}

class StubOffscreenCanvas {
  getContext(_kind: string) {
    return new StubContext()
  }
}

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  writable: true,
  value: StubOffscreenCanvas,
})

const { prepareWithSegments } = await import("@chenglou/pretext")
const { createFontMetrics } = await import("@linebreak/text/measure")

const FONT = "16px serif"
const TEXT = "co­oper­ate exam­ple 3.14 x"

const prepare = (letterSpacing: number) =>
  prepareWithSegments(TEXT, FONT, {
    letterSpacing,
    whiteSpace: "pre-wrap",
  })

const SPACINGS = [0, 1.5, -0.4]

describe("pretext contract", () => {
  test("segments, widths and kinds stay aligned and cover the input", () => {
    const raw = prepare(0)

    expect(raw.segments.length).toBeGreaterThan(0)
    expect(raw.widths.length).toBe(raw.segments.length)
    expect(raw.kinds.length).toBe(raw.segments.length)
    expect(raw.segments.join("")).toBe(TEXT)
  })

  for (const letterSpacing of SPACINGS) {
    test(`raw pretext exposes its extra soft-hyphen spacing at ${letterSpacing}`, () => {
      const raw = prepare(letterSpacing)
      const metrics = createFontMetrics(FONT, letterSpacing)
      const expected = metrics.hyphenWidth + 2 * letterSpacing
      const advances = raw.kinds
        .map((kind, index) =>
          kind === "soft-hyphen" ? raw.lineEndFitAdvances[index] : null,
        )
        .filter((advance) => advance !== null)

      expect(advances.length).toBe(3)
      for (const advance of advances) expect(advance).toBe(expected)
    })

    test(`measured soft hyphens use the visible hyphen width at ${letterSpacing}`, () => {
      const metrics = createFontMetrics(FONT, letterSpacing)
      const paragraph = metrics.measureParagraph(TEXT)

      expect(paragraph).not.toBeNull()
      const softHyphens = (paragraph?.segments ?? []).filter(
        (segment) => segment.kind === "soft-hyphen",
      )

      expect(softHyphens.length).toBe(3)
      for (const segment of softHyphens) {
        expect(segment.lineEndWidth).toBe(metrics.hyphenWidth)
      }
    })
  }

  test("measured segments tile the paragraph without gaps", () => {
    const metrics = createFontMetrics(FONT, 0)
    const paragraph = metrics.measureParagraph(TEXT)
    const segments = paragraph?.segments ?? []

    expect(segments.length).toBeGreaterThan(0)
    expect(segments.map((segment) => segment.text).join("")).toBe(TEXT)
    expect(segments[0]?.start).toBe(0)
    expect(segments.at(-1)?.end).toBe(TEXT.length)
    expect(metrics.hyphenWidth).toBe(ADVANCE)
  })
})
