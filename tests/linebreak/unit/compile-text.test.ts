import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { breakParagraph } from "@linebreak/layout/breaker"
import type { Item, ItemSource } from "@linebreak/layout/items"
import { texDefaults } from "@linebreak/layout/policy"
import {
  calibrateStretch,
  type CompileResult,
  compileText,
  type ComposeReason,
  createMetrics,
} from "@linebreak/text"
import { englishHyphenator } from "@linebreak/text/hyphenate"

const measure = (text: string) => {
  let width = 0
  for (const character of text) {
    width += 4 + ((character.codePointAt(0) as number) % 7)
  }
  return width
}

const metrics = createMetrics({ measure, font: "16px serif" })

const prose = readFileSync(new URL("./support/prose.txt", import.meta.url))
  .toString()
  .split("\n")
  .filter((line) => line.length > 0)

const itemsOf = (result: CompileResult) => {
  if (!result.ok) throw new Error(`compileText declined: ${result.reason}`)
  return result.items
}

const kindsIn = (items: readonly Item[]) =>
  new Set(items.map((item) => item.kind))

const scale = calibrateStretch(0.02, (pct) => 100 * (1 + (pct - 100) / 100))

const reconstruct = (paragraph: string, target: number) => {
  const compiled = compileText(paragraph, metrics, {
    hyphenate: englishHyphenator,
    policy: { tolerance: 10_000 },
  })
  if (!compiled.ok) return { ok: false as const, reason: compiled.reason }

  const solved = breakParagraph(compiled.items, target, {
    policy: texDefaults,
  })
  if (!solved.ok) return { ok: false as const, reason: "no-solution" }

  let rebuilt = ""
  for (const [index, line] of solved.lines.entries()) {
    if (solved.lines[index - 1]?.breakKind === "space") rebuilt += " "
    rebuilt += paragraph.slice(line.sourceStart, line.sourceEnd)
  }
  return { ok: true as const, rebuilt, lines: solved.lines.length }
}

test("every fixture paragraph compiles, breaks and reads back character for character", () => {
  let laid = 0
  let exact = 0
  let lines = 0

  for (const paragraph of prose) {
    const result = reconstruct(paragraph, 480)
    if (!result.ok) continue
    laid += 1
    lines += result.lines
    if (result.rebuilt === paragraph) exact += 1
  }

  expect(laid).toBe(127)
  expect(exact).toBe(127)
  expect(lines).toBeGreaterThan(500)
})

test("the same paragraphs read back at a width that forces hyphenation", () => {
  let hyphenated = 0
  let exact = 0

  for (const paragraph of prose) {
    const result = reconstruct(paragraph, 120)
    if (!result.ok) continue
    if (result.rebuilt === paragraph) exact += 1
    const compiled = compileText(paragraph, metrics, {
      hyphenate: englishHyphenator,
    })
    if (compiled.ok && kindsIn(compiled.items).has("discretionary")) {
      hyphenated += 1
    }
  }

  expect(exact).toBe(127)
  expect(hyphenated).toBe(127)
})

test("a string with nothing to set is declined as empty", () => {
  const declined = compileText("", metrics)

  expect(declined).toEqual({ ok: false, reason: "empty" })
})

test("without a hyphenator a long word compiles to a single box", () => {
  const items = itemsOf(compileText("antidisestablishmentarianism", metrics))

  expect(items.filter((item) => item.kind === "box")).toHaveLength(1)
  expect(kindsIn(items).has("discretionary")).toBe(false)
})

test("a hyphenator adds a flagged discretionary at every legal split", () => {
  const items = itemsOf(
    compileText("antidisestablishmentarianism", metrics, {
      hyphenate: englishHyphenator,
    }),
  )
  const breaks = items.filter((item) => item.kind === "discretionary")

  expect(breaks.length).toBeGreaterThan(4)
  expect(breaks.every((item) => item.hyphen)).toBe(true)
})

test("the locale reaches the hyphenator unchanged", () => {
  const seen: string[] = []
  compileText("hyphenation", metrics, {
    locale: "en-GB",
    hyphenate: (_word, locale) => {
      seen.push(locale)
      return []
    },
  })

  expect(seen).toEqual(["en-GB"])
})

test("code reroutes the break opportunities to the code table", () => {
  const source = "renderLines.forEach"
  const prose = itemsOf(
    compileText(source, metrics, { hyphenate: englishHyphenator }),
  )
  const code = itemsOf(
    compileText(source, metrics, { code: true, hyphenate: englishHyphenator }),
  )

  const at = (items: readonly Item[]) =>
    items
      .filter((item) => item.kind === "discretionary")
      .map((item) => [(item.source as ItemSource).start, item.penalty])

  expect(at(code)).toEqual([
    [5, 9500],
    [6, 8500],
    [8, 9500],
    [12, 3000],
    [15, 8500],
    [17, 9500],
  ])
  expect(at(prose)).not.toEqual(at(code))

  const asked: string[] = []
  compileText(source, metrics, {
    code: true,
    hyphenate: (word) => {
      asked.push(word)
      return []
    },
  })
  expect(asked).toEqual([])
})

test("protrusion is off unless it is asked for, and comes back as hangs", () => {
  const off = compileText("“Hello, world.”", metrics)
  const on = compileText("“Hello, world.”", metrics, { protrude: true })

  expect(off.ok && off.hangs).toBeNull()
  expect(on.ok && on.hangs?.start).toBeInstanceOf(Float64Array)
  if (!on.ok || !on.hangs) throw new Error("expected hangs")
  expect(on.hangs.start[0]).toBeGreaterThan(0)
  expect(on.hangs.end.at(-1)).toBeGreaterThan(0)
})

