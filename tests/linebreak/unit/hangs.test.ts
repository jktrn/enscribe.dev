import { describe, expect, test } from "bun:test"
import {
  box,
  discretionary,
  glue,
  type Item,
  paragraphEnd,
  penalty,
} from "@linebreak/layout/items"
import { buildHangs } from "@linebreak/layout/protrusion"
import { INFINITE_PENALTY } from "@linebreak/layout/policy"

const SPACE = 10
const HYPHEN = 4

const spacer = () => glue(SPACE, SPACE / 2, SPACE / 3, { start: 0, end: 1 })

describe("the credit at a break", () => {
  test("a hyphen-drawing discretionary credits the hyphen, not the word", () => {
    const items: Item[] = [
      box(50),
      discretionary({
        preWidth: HYPHEN,
        penalty: 50,
        hyphen: true,
        breakOffset: 3,
      }),
      box(50),
    ]
    const hangs = buildHangs(
      items,
      new Map(),
      new Map([
        [0, 7],
        [1, 2],
      ]),
    )

    expect(hangs.end[1]).toBe(2)
  })

  test("a break at glue credits the box before it", () => {
    const items: Item[] = [box(50), spacer(), box(50)]
    const hangs = buildHangs(items, new Map(), new Map([[0, 3.5]]))

    expect(hangs.end[1]).toBe(3.5)
  })

  test("a break at a zero-width penalty carries the last box's credit", () => {
    const items: Item[] = [box(50), penalty(0), box(50), penalty(0), box(50)]
    const hangs = buildHangs(
      items,
      new Map(),
      new Map([
        [0, 1],
        [2, 2],
        [4, 3],
      ]),
    )

    expect(hangs.end[1]).toBe(1)
    expect(hangs.end[3]).toBe(2)
  })

  test("a box's own credit is not charged to a break at that box", () => {
    const items: Item[] = [box(50), box(50), spacer()]
    const hangs = buildHangs(
      items,
      new Map(),
      new Map([
        [0, 9],
        [1, 5],
      ]),
    )

    expect(hangs.end[1]).toBe(9)
    expect(hangs.end[2]).toBe(5)
  })

  test("the forced-break triple credits the box before the paragraph tail", () => {
    const items: Item[] = [box(50), ...paragraphEnd(3)]
    const hangs = buildHangs(items, new Map(), new Map([[0, 6]]))

    expect(items[1]?.kind).toBe("penalty")
    expect(hangs.end[1]).toBe(6)
    expect(hangs.end[2]).toBe(6)
    expect(hangs.end[3]).toBe(6)
  })

  test("a penalty that draws nothing takes the carried credit, not its own", () => {
    const items: Item[] = [box(50), penalty(INFINITE_PENALTY), box(50)]
    const hangs = buildHangs(
      items,
      new Map(),
      new Map([
        [0, 4],
        [1, 99],
      ]),
    )

    expect(hangs.end[1]).toBe(4)
  })
})

describe("the credit at a line start", () => {
  test("a break before a box credits that box", () => {
    const items: Item[] = [box(50), spacer(), box(50)]
    const hangs = buildHangs(
      items,
      new Map([
        [0, 1.5],
        [2, 2.5],
      ]),
      new Map(),
    )

    expect(hangs.start[0]).toBe(1.5)
    expect(hangs.start[2]).toBe(2.5)
    expect(hangs.start[3]).toBe(0)
  })

  test("glue and penalties between the break and the box are skipped", () => {
    const items: Item[] = [box(50), penalty(0), spacer(), penalty(0), box(50)]
    const hangs = buildHangs(items, new Map([[4, 7]]), new Map())

    expect(hangs.start[1]).toBe(7)
    expect(hangs.start[2]).toBe(7)
    expect(hangs.start[3]).toBe(7)
    expect(hangs.start[4]).toBe(7)
  })

  test("a discretionary does not stand in for the box after it", () => {
    const items: Item[] = [
      box(50),
      discretionary({
        preWidth: HYPHEN,
        penalty: 50,
        hyphen: true,
        breakOffset: 3,
      }),
      box(50),
    ]
    const hangs = buildHangs(items, new Map([[2, 3]]), new Map())

    expect(hangs.start[2]).toBe(3)
  })

  test("a line start past the last box gets nothing", () => {
    const items: Item[] = [box(50), ...paragraphEnd(3)]
    const hangs = buildHangs(items, new Map([[0, 8]]), new Map())

    expect(hangs.start[0]).toBe(8)
    expect(hangs.start[1]).toBe(0)
    expect(hangs.start[items.length]).toBe(0)
  })
})

describe("degenerate input", () => {
  test("an empty item stream builds empty arrays", () => {
    const hangs = buildHangs([], new Map(), new Map())

    expect(hangs.end.length).toBe(0)
    expect(hangs.start.length).toBe(1)
    expect(hangs.start[0]).toBe(0)
  })

  test("a stream with no protruding characters is all zeros", () => {
    const items: Item[] = [box(50), spacer(), box(50), ...paragraphEnd(9)]
    const hangs = buildHangs(items, new Map(), new Map())

    expect([...hangs.start]).toEqual(Array.from({ length: 7 }, () => 0))
    expect([...hangs.end]).toEqual(Array.from({ length: 6 }, () => 0))
  })
})
