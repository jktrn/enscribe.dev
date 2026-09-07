import { describe, expect, test } from "bun:test"
import { breakPenalty, type Item } from "@linebreak/layout/items"
import { INFINITE_PENALTY } from "@linebreak/layout/policy"
import { codeBreakOffsets } from "@linebreak/text/code-breaks"

const discretionaryAt = (penalty: number): Item[] => [
  { kind: "box", width: 10, source: { start: 0, end: 4 } },
  {
    kind: "discretionary",
    preWidth: 0,
    postWidth: 10,
    noBreakWidth: 20,
    penalty,
    hyphen: false,
    source: { start: 4, end: 4 },
    breakOffset: 4,
  },
]

describe("break offsets", () => {
  test.each([
    ["a.b", [[2, 3000]]],
    ["a/4", [[2, 3000]]],
    ["a.4", [[2, 3000]]],
    ["4.a", [[2, 3000]]],
    ["3,4", [[2, 3000]]],
    ["ns:item", [[3, 3000]]],
    ["ns::item", [[4, 3000]]],
    ["a.:b", [[2, 3000], [3, 3000]]],
    ["a)b", [[2, 4500]]],
    ["a]b", [[2, 4500]]],
    ["a}b", [[2, 4500]]],
    ["a&&b", [[3, 5500]]],
    ["a_b", [[2, 7500]]],
    ["aB", [[1, 8500]]],
    ["AB", []],
    ["ABcd", [[1, 8500]]],
    ["a2", [[1, 9000]]],
    ["2a", [[1, 9000]]],
    ["abcde", [[2, 9500]]],
    [
      "abcdef",
      [
        [3, 9500],
        [4, 9500],
      ],
    ],
    [
      "abcDef",
      [
        [3, 8500],
        [4, 9500],
      ],
    ],
    ["e\u0301abcd", [[3, 9500]]],
  ] as [
    string,
    [number, number][],
  ][])("lexical penalties preserve priority and graphemes in %s", (text, expected) => {
    expect([...codeBreakOffsets(text)].sort(([a], [b]) => a - b)).toEqual(
      expected,
    )
  })

  test("every offset lands inside the text", () => {
    const text = "GachaManager.cs"
    for (const offset of codeBreakOffsets(text).keys()) {
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThan(text.length)
    }
  })

  test("a path breaks after its separators", () => {
    const offsets = codeBreakOffsets("src/lib/typography.ts")

    expect(offsets.has(4)).toBe(true)
    expect(offsets.has(8)).toBe(true)
  })

  test("a long unbroken identifier still offers somewhere to break", () => {
    expect(codeBreakOffsets("abcdefghijklmnopqrst").size).toBeGreaterThan(0)
  })
})

describe("every offered break is one the optimizer can take", () => {
  test("no price reaches the threshold that forbids breaking", () => {
    const sampled = [
      "GachaManager.cs",
      "src/lib/typography.ts",
      "parseHTTPResponse2Body",
      "abcdefghijklmnopqrst",
      "amateursCTF{crt_really_is_too_op}",
    ]
    for (const text of sampled) {
      for (const penalty of codeBreakOffsets(text).values()) {
        expect(penalty).toBeLessThan(INFINITE_PENALTY)
      }
    }
  })

  test("a discretionary priced at a code break is breakable", () => {
    for (const penalty of codeBreakOffsets("parseHTTPResponse2Body").values()) {
      expect(breakPenalty(discretionaryAt(penalty), 1)).toBe(penalty)
    }
  })
})
