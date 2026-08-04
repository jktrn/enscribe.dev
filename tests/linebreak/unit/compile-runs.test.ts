import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import type { Item, ItemSource } from "@linebreak/layout/items"
import {
  type CompileResult,
  compileRuns,
  compileText,
  createMetrics,
} from "@linebreak/text"
import { englishHyphenator } from "@linebreak/text/hyphenate"

const measure = (text: string) => {
  let width = 0
  for (const character of text) {
    width += 4 + ((character.codePointAt(0) as number) % 11)
  }
  return width
}

const metrics = createMetrics({ measure, font: "16px serif" })
const aside = createMetrics({
  measure: (text) => 3 * measure(text),
  font: "12px serif",
})

const prose = readFileSync(new URL("./support/prose.txt", import.meta.url))
  .toString()
  .split("\n")
  .filter((line) => line.length > 0)

const itemsOf = (result: CompileResult) => {
  if (!result.ok) throw new Error(`compileRuns declined: ${result.reason}`)
  return result.items
}

const sourceOf = (item: Item) => item.source as ItemSource

const keyOf = (item: Item) => {
  const at = `${sourceOf(item).start}-${sourceOf(item).end}`
  if (item.kind === "box") return `box ${item.width} ${at}`
  if (item.kind === "glue") {
    return `glue ${item.width} ${item.stretch} ${item.shrink} ${at}`
  }
  if (item.kind === "penalty") {
    return `pen ${item.width} ${item.penalty} ${item.flagged} ${at}`
  }
  return `disc ${item.preWidth} ${item.penalty} ${item.hyphen} ${item.breakOffset}`
}

const streamOf = (result: CompileResult) =>
  itemsOf(result).map(keyOf).join("\n")

const widthOf = (items: readonly Item[]) => {
  let total = 0
  for (const item of items) {
    if (item.kind === "box" || item.kind === "glue") total += item.width
  }
  return total
}

const boxAt = (items: readonly Item[], start: number) =>
  items.find((item) => item.kind === "box" && sourceOf(item).start === start) as
    | Extract<Item, { kind: "box" }>
    | undefined

const breaksAt = (items: readonly Item[], offset: number) =>
  items.filter(
    (item) =>
      (item.kind === "glue" || item.kind === "penalty") &&
      sourceOf(item).start === offset,
  )

test("a one-run list is the string, item for item, over the whole fixture", () => {
  let compared = 0

  for (const paragraph of prose) {
    const options = { hyphenate: englishHyphenator, protrude: true }
    const one = compileText(paragraph, metrics, options)
    const many = compileRuns([{ text: paragraph }], metrics, options)

    expect(streamOf(many)).toBe(streamOf(one))
    if (!one.ok || !many.ok) throw new Error("expected both to compile")
    expect([...(many.hangs?.start ?? [])]).toEqual([
      ...(one.hangs?.start ?? []),
    ])
    expect([...(many.hangs?.end ?? [])]).toEqual([...(one.hangs?.end ?? [])])
    compared += 1
  }

  expect(compared).toBe(127)
})

test("nothing to set is declined as empty, runs or no runs", () => {
  expect(compileRuns([], metrics)).toEqual({ ok: false, reason: "empty" })
  expect(compileRuns([{ text: "" }], metrics)).toEqual({
    ok: false,
    reason: "empty",
  })
})

test("a run boundary inside a word offers no break and moves no width", () => {
  const split = compileRuns([{ text: "hyper" }, { text: "text" }], metrics)
  const whole = compileText("hypertext", metrics)

  expect(breaksAt(itemsOf(split), 5)).toEqual([])
  expect(widthOf(itemsOf(split))).toBeCloseTo(widthOf(itemsOf(whole)), 9)
})

test("a run carries its own metrics, and the rest keep the base", () => {
  const items = itemsOf(
    compileRuns([{ text: "one " }, { text: "two", metrics: aside }], metrics),
  )

  expect(boxAt(items, 0)?.width).toBeCloseTo(measure("one"), 9)
  expect(boxAt(items, 4)?.width).toBeCloseTo(3 * measure("two"), 9)
})

