import { describe, expect, test } from "bun:test"
import { optimizeParagraph } from "@linebreak/layout/knuth-plass"
import {
  type BreakOpportunity,
  ParagraphLineModel,
  type PreparedParagraph,
} from "@linebreak/layout/line-model"
import { SOFT_HYPHEN } from "@linebreak/text/markers"

const CHAR_WIDTH = 10
const HYPHEN_WIDTH = 5

const paragraph = (texts: string[]): PreparedParagraph => {
  let sourceOffset = 0
  return {
    segments: texts.map((text) => {
      const sourceStart = sourceOffset
      sourceOffset += text.replaceAll(SOFT_HYPHEN, "").length
      let breakAfter: BreakOpportunity = { kind: "none" }
      if (text === SOFT_HYPHEN) breakAfter = { kind: "hyphen" }
      else if (text === " ") breakAfter = { kind: "space" }
      return {
        text,
        sourceStart,
        sourceEnd: sourceOffset,
        width: text === SOFT_HYPHEN ? 0 : [...text].length * CHAR_WIDTH,
        edgeWidth: 0,
        discretionaryHyphenWidth: HYPHEN_WIDTH,
        breakAfter,
      }
    }),
  }
}

const optimize = (segments: string[], maxWidth: number) => {
  return optimizeParagraph(
    new ParagraphLineModel(paragraph(segments)),
    maxWidth,
  )
}

describe("discretionary hyphens", () => {
  test("treats a soft hyphen as an unconditional discretionary break", () => {
    const segments = ["aa", " ", "bb", " ", "ccc", SOFT_HYPHEN, "ddd"]
    const prepared = paragraph(segments)
    const model = new ParagraphLineModel(prepared)
    const candidateIndex = model.candidates.findIndex(
      ({ discretionaryHyphen }) => discretionaryHyphen,
    )
    const candidate = model.candidates[candidateIndex]
    prepared.segments[5].discretionaryHyphenWidth = 500
    const line = model.atWidth(100).measure(0, candidateIndex)
    const lines = optimizeParagraph(model, 100)

    expect(candidate?.penalty).toBe(0)
    expect(line.hyphenWidth).toBe(HYPHEN_WIDTH)
    expect(lines).not.toBeNull()
    expect(lines).toHaveLength(2)
    expect(lines?.[0]?.discretionaryHyphen).toBe(true)
    expect(lines?.[0]?.breakKind).toBe("hyphen")
  })
})

describe("singleton line invariant", () => {
  test("rejects an underfilled one-word line at a space break", () => {
    expect(optimize(["aaaaaaaaa", " ", "bb"], 100)).toBeNull()
  })

  test("normal prose wraps with adjustable spaces on every justified line", () => {
    const lines = optimize(["aa", " ", "bb", " ", "cc", " ", "dd"], 55)

    expect(lines).not.toBeNull()
    expect(lines!.length).toBeGreaterThanOrEqual(2)
    for (const line of lines!.slice(0, -1)) {
      expect(line.breakKind === "space" && line.spaceCount === 0).toBe(false)
    }
  })

  test("admits fixed content that already fills the line", () => {
    const prepared = paragraph(["aaaaaaaaa", " ", "bb"])
    prepared.segments[1].edgeWidth = 10

    const lines = optimizeParagraph(new ParagraphLineModel(prepared), 100)

    expect(lines).toHaveLength(2)
    expect(lines?.[0]).toMatchObject({
      breakKind: "space",
      end: 10,
      naturalWidth: 100,
      naturalBreakCount: 0,
      spaceCount: 0,
      spaceWidth: 0,
    })
  })
})

describe("space classification", () => {
  test("does not infer a break or adjustable space from a non-breaking space", () => {
    const prepared = paragraph(["aa", "\u00A0", "bb"])
    const model = new ParagraphLineModel(prepared)
    const line = model.atWidth(50).measure(0, 1)

    expect(model.candidates).toHaveLength(2)
    expect(line.spaceCount).toBe(0)
  })

  test("preserves a Pretext boundary on another Unicode separator", () => {
    const prepared = paragraph(["日", "\u2009", "本"])
    prepared.segments[1].breakAfter = { kind: "natural" }
    const model = new ParagraphLineModel(prepared)
    const line = model.atWidth(30).measure(0, 1)

    expect(model.candidates[1]?.kind).toBe("zero-width")
    expect(line.spaceCount).toBe(0)
    expect(line.naturalBreakCount).toBe(1)
  })
})

