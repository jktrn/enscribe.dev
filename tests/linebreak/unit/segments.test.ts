import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  createMetrics,
  type SegmentKind,
  segmentText,
  type TextSegment,
} from "@linebreak/text/segments"

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
  value: StubOffscreenCanvas,
  configurable: true,
  writable: true,
})

const { createFontMetrics } = await import("@linebreak/text/measure")

const prose = readFileSync(new URL("./support/prose.txt", import.meta.url))
  .toString()
  .split("\n")
  .filter((line) => line.length > 0)

type Placed = { readonly start: number; readonly kind: SegmentKind }

const breakOffsets = (segments: readonly Placed[]) => {
  const offsets = new Set<number>()
  let previous: SegmentKind | null = null
  for (const { start, kind } of segments) {
    if (
      (previous === "text" && kind === "text") ||
      kind === "break-opportunity" ||
      previous === "break-opportunity"
    ) {
      offsets.add(start)
    }
    if (kind === "space" || kind === "soft-hyphen") offsets.add(start)
    previous = kind
  }
  return offsets
}

const pretextOffsets = (text: string) => {
  const measured = createFontMetrics("16px serif", 0).measureParagraph(text)
  if (!measured) throw new Error(`pretext declined ${text.slice(0, 40)}`)
  return breakOffsets(measured.segments)
}

const absentFrom = (
  offsets: ReadonlySet<number>,
  other: ReadonlySet<number>,
) => {
  let count = 0
  for (const offset of offsets) if (!other.has(offset)) count += 1
  return count
}

const kindsOf = (text: string) => segmentText(text).map(({ kind }) => kind)

const textsOf = (text: string) => segmentText(text).map((piece) => piece.text)

test("the fixture is the corpus this package was measured on", () => {
  expect(prose.length).toBe(127)
  expect(prose.filter((line) => /[—–―]/u.test(line)).length).toBe(19)
})

test("the scanner agrees with pretext on where a line may break", () => {
  let expected = 0
  let extra = 0
  let missing = 0

  for (const paragraph of prose) {
    const fromPretext = pretextOffsets(paragraph)
    const fromScanner = breakOffsets(segmentText(paragraph))
    expected += fromPretext.size
    extra += absentFrom(fromScanner, fromPretext)
    missing += absentFrom(fromPretext, fromScanner)
  }

  expect(expected).toBe(12_555)
  expect(extra).toBeLessThanOrEqual(1)
  expect(missing).toBeLessThanOrEqual(4)
})

test("the scanner tiles every paragraph it is given", () => {
  for (const paragraph of prose) {
    const segments = segmentText(paragraph)
    let offset = 0
    for (const segment of segments) {
      expect(segment.start).toBe(offset)
      expect(segment.text).toBe(paragraph.slice(segment.start, segment.end))
      offset = segment.end
    }
    expect(offset).toBe(paragraph.length)
  }
})

test("a soft hyphen is a segment of its own", () => {
  expect(textsOf("co­operate")).toEqual(["co", "­", "operate"])
  expect(kindsOf("co­operate")).toEqual(["text", "soft-hyphen", "text"])
})

test("zero-width space permits breaks while word joiners stay in text", () => {
  expect(kindsOf("a​b")).toEqual(["text", "break-opportunity", "text"])
  expect(kindsOf("a﻿b")).toEqual(["text"])
  expect(kindsOf("a⁠b")).toEqual(["text"])
})

test("a stray newline, tab or carriage return classifies as space", () => {
  expect(textsOf("one\ntwo")).toEqual(["one", "\n", "two"])
  expect(kindsOf("one\ttwo")).toEqual(["text", "space", "text"])
  expect(textsOf("one \r\n two")).toEqual(["one", " \r\n ", "two"])
})

test("Unicode GL figure spaces keep adjacent text indivisible", () => {
  expect(textsOf("a\u2007b")).toEqual(["a\u2007b"])
  expect(kindsOf("a\u2007b")).toEqual(["text"])
})

test("an em dash breaks the word on both sides", () => {
  expect(textsOf("word—word")).toEqual(["word", "—", "word"])
  expect(textsOf("a–b—c")).toEqual(["a", "–", "b", "—", "c"])
})

