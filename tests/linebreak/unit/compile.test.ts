import { expect, test } from "bun:test"
import { breakParagraph } from "@linebreak/layout/breaker"
import { passThroughWidth } from "@linebreak/layout/items"
import { texDefaults } from "@linebreak/layout/policy"
import { CHARACTER, compile, HYPHEN, SHY } from "./support/measure"

const naturalWidth = (texts: readonly string[], trailingEdge = 0) =>
  compile(texts, trailingEdge).reduce(
    (total, item) => total + passThroughWidth(item),
    0,
  )

test("an authored soft hyphen compiles to a printing discretionary", () => {
  const items = compile([`beta${SHY}gamma`], 0, {
    ...texDefaults,
    hyphenPenalty: 77,
    exHyphenPenalty: 88,
  })
  const taken = items.filter((item) => item.kind === "discretionary")

  expect(taken).toHaveLength(1)
  expect(taken[0]).toEqual({
    kind: "discretionary",
    preWidth: HYPHEN,
    postWidth: 0,
    noBreakWidth: 0,
    penalty: 77,
    hyphen: true,
    source: { start: 4, end: 5 },
    breakOffset: 5,
  })
})

test("a break at an authored soft hyphen keeps the character on the line", () => {
  const text = `anti${SHY}disestablishmentarian is a long word`
  const items = compile([text])
  const solved = breakParagraph(items, 12 * CHARACTER, { policy: texDefaults })

  expect(solved.ok).toBe(true)
  if (!solved.ok) return

  const hyphenated = solved.lines.filter((line) => line.breakKind === "hyphen")
  expect(hyphenated.length).toBe(1)
  expect(text.slice(0, hyphenated[0]?.sourceEnd)).toEndWith(SHY)
})

test("the lines of a soft-hyphenated paragraph still cover every character", () => {
  const text = `anti${SHY}disestablishmentarian is a long word`
  const solved = breakParagraph(compile([text]), 12 * CHARACTER, {
    policy: texDefaults,
  })

  expect(solved.ok).toBe(true)
  if (!solved.ok) return

  let rendered = ""
  for (const [index, line] of solved.lines.entries()) {
    if (solved.lines[index - 1]?.breakKind === "space") rendered += " "
    rendered += text.slice(line.sourceStart, line.sourceEnd)
  }
  expect(rendered).toBe(text)
})

test("a run's trailing edge is charged whatever its last segment is", () => {
  const bare = naturalWidth(["beta", "gamma"])

  expect(naturalWidth(["beta", "gamma"], 12)).toBe(bare + 12)
  expect(naturalWidth([`beta${SHY}`, "gamma"], 12)).toBe(bare + 12)
  expect(naturalWidth(["beta ", "gamma"], 12)).toBe(bare + CHARACTER + 12)
})

test("a trailing edge at a soft hyphen is charged to the line that breaks", () => {
  const text = `beta${SHY}gamma delta epsilon`
  const items = compile([`beta${SHY}`, "gamma delta epsilon"], 12)
  const solved = breakParagraph(items, 6 * CHARACTER, { policy: texDefaults })

  expect(solved.ok).toBe(true)
  if (!solved.ok) return

  const first = solved.lines[0]
  expect(text.slice(0, first?.sourceEnd)).toBe(`beta${SHY}`)
  expect(first?.naturalWidth).toBe(4 * CHARACTER + 12 + HYPHEN)
})
