import { expect, test } from "bun:test"
import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import { breakParagraph } from "@linebreak/layout/breaker"
import { passThroughWidth } from "@linebreak/layout/items"
import { compileBlock } from "@linebreak/layout/compile"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"
import type { FontMetrics, MeasuredSegment } from "@linebreak/text/measure"

const CHARACTER = 10
const HYPHEN = 5
const SHY = "­"

const segmentsOf = (text: string): MeasuredSegment[] => {
  const segments: MeasuredSegment[] = []
  let pending = ""

  const flush = (at: number) => {
    if (pending.length === 0) return
    segments.push({
      text: pending,
      start: at - pending.length,
      end: at,
      kind: "text",
      width: pending.length * CHARACTER,
      lineEndWidth: 0,
    })
    pending = ""
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] as string
    if (character !== " " && character !== SHY) {
      pending += character
      continue
    }
    flush(index)
    segments.push({
      text: character,
      start: index,
      end: index + 1,
      kind: character === " " ? "space" : "soft-hyphen",
      width: character === " " ? CHARACTER : 0,
      lineEndWidth: character === " " ? 0 : HYPHEN,
    })
  }
  flush(text.length)
  return segments
}

const metrics: FontMetrics = {
  font: "16px serif",
  letterSpacing: 0,
  hyphenWidth: HYPHEN,
  measureRun: (text) => text.length * CHARACTER,
  measureParagraph: (text) => ({
    segments: segmentsOf(text),
    hyphenWidth: HYPHEN,
  }),
}

const element = () => ({}) as HTMLElement

const blockOf = (texts: readonly string[], trailingEdge: number) => {
  const wrapper = element()
  const runs: InlineRun[] = []
  let offset = 0
  for (const [index, text] of texts.entries()) {
    runs.push({
      kind: "text",
      text,
      start: offset,
      end: offset + text.length,
      wrappers: index === 0 ? [wrapper] : [],
      sourceElement: element(),
      hyphenates: false,
    })
    offset += text.length
  }

  const first = runs[0] as InlineRun
  const block: ExtractedBlock = {
    text: texts.join(""),
    runs,
    breakRestrictions: [],
    wrappers: new Map([
      [
        wrapper,
        {
          start: first.start,
          end: first.end,
          firstRun: 0,
          lastRun: 0,
          leading: { nodes: [], width: 0 },
          trailing: { nodes: [], width: trailingEdge },
        },
      ],
    ]),
  }
  return block
}

const compile = (texts: readonly string[], trailingEdge = 0) => {
  const compiled = compileBlock({
    block: blockOf(texts, trailingEdge),
    metricsFor: () => metrics,
    atomWidth: () => 0,
    locale: "en-US",
    policy: texDefaults,
    glue: defaultGlue,
  })
  if (!compiled.ok) throw new Error(`compileBlock declined: ${compiled.reason}`)
  return compiled.items
}

const naturalWidth = (texts: readonly string[], trailingEdge = 0) =>
  compile(texts, trailingEdge).reduce(
    (total, item) => total + passThroughWidth(item),
    0,
  )

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