test("inline extras fold into the boxes at each end of their own run", () => {
  const items = itemsOf(
    compileRuns(
      [
        { text: "ab " },
        { text: "cd", leading: 7, trailing: 5 },
        { text: " ef" },
      ],
      metrics,
    ),
  )

  expect(boxAt(items, 0)?.width).toBeCloseTo(measure("ab"), 9)
  expect(boxAt(items, 3)?.width).toBeCloseTo(measure("cd") + 12, 9)
  expect(boxAt(items, 6)?.width).toBeCloseTo(measure("ef"), 9)
})

test("a zero-length run reaches backwards or waits, as it is told", () => {
  const back = itemsOf(
    compileRuns(
      [
        { text: "ab" },
        { attach: "previous", leading: 3, trailing: 6 },
        { text: " cd" },
      ],
      metrics,
    ),
  )
  const forward = itemsOf(
    compileRuns(
      [
        { text: "ab " },
        { attach: "next", leading: 4, trailing: 5 },
        { text: "cd" },
      ],
      metrics,
    ),
  )

  expect(boxAt(back, 0)?.width).toBeCloseTo(measure("ab") + 9, 9)
  expect(boxAt(forward, 0)?.width).toBeCloseTo(measure("ab"), 9)
  expect(boxAt(forward, 3)?.width).toBeCloseTo(measure("cd") + 9, 9)
})

test("code is a property of the run, not of the call", () => {
  const asked: string[] = []
  const items = itemsOf(
    compileRuns(
      [
        { text: "call " },
        { text: "renderLines.forEach", code: true },
        { text: " twice" },
      ],
      metrics,
      {
        hyphenate: (word, locale) => {
          asked.push(word)
          return englishHyphenator(word, locale)
        },
      },
    ),
  )
  const inCode = items.filter(
    (item): item is Extract<Item, { kind: "discretionary" }> =>
      item.kind === "discretionary" && item.breakOffset > 5,
  )

  expect(asked).toEqual(["call", "twice"])
  expect(inCode.map((item) => item.penalty)).toEqual([
    9500, 8500, 9500, 3000, 8500, 9500,
  ])
})

test("a run may decline hyphenation while its neighbours accept it", () => {
  const items = itemsOf(
    compileRuns(
      [
        { text: "antidisestablishmentarianism " },
        { text: "antidisestablishmentarianism", hyphenates: false },
      ],
      metrics,
      { hyphenate: englishHyphenator },
    ),
  )
  const breaks = items.filter((item) => item.kind === "discretionary")

  expect(breaks.length).toBeGreaterThan(4)
  expect(breaks.every((item) => item.breakOffset < 28)).toBe(true)
})

test("a nowrap range spanning two runs closes the break between them", () => {
  const runs = [{ text: "keep" }, { text: " this" }]
  const open = itemsOf(compileRuns(runs, metrics))
  const shut = itemsOf(
    compileRuns(runs, metrics, { nowrap: [{ start: 0, end: 9 }] }),
  )

  expect(
    open.filter((item) => item.kind === "glue" && item.width > 0),
  ).toHaveLength(1)
  expect(shut.filter((item) => item.kind === "glue" && item.width > 0)).toEqual(
    [],
  )
  expect(boxAt(shut, 4)?.width).toBeCloseTo(measure(" "), 9)
  expect(widthOf(shut)).toBeCloseTo(widthOf(open), 9)
})

test("nowrap ranges need not arrive sorted or disjoint", () => {
  const runs = [{ text: "a b" }, { text: " c d" }]
  const tidy = compileRuns(runs, metrics, { nowrap: [{ start: 0, end: 7 }] })
  const messy = compileRuns(runs, metrics, {
    nowrap: [
      { start: 2, end: 4 },
      { start: 0, end: 7 },
    ],
  })

  expect(itemsOf(tidy).filter((item) => item.kind === "glue")).toHaveLength(1)
  expect(streamOf(messy)).toBe(streamOf(tidy))
})
