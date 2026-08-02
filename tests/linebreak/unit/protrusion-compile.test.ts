import { describe, expect, test } from "bun:test"
import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import { compileBlock } from "@linebreak/layout/compile"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"
import { CHARACTER, compileShape, HYPHEN, metrics, SHY } from "./support/measure"

const STOP = 0.7 * CHARACTER
const OPEN_QUOTE = 0.3 * CHARACTER
const CLOSE_QUOTE = 0.3 * CHARACTER
const DASH = 0.5 * HYPHEN

const hangsOf = (
  texts: readonly string[],
  shape: {
    trailingEdge?: number
    leadingEdge?: number
    localName?: string
    hyphenates?: boolean
  } = {},
) => {
  const compiled = compileShape(
    { texts, ...shape },
    { protrude: true, hyphenate: shape.hyphenates === true },
  )
  if (!compiled.hangs) throw new Error("compileBlock returned no hangs")
  return { items: compiled.items, ...compiled.hangs }
}

const lastEnd = (result: ReturnType<typeof hangsOf>) =>
  result.end[result.items.length - 1]

describe("credits from the text", () => {
  test("a closing stop hangs into the right margin", () => {
    const result = hangsOf(["hello world."])

    expect(lastEnd(result)).toBeCloseTo(STOP, 9)
  })

  test("an opening quote hangs into the left margin", () => {
    const result = hangsOf(["“hello world”"])

    expect(result.start[0]).toBeCloseTo(OPEN_QUOTE, 9)
    expect(lastEnd(result)).toBeCloseTo(CLOSE_QUOTE, 9)
  })

  test("a materialized hyphen hangs by its own drawn width", () => {
    const result = hangsOf([`anti${SHY}disestablishmentarian`])

    expect(result.items[1]?.kind).toBe("discretionary")
    expect(result.end[1]).toBeCloseTo(DASH, 9)
  })

  test("an ordinary word earns nothing at either edge", () => {
    const result = hangsOf(["hello world"])

    expect(result.start[0]).toBe(0)
    expect(lastEnd(result)).toBe(0)
  })

  test("protrusion off returns no hangs at all", () => {
    expect(compileShape({ texts: ["hello world."] }).hangs).toBe(null)
  })
})

describe("suppression", () => {
  test("a folded wrapper edge cancels the segment's credits", () => {
    const bare = hangsOf(["“hello world”"])
    const edged = hangsOf(["“hello world”"], { leadingEdge: 6, trailingEdge: 12 })

    expect(bare.start[0]).toBeGreaterThan(0)
    expect(lastEnd(bare)).toBeGreaterThan(0)
    expect(edged.start[0]).toBe(0)
    expect(lastEnd(edged)).toBe(0)
  })

  test("a trailing edge alone cancels only the segments it touches", () => {
    const edged = hangsOf(["“hello world”"], { trailingEdge: 12 })

    expect(edged.start[0]).toBeCloseTo(OPEN_QUOTE, 9)
    expect(lastEnd(edged)).toBe(0)
  })

  test("a trailing edge reaches the last box of a hyphenated segment", () => {
    const shape = { hyphenates: true, trailingEdge: 12 }
    const bare = hangsOf(["“hello disestablishment”"], { hyphenates: true })
    const edged = hangsOf(["“hello disestablishment”"], shape)

    expect(bare.items.filter((item) => item.kind === "box").length).toBeGreaterThan(2)
    expect(lastEnd(bare)).toBeCloseTo(CLOSE_QUOTE, 9)
    expect(lastEnd(edged)).toBe(0)
  })

  test("an edge deferred onto an earlier box cancels that box's credits", () => {
    const bare = hangsOf([`“beta.${SHY}`, "gamma"])
    const edged = hangsOf([`“beta.${SHY}`, "gamma"], { trailingEdge: 12 })

    expect(bare.start[0]).toBeCloseTo(OPEN_QUOTE, 9)
    expect(bare.end[2]).toBeCloseTo(STOP, 9)
    expect(edged.start[0]).toBe(0)
    expect(edged.end[2]).toBe(0)
  })

  test("nothing inside a code wrapper protrudes", () => {
    const result = hangsOf(["“hello world.”"], { localName: "code" })

    expect([...result.start].every((value) => value === 0)).toBe(true)
    expect([...result.end].every((value) => value === 0)).toBe(true)
  })

  test("an atom earns no credit on either side", () => {
    const wrapper = {} as HTMLElement
    const image = {} as Element
    const runs: InlineRun[] = [
      {
        kind: "atom",
        text: "￼",
        start: 0,
        end: 1,
        wrappers: [],
        sourceElement: image,
      },
      {
        kind: "text",
        text: " tail.",
        start: 1,
        end: 7,
        wrappers: [],
        sourceElement: wrapper,
        hyphenates: false,
      },
    ]
    const block: ExtractedBlock = {
      text: "￼ tail.",
      runs,
      breakRestrictions: [],
      wrappers: new Map(),
    }
    const compiled = compileBlock({
      block,
      metricsFor: () => metrics,
      atomWidth: () => 40,
      locale: "en-US",
      policy: texDefaults,
      glue: defaultGlue,
      protrude: true,
    })

    expect(compiled.ok).toBe(true)
    if (!compiled.ok || !compiled.hangs) return
    expect(compiled.items[0]?.kind).toBe("box")
    expect(compiled.hangs.start[0]).toBe(0)
    expect(compiled.hangs.end[0]).toBe(0)
    expect(compiled.hangs.end[compiled.items.length - 1]).toBeCloseTo(STOP, 9)
  })
})

describe("edge characters are code points", () => {
  test("a surrogate pair is not read as two lookups", () => {
    const result = hangsOf(["𝐀𝐁 word"])

    expect(result.start[0]).toBe(0)
  })

  test("a stop after a surrogate pair still hangs", () => {
    const result = hangsOf(["word 𝐀."])

    expect(lastEnd(result)).toBeCloseTo(STOP, 9)
  })

  test("a combining mark is the edge character, not the stop under it", () => {
    expect(lastEnd(hangsOf(["word ."]))).toBeCloseTo(STOP, 9)
    expect(lastEnd(hangsOf(["word .́"]))).toBe(0)
  })
})