test("a hyphen ends the word it follows and keeps its own segment", () => {
  expect(textsOf("well-known")).toEqual(["well-", "known"])
  expect(textsOf("x--y")).toEqual(["x--", "y"])
  expect(textsOf("re-­do")).toEqual(["re-", "­", "do"])
})

test("closing punctuation stays with the dash it follows", () => {
  expect(textsOf("say—”")).toEqual(["say", "—”"])
  expect(textsOf("wait—, then")).toEqual(["wait", "—,", " ", "then"])
})

test("createMetrics gives a soft hyphen no width until it ends a line", () => {
  const metrics = createMetrics({
    measure: (text) => [...text].length * ADVANCE,
    letterSpacing: 0.25,
  })
  const measured = metrics.measureParagraph("co­operate")

  expect(measured?.segments[1]?.width).toBe(0)
  expect(measured?.segments[1]?.lineEndWidth).toBe(ADVANCE)
  expect(metrics.hyphenWidth).toBe(ADVANCE)
})

test("zero-width break markers do not gain a provider's isolated character width", () => {
  const metrics = createMetrics({ measure: (text) => text.length * ADVANCE })
  const measured = metrics.measureParagraph("x\u200by")
  expect(measured?.segments.map(({ width }) => width)).toEqual([ADVANCE, 0, ADVANCE])
  expect(measured?.segments.map(({ start, end }) => [start, end])).toEqual([[0, 1], [1, 2], [2, 3]])
})

test("createMetrics measures the segments a custom segmenter returns", () => {
  const segment = (text: string): TextSegment[] => [
    { text, start: 0, end: text.length, kind: "text" },
  ]
  const metrics = createMetrics({ measure: () => 3, segment })

  expect(metrics.measureParagraph("a b")?.segments).toEqual([
    { text: "a b", start: 0, end: 3, kind: "text", width: 3, lineEndWidth: 0 },
  ])
})

test("a custom segmenter that mislays text is declined, not measured", () => {
  const gap = (text: string): TextSegment[] => [
    { text: text.slice(0, 1), start: 0, end: 1, kind: "text" },
    { text: text.slice(2), start: 2, end: text.length, kind: "text" },
  ]
  const short = (text: string): TextSegment[] => [
    { text: text.slice(0, 1), start: 0, end: 1, kind: "text" },
  ]
  const lying = (text: string): TextSegment[] => [
    { text, start: 0, end: text.length + 1, kind: "text" },
  ]

  expect(
    createMetrics({ measure: () => 3, segment: gap }).measureParagraph("abc"),
  ).toBeNull()
  expect(
    createMetrics({ measure: () => 3, segment: short }).measureParagraph("abc"),
  ).toBeNull()
  expect(
    createMetrics({ measure: () => 3, segment: lying }).measureParagraph("abc"),
  ).toBeNull()
})

test("a custom segmenter cannot substitute equal-length source content", () => {
  const measured: string[] = []
  const metrics = createMetrics({
    measure: (text) => {
      measured.push(text)
      return text.length
    },
    segment: () => [{ text: "beta", start: 0, end: 4, kind: "text" }],
  })
  expect(metrics.measureParagraph("atom")).toBeNull()
  expect(measured).toEqual(["-"])
})

test("custom segment starts cannot wrap backward through string slicing", () => {
  const metrics = createMetrics({
    measure: (text) => text.length,
    segment: () => [
      { text: "aa", start: 0, end: 2, kind: "text" },
      { text: "aa", start: -2, end: 4, kind: "text" },
    ],
  })
  expect(metrics.measureParagraph("aaaa")).toBeNull()
})

test("custom segment ends cannot use fractional string-slice boundaries", () => {
  const metrics = createMetrics({
    measure: (text) => text.length,
    segment: () => [
      { text: "a", start: 0, end: 1.5, kind: "text" },
      { text: "bc", start: 1.5, end: 3, kind: "text" },
    ],
  })
  expect(metrics.measureParagraph("abc")).toBeNull()
})
