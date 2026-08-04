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

;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas =
  StubOffscreenCanvas

const pretext = new URL(
  "../../../packages/linebreak/node_modules/@chenglou/pretext/dist/layout.js",
  import.meta.url,
).href

const { prepareWithSegments } = (await import(pretext)) as {
  prepareWithSegments: (
    text: string,
    font: string,
    options: { letterSpacing: number; whiteSpace: string },
  ) => unknown
}
const { createFontMetrics } = await import("@linebreak/text/measure")

const FONT = "16px serif"
const TEXT = "co­oper­ate exam­ple 3.14 x"

type RawPrepared = {
  readonly segments: readonly string[]
  readonly widths: readonly number[]
  readonly kinds: readonly string[]
  readonly lineEndFitAdvances: readonly number[]
}

const prepare = (letterSpacing: number) =>
  prepareWithSegments(TEXT, FONT, {
    letterSpacing,
    whiteSpace: "pre-wrap",
  }) as RawPrepared

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
    test(`soft-hyphen advances are the hyphen identity at ${letterSpacing}`, () => {
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

    test(`measured soft hyphens carry that width at ${letterSpacing}`, () => {
      const metrics = createFontMetrics(FONT, letterSpacing)
      const paragraph = metrics.measureParagraph(TEXT)

      expect(paragraph).not.toBeNull()
      const softHyphens = (paragraph?.segments ?? []).filter(
        (segment) => segment.kind === "soft-hyphen",
      )

      expect(softHyphens.length).toBe(3)
      for (const segment of softHyphens) {
        expect(segment.lineEndWidth).toBe(
          metrics.hyphenWidth + 2 * letterSpacing,
        )
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
