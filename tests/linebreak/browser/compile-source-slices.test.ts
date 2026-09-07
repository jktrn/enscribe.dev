import { afterEach, expect, test } from "vitest"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text/segments"
import { extract } from "./support/extraction"

const metrics = createMetrics({
  font: "16px serif",
  measure: (text) => text.length * 10,
})
afterEach(() => document.body.replaceChildren())

const solve = (html: string, width: number) => {
  const block = extract(html)
  const compiled = compileBlock({
    block,
    baseFont: metrics.font,
    locale: "en",
    metricsFor: () => metrics,
  })
  if (!compiled.ok) throw new Error(compiled.reason)
  const result = breakParagraph(compiled.items, width)
  if (!result.ok) throw new Error("unbreakable")
  return { text: block.text, lines: result.lines }
}

test.each([
  { html: "<span data-nowrap>\u00adalpha</span>", widths: [50] },
  { html: "<span data-nowrap>alpha\u00ad</span>", widths: [50] },
  { html: "<span data-nowrap>alpha<wbr>\u00adalpha</span>", widths: [50, 50] },
  {
    html: "<span data-nowrap>alpha<wbr>\u00ad<wbr>alpha</span>",
    widths: [50, 50],
  },
  { html: "<span data-nowrap>alpha\u00ad<wbr>alpha</span>", widths: [50, 50] },
  { html: "<span data-nowrap>\u00ad<br>alpha</span>", widths: [0, 50] },
  { html: "<span data-nowrap>alpha<br>\u00adalpha</span>", widths: [50, 50] },
  {
    html: "<span data-nowrap>alpha<wbr>\u00ad<br>alpha</span>",
    widths: [50, 50],
  },
])("suppressed SHY remains in source slices without acquiring width: $html", ({
  html,
  widths,
}) => {
  const { text, lines } = solve(html, 60)
  expect(lines.map((line) => line.naturalWidth)).toEqual(widths)
  expect(lines.some((line) => line.breakKind === "hyphen")).toBe(false)
  expect(
    lines
      .map(
        (line) =>
          text.slice(line.sourceStart, line.sourceEnd) +
          (line.breakKind === "forced" ? "\n" : ""),
      )
      .join(""),
  ).toBe(text)
})

test("a trailing suppressed SHY cannot make WBR trade final-hyphen cost for an empty row", () => {
  const { lines } = solve(
    "alph\u00adbetaa<wbr><span data-nowrap>\u00ad</span>",
    50,
  )
  expect(lines.map((line) => line.naturalWidth)).toEqual([50, 50])
})

test.each(["\u00ad", "\u200b"])(
  "an invisible nowrap run between WBRs cannot insert a row to reset hyphen history: %s",
  (control) => {
    const { lines } = solve(`alph\u00ad<wbr><span data-nowrap>${control}</span><wbr>betaa`, 50)
    expect(lines.map((line) => line.naturalWidth)).toEqual([50, 50])
  },
)