test("code suppresses protrusion the way a code wrapper does", () => {
  const compiled = compileText("“quoted”", metrics, {
    protrude: true,
    code: true,
  })
  if (!compiled.ok || !compiled.hangs) throw new Error("expected hangs")

  expect([...compiled.hangs.start].every((value) => value === 0)).toBe(true)
  expect([...compiled.hangs.end].every((value) => value === 0)).toBe(true)
})

test("expansion needs a calibrated scale and returns one back", () => {
  if (!scale) throw new Error("calibrateStretch returned no scale")
  const off = compileText("some prose to stretch", metrics)
  const on = compileText("some prose to stretch", metrics, { expand: scale })

  expect(off.ok && off.expansion).toBeNull()
  expect(off.ok && off.scale).toBeNull()
  expect(on.ok && on.scale).toBe(scale)
  expect(on.ok && on.expansion?.stretch).toBeInstanceOf(Float64Array)
})

test("tracking takes a fraction of each box and pools with expansion", () => {
  if (!scale) throw new Error("calibrateStretch returned no scale")
  const text = "some prose to letterspace"
  const tracked = compileText(text, metrics, { track: 0.03 })
  const both = compileText(text, metrics, { track: 0.03, expand: scale })
  if (!tracked.ok || !tracked.tracking) throw new Error("expected tracking")
  if (!both.ok || !both.flex) throw new Error("expected pooled flex")

  const boxes = itemsOf(tracked).filter((item) => item.kind === "box")
  const budget = boxes.reduce((total, box) => total + box.width * 0.03, 0)
  const total = tracked.tracking.stretch.at(-1) as number

  expect(total).toBeCloseTo(budget, 9)
  expect(tracked.tracking.shrink.at(-1)).toBeCloseTo(budget, 9)
  expect(both.flex.stretch.length).toBe(both.items.length + 1)
})

test("a partial policy overrides one field and keeps the rest", () => {
  const items = itemsOf(
    compileText("antidisestablishmentarianism", metrics, {
      hyphenate: englishHyphenator,
      policy: { hyphenPenalty: 77 },
    }),
  )
  const breaks = items.filter((item) => item.kind === "discretionary")

  expect(breaks.length).toBeGreaterThan(4)
  expect(breaks.every((item) => item.penalty === 77)).toBe(true)
  expect(texDefaults.hyphenPenalty).toBe(50)
})

test("a partial glue elasticity overrides one field and keeps the rest", () => {
  const items = itemsOf(
    compileText("one two", metrics, {
      glue: { stretch: 3 },
    }),
  )
  const spaces = items.filter((item) => item.kind === "glue" && item.width > 0)

  expect(spaces).toHaveLength(1)
  expect((spaces[0] as { stretch: number }).stretch).toBe(
    (spaces[0] as { width: number }).width * 3,
  )
  expect((spaces[0] as { shrink: number }).shrink).toBeCloseTo(
    (spaces[0] as { width: number }).width / 3,
    12,
  )
})

test("an authored soft hyphen still prints its hyphen at a line end", () => {
  const items = itemsOf(compileText("co­operate", metrics))
  const soft = items.filter((item) => item.kind === "discretionary")

  expect(soft).toHaveLength(1)
  expect(soft[0]).toMatchObject({
    preWidth: measure("-"),
    hyphen: true,
    breakOffset: 3,
  })
})

type MirrorSource = { readonly start: number; readonly end: number }

type MirrorItem =
  | {
      readonly kind: "box"
      readonly width: number
      readonly source?: MirrorSource
    }
  | {
      readonly kind: "glue"
      readonly width: number
      readonly stretch: number
      readonly shrink: number
      readonly source?: MirrorSource
    }
  | {
      readonly kind: "penalty"
      readonly width: number
      readonly penalty: number
      readonly flagged: boolean
      readonly source?: MirrorSource
    }
  | {
      readonly kind: "discretionary"
      readonly preWidth: number
      readonly postWidth: number
      readonly noBreakWidth: number
      readonly penalty: number
      readonly hyphen: boolean
      readonly breakOffset: number
      readonly source?: MirrorSource
    }

type MirrorPair = {
  readonly stretch: Float64Array
  readonly shrink: Float64Array
}

type MirrorResult =
  | {
      ok: true
      items: MirrorItem[]
      hangs: { readonly start: Float64Array; readonly end: Float64Array } | null
      expansion: MirrorPair | null
      tracking: MirrorPair | null
      flex: MirrorPair | null
      scale: {
        readonly steps: readonly {
          readonly pct: number
          readonly ratio: number
        }[]
      } | null
    }
  | { ok: false; reason: ComposeReason }

type Assignable<A, B> = [A] extends [B] ? true : false

type SameKeys<A extends string, B extends string> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false

const carriesOnlyPlainData: Assignable<CompileResult, MirrorResult> = true
const missesNothing: Assignable<MirrorResult, CompileResult> = true
const reasonIsAString: Assignable<ComposeReason, string> = true
const sameFields: SameKeys<
  keyof Extract<CompileResult, { ok: true }>,
  "ok" | "items" | "hangs" | "expansion" | "tracking" | "flex" | "scale"
> = true

test("CompileResult is structurally free of the DOM", () => {
  expect([
    carriesOnlyPlainData,
    missesNothing,
    reasonIsAString,
    sameFields,
  ]).toEqual([true, true, true, true])
})
