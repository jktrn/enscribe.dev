import { describe, expect, test } from "bun:test"
import { SOFT_HYPHEN } from "@linebreak/text/markers"
import {
  makeSourceOffsets,
  mapBreakOffsets,
  pretextBreakOffsets,
  sliceHyphenatedRanges,
  splitAtSourceOffsets,
  splitPreparedSegments,
} from "@linebreak/text/breaks"

type PretextSegments = Parameters<typeof pretextBreakOffsets>[0]

const mapPreparedBreaks = (
  prepared: PretextSegments,
  targetSegments: string[],
) => {
  const source = prepared.segments.join("").replaceAll(SOFT_HYPHEN, "")
  const breaks = pretextBreakOffsets(prepared, source)
  const targetOffsets = makeSourceOffsets(targetSegments, source)
  return breaks && targetOffsets
    ? mapBreakOffsets(
        breaks,
        targetSegments.map((text, index) => ({
          text,
          sourceStart: targetOffsets[index],
          sourceEnd: targetOffsets[index + 1],
        })),
      )?.map(({ textBreakAfter }) => textBreakAfter)
    : null
}

describe("source offset mapping", () => {
  test("keeps UTF-16 offsets correct across emoji and soft hyphens", () => {
    const segments = ["👍🏽", "ab", SOFT_HYPHEN, "cd"]
    const source = "👍🏽abcd"

    expect(makeSourceOffsets(segments, source)).toEqual([0, 4, 6, 6, 8])
  })

  test("slices inserted soft hyphens at inline-item boundaries", () => {
    const hyphenated = `encyclo${SOFT_HYPHEN}pedia`

    expect(
      sliceHyphenatedRanges(hyphenated, [
        { start: 0, end: 7 },
        { start: 7, end: 12 },
      ]),
    ).toEqual([`encyclo${SOFT_HYPHEN}`, "pedia"])
  })

  test("keeps UTF-16 boundaries while slicing ranges in one pass", () => {
    expect(
      sliceHyphenatedRanges(`👍🏽ency${SOFT_HYPHEN}clopedia`, [
        { start: 0, end: 4 },
        { start: 4, end: 16 },
      ]),
    ).toEqual(["👍🏽", `ency${SOFT_HYPHEN}clopedia`])
  })
})

describe("paragraph-wide Pretext break mapping", () => {
  test("splits paragraph segments at inline boundaries without inventing breaks", () => {
    expect(
      splitPreparedSegments(
        ["（日", "本。"],
        "（日本。",
        "（日本。",
        [1, 2, 3],
      ),
    ).toEqual([
      {
        text: "（",
        parentIndex: 0,
        reusesPreparedWidth: false,
        sourceStart: 0,
        sourceEnd: 1,
      },
      {
        text: "日",
        parentIndex: 0,
        reusesPreparedWidth: false,
        sourceStart: 1,
        sourceEnd: 2,
      },
      {
        text: "本",
        parentIndex: 1,
        reusesPreparedWidth: false,
        sourceStart: 2,
        sourceEnd: 3,
      },
      {
        text: "。",
        parentIndex: 1,
        reusesPreparedWidth: false,
        sourceStart: 3,
        sourceEnd: 4,
      },
    ])
  })

  test("inserts discretionary hyphens into the paragraph segment plan", () => {
    expect(
      splitPreparedSegments(
        ["encyclopedia", " ", "日本"],
        "encyclopedia 日本",
        `encyclo${SOFT_HYPHEN}pedia 日本`,
        [],
      ),
    ).toEqual([
      {
        text: "encyclo",
        parentIndex: 0,
        reusesPreparedWidth: false,
        sourceStart: 0,
        sourceEnd: 7,
      },
      {
        text: SOFT_HYPHEN,
        parentIndex: 0,
        reusesPreparedWidth: false,
        sourceStart: 7,
        sourceEnd: 7,
      },
      {
        text: "pedia",
        parentIndex: 0,
        reusesPreparedWidth: false,
        sourceStart: 7,
        sourceEnd: 12,
      },
      {
        text: " ",
        parentIndex: 1,
        reusesPreparedWidth: true,
        sourceStart: 12,
        sourceEnd: 13,
      },
      {
        text: "日本",
        parentIndex: 2,
        reusesPreparedWidth: true,
        sourceStart: 13,
        sourceEnd: 15,
      },
    ])
  })

  test("rejects a hyphenated stream that does not reconstruct the source", () => {
    expect(splitPreparedSegments(["日本"], "日本", "日語", [])).toBeNull()
  })

  test("cuts a locally merged segment at a paragraph boundary", () => {
    expect(splitAtSourceOffsets("-456", [1])).toEqual(["-", "456"])
    expect(splitAtSourceOffsets(`encyclo${SOFT_HYPHEN}pedia`, [7])).toEqual([
      `encyclo${SOFT_HYPHEN}`,
      "pedia",
    ])
  })

  test("preserves a natural break across an inline-item boundary", () => {
    expect(
      mapPreparedBreaks({ segments: ["日", "本"], kinds: ["text", "text"] }, [
        "日",
        "本",
      ]),
    ).toEqual(["natural", "none"])
  })

  test("does not invent breaks when styles split glued punctuation", () => {
    expect(
      mapPreparedBreaks(
        { segments: ["（日", "本。"], kinds: ["text", "text"] },
        ["（", "日", "本", "。"],
      ),
    ).toEqual(["none", "natural", "none", "none"])
  })

  test("keeps soft hyphens on their dedicated break path", () => {
    expect(
      mapPreparedBreaks(
        {
          segments: ["encyclopedia", "日", "本"],
          kinds: ["text", "text", "text"],
        },
        ["encyclo", SOFT_HYPHEN, "pedia", "日", "本"],
      ),
    ).toEqual(["none", "none", "natural", "natural", "none"])
  })

  test("maps an explicit zero-width break without enabling tracking", () => {
    expect(
      mapPreparedBreaks(
        {
          segments: ["foo", "\u200B", "bar"],
          kinds: ["text", "zero-width-break", "text"],
        },
        ["foo", "\u200B", "bar"],
      ),
    ).toEqual(["none", "explicit", "none"])
  })

  test("rejects segmentations that do not reconstruct the same source", () => {
    expect(
      mapPreparedBreaks({ segments: ["日", "本"], kinds: ["text", "text"] }, [
        "日",
        "語",
      ]),
    ).toBeNull()
  })
})
