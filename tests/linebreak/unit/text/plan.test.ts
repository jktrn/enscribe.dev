import { describe, expect, test } from "bun:test"
import { SOFT_HYPHEN } from "@linebreak/text/markers"
import { planParagraph, type TextPlanSource } from "@linebreak/text/plan"

type PretextSegments = Parameters<typeof planParagraph>[1]

const pretext = (segments: string[], kinds: string[]) =>
  ({ segments, kinds }) as PretextSegments

const source = (
  text: string,
  {
    items = [{ start: 0, end: text.length, hyphenate: true }],
    codeRanges = [],
    breakRestrictions = [],
  }: Partial<
    Pick<TextPlanSource, "items" | "codeRanges" | "breakRestrictions">
  > = {},
): TextPlanSource => ({ text, items, codeRanges, breakRestrictions })

describe("paragraph planning", () => {
  test("item boundaries split text without inventing breaks", () => {
    const planned = planParagraph(
      source("foobar", {
        items: [
          { start: 0, end: 3, hyphenate: true },
          { start: 3, end: 6, hyphenate: true },
        ],
      }),
      pretext(["foobar"], ["text"]),
      "",
    )

    expect(planned?.map(({ text }) => text)).toEqual(["foo", "bar"])
    expect(planned?.map(({ breakAfter }) => breakAfter)).toEqual([
      { kind: "none" },
      { kind: "none" },
    ])
  })

  test("one code range can span items without receiving hyphens", () => {
    const text = "longIdentifierName"
    const planned = planParagraph(
      source(text, {
        items: [
          { start: 0, end: 4, hyphenate: false },
          { start: 4, end: text.length, hyphenate: false },
        ],
        codeRanges: [{ start: 0, end: text.length }],
      }),
      pretext([text], ["text"]),
      "en-US",
    )

    expect(planned?.some(({ text }) => text === SOFT_HYPHEN)).toBe(false)
    expect(
      planned?.find(({ sourceEnd }) => sourceEnd === 4)?.breakAfter,
    ).toEqual({ kind: "explicit", penalty: 1_100 })
  })

  test("removes every forbidden break without closing range endpoints", () => {
    const text = "before extraordinary longIdentifierName after"
    const start = text.indexOf("extraordinary")
    const end = start + "extraordinary longIdentifierName".length
    const planned = planParagraph(
      source(text, {
        items: [
          { start: 0, end: start, hyphenate: true },
          { start, end, hyphenate: false },
          { start: end, end: text.length, hyphenate: true },
        ],
        codeRanges: [{ start, end }],
        breakRestrictions: [{ start: start + 1, end }],
      }),
      pretext(
        ["before ", "extraordinary ", "longIdentifierName ", "after"],
        ["text", "text", "text", "text"],
      ),
      "en-US",
    )

    const internalBreaks = planned?.filter(
      ({ sourceEnd, breakAfter }) =>
        sourceEnd > start && sourceEnd < end && breakAfter.kind !== "none",
    )
    expect(internalBreaks).toEqual([])
    expect(
      planned?.some(
        ({ itemIndex, text: segment }) =>
          itemIndex === 1 && segment === SOFT_HYPHEN,
      ),
    ).toBe(false)
    expect(
      planned?.find(({ sourceEnd }) => sourceEnd === text.indexOf("after"))
        ?.breakAfter,
    ).toEqual({ kind: "space" })
  })

  test("can forbid a collapsed-space break at a source endpoint", () => {
    const text = "aaaa bbbb"
    const prepared = pretext(["aaaa ", "bbbb"], ["text", "text"])
    const breakAtSpace = (
      breakRestrictions: TextPlanSource["breakRestrictions"],
    ) =>
      planParagraph(source(text, { breakRestrictions }), prepared, "")?.find(
        ({ sourceEnd }) => sourceEnd === 5,
      )?.breakAfter

    expect(breakAtSpace([{ start: 1, end: 5 }])).toEqual({ kind: "natural" })
    expect(breakAtSpace([{ start: 1, end: 6 }])).toEqual({ kind: "none" })
  })

  test("hyphenates prose around an inline item without changing it", () => {
    const text = "extraordinary inlineCode extraordinary"
    const codeStart = text.indexOf("inlineCode")
    const codeEnd = codeStart + "inlineCode".length
    const planned = planParagraph(
      source(text, {
        items: [
          { start: 0, end: codeStart, hyphenate: true },
          { start: codeStart, end: codeEnd, hyphenate: false },
          { start: codeEnd, end: text.length, hyphenate: true },
        ],
        codeRanges: [{ start: codeStart, end: codeEnd }],
      }),
      pretext([text], ["text"]),
      "en-US",
    )

    expect(
      planned
        ?.map(({ text: segment }) => segment)
        .join("")
        .replaceAll(SOFT_HYPHEN, ""),
    ).toBe(text)
    expect(
      planned?.filter(({ text: segment }) => segment === SOFT_HYPHEN),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemIndex: 0 }),
        expect.objectContaining({ itemIndex: 2 }),
      ]),
    )
    expect(
      planned?.some(
        ({ itemIndex, text: segment }) =>
          itemIndex === 1 && segment === SOFT_HYPHEN,
      ),
    ).toBe(false)
  })

  test("English alone receives automatic discretionary hyphens", () => {
    const text = "extraordinary"
    const prepared = pretext([text], ["text"])
    const hasHyphen = (language: string) =>
      planParagraph(source(text), prepared, language)?.some(
        ({ text: segment }) => segment === SOFT_HYPHEN,
      )

    expect(hasHyphen("en-US")).toBe(true)
    expect(hasHyphen("fr")).toBe(false)
    expect(hasHyphen("")).toBe(false)
  })

  test("keeps UTF-16 offsets exact and rejects malformed segmentation", () => {
    const text = "A👍🏽B"
    const planned = planParagraph(
      source(text),
      pretext(["A", "👍🏽", "B"], ["text", "text", "text"]),
      "",
    )

    expect(
      planned?.map(({ sourceStart, sourceEnd }) => [sourceStart, sourceEnd]),
    ).toEqual([
      [0, 1],
      [1, 5],
      [5, 6],
    ])
    expect(
      planParagraph(
        source(text),
        pretext(["A", "👍", "B"], ["text", "text", "text"]),
        "",
      ),
    ).toBeNull()
  })
})
