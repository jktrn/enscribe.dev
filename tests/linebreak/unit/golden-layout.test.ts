import { describe, expect, test } from "bun:test"
import {
  type BreakKind,
  breakParagraph,
  type LayoutPass,
} from "@linebreak/layout/breaker"
import { texDefaults } from "@linebreak/layout/policy"
import { compile } from "./support/measure"

type GoldenLine = [
  start: number,
  end: number,
  naturalWidth: number,
  adjustmentRatio: number,
  breakKind: BreakKind,
]

type Golden = {
  readonly text: string
  readonly layouts: readonly {
    readonly measure: number
    readonly pass: LayoutPass
    readonly lines: GoldenLine[]
  }[]
}

const GOLDEN: readonly Golden[] = [
  {
    text: "The quick brown fox jumps over the lazy dog while the sun sets slowly behind the hill.",
    layouts: [
      {
        measure: 200,
        pass: "emergency",
        lines: [
          [0, 7, 190, 0.06451612903225806, "space"],
          [8, 15, 190, 0.06451612903225806, "space"],
          [16, 23, 170, 0.1935483870967742, "space"],
          [24, 29, 180, 0.13333333333333333, "space"],
          [30, 35, 90, 0.001098407309401368, "end"],
        ],
      },
      {
        measure: 320,
        pass: "pretolerance",
        lines: [
          [0, 11, 300, 0.8, "space"],
          [12, 25, 310, 0.3333333333333333, "space"],
          [26, 35, 230, 0.000899865020246963, "end"],
        ],
      },
      {
        measure: 480,
        pass: "pretolerance",
        lines: [
          [0, 19, 490, -0.3333333333333334, "space"],
          [20, 35, 360, 0.0011996401079676098, "end"],
        ],
      },
    ],
  },
  {
    text:
      "Typography is the craft of arranging type so that the reader never " +
      "has to think about it.",
    layouts: [
      {
        measure: 200,
        pass: "emergency",
        lines: [
          [0, 5, 170, 0.2, "space"],
          [6, 11, 180, 0.13333333333333333, "space"],
          [12, 19, 160, 0.25806451612903225, "space"],
          [20, 27, 190, 0.06451612903225806, "space"],
          [28, 35, 150, 0.0004992511233150275, "end"],
        ],
      },
      {
        measure: 320,
        pass: "emergency",
        lines: [
          [0, 9, 260, 0.375, "space"],
          [10, 19, 260, 0.375, "space"],
          [20, 31, 310, 0.06060606060606061, "space"],
          [32, 35, 30, 0.0028959456760535253, "end"],
        ],
      },
      {
        measure: 480,
        pass: "pretolerance",
        lines: [
          [0, 17, 490, -0.3750000000000001, "space"],
          [18, 35, 390, 0.000899685110211426, "end"],
        ],
      },
    ],
  },
]

const solve = (text: string, measure: number) =>
  breakParagraph(compile([text]), measure, { policy: texDefaults })

describe("the shipped layout of a known paragraph does not drift", () => {
  for (const { text, layouts } of GOLDEN) {
    for (const golden of layouts) {
      test(`"${text.slice(0, 24)}..." at ${golden.measure}px`, () => {
        const result = solve(text, golden.measure)
        expect(result.ok).toBe(true)
        if (!result.ok) return

        expect(result.pass).toBe(golden.pass)
        expect(
          result.lines.map(
            (line): GoldenLine => [
              line.start,
              line.end,
              line.naturalWidth,
              line.adjustmentRatio,
              line.breakKind,
            ],
          ),
        ).toEqual(golden.lines)
      })
    }
  }
})

describe("a golden layout still says what the reader sees", () => {
  for (const { text, layouts } of GOLDEN) {
    for (const golden of layouts) {
      test(`every character survives at ${golden.measure}px`, () => {
        const result = solve(text, golden.measure)
        expect(result.ok).toBe(true)
        if (!result.ok) return

        const rendered = result.lines
          .map((line) => text.slice(line.sourceStart, line.sourceEnd))
          .join(" ")
        expect(rendered).toBe(text)
      })
    }
  }
})