describe("Pretext break opportunities", () => {
  test("enables tracking on no-space lines with natural boundaries", () => {
    const prepared = paragraph(["日", "本", "語"])
    prepared.segments[0].breakAfter = { kind: "natural" }
    prepared.segments[1].breakAfter = { kind: "natural" }
    const model = new ParagraphLineModel(prepared)
    const line = model.atWidth(20.2).measure(0, 2)

    expect(line.naturalBreakCount).toBe(2)
    expect(line.letterSpacing).toBeCloseTo(0.1)
  })

  test("keeps a code penalty when it coincides with a natural boundary", () => {
    const prepared = paragraph(["aaaa", "bbbb"])
    prepared.segments[0].breakAfter = { kind: "natural", penalty: 300 }
    const model = new ParagraphLineModel(prepared)

    expect(model.candidates[1]?.penalty).toBe(300)
  })

  test("allows an explicit zero-width break without enabling tracking", () => {
    const prepared = paragraph(["aa", "\u200B", "bb"])
    prepared.segments[1].breakAfter = { kind: "explicit" }
    const model = new ParagraphLineModel(prepared)
    const line = model.atWidth(30).measure(0, 1)

    expect(line.breakKind).toBe("zero-width")
    expect(line.naturalBreakCount).toBe(0)
    expect(line.letterSpacing).toBe(0)
  })
})

describe("adjustment allocation", () => {
  test("keeps inline edges when trimming a break space", () => {
    const prepared = paragraph(["aa", " ", "bb", " ", "cc"])
    prepared.segments[1].edgeWidth = 7
    const line = new ParagraphLineModel(prepared).atWidth(100).measure(0, 1)

    expect(line.spaceWidth).toBe(0)
    expect(line.naturalWidth).toBe(2 * CHAR_WIDTH + 7)
  })

  test("caps word spacing and permits only quiet residual tracking", () => {
    const segments = ["aaaa", " ", "bbbb", " ", "xxxxxxxxx"]
    const lines = optimize(segments, 96)

    expect(lines).not.toBeNull()
    expect(lines).toHaveLength(2)
    expect(lines?.[0]?.spaceCount).toBe(1)
    expect(lines?.[0]?.wordSpacing).toBe(5)
    expect(lines?.[0]?.letterSpacing).toBeCloseTo(1 / 9)
  })

  test("rejects layouts that can only be filled with conspicuous tracking", () => {
    const segments = ["aa", " ", "bb", " ", "cccccccccccccccccccc"]
    expect(optimize(segments, 200)).toBeNull()
  })

  test("final lines stay ragged", () => {
    const segments = ["aaaa", " ", "bbbb", " ", "xxxxxxxxx"]
    const lines = optimize(segments, 96)

    expect(lines?.at(-1)?.breakKind).toBe("end")
  })

  test("counts grapheme clusters rather than Unicode code points for tracking", () => {
    const lines = optimize(["👍🏽", " ", "aaaa", " ", "xxxxxxx"], 75)

    expect(lines).not.toBeNull()
    expect(lines).toHaveLength(2)
    expect(lines?.[0]?.characterCount).toBe(6)
  })
})

describe("inline-code boundaries", () => {
  test("admits a well-filled zero-width break without forcing tracking", () => {
    const prepared = paragraph(["aaaa", "bbbb", "cccc"])
    prepared.segments[1].breakAfter = { kind: "explicit", penalty: 300 }
    const lines = optimizeParagraph(new ParagraphLineModel(prepared), 100)

    expect(lines).not.toBeNull()
    expect(lines).toHaveLength(2)
    expect(lines?.[0]?.breakKind).toBe("zero-width")
    expect(lines?.[0]?.letterSpacing).toBe(0)
  })
})
