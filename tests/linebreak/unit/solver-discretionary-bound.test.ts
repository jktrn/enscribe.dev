import { expect, test } from "bun:test"
import { box, glue, discretionary, paragraphEnd, breakParagraph, breakParagraphOnce, prepareParagraph } from "@linebreak/layout"

// A plain first line costs 10000. Breaking inside the word costs penalty².
// At equality, the earlier discretionary wins the original solver's tie.
for (const scoring of ["continuous", "integer"] as const) {
  for (const [penalty, firstBreak] of [[101, 5], [100, 3], [-100, 3]] as const) {
    test(`${scoring} preserves the discretionary cost bound at penalty ${penalty}`, () => {
      const items = [box(5), glue(10, 10, 10), box(30),
        discretionary({ breakOffset: 0, preWidth: 5, penalty, hyphen: false }), box(15),
        glue(10, 10, 10), box(25), ...paragraphEnd()]
      const options = { tolerance: 100, policy: { scoring, pretolerance: 100, tolerance: 100,
        linePenalty: 0, adjDemerits: 0, doubleHyphenDemerits: 0, finalHyphenDemerits: 0 } }
      const result = breakParagraphOnce(items, 50, options)
      expect(result.ok && result.lines.map(line => line.end)).toEqual([firstBreak, items.length - 1])
      const prepared = prepareParagraph(items)
      expect(prepared.breakParagraphOnce(50, options)).toEqual(result)
      const layout = breakParagraph(items, 50, options)
      expect(layout.ok && layout.lines.map(line => line.end)).toEqual([firstBreak, items.length - 1])
      expect(prepared.breakParagraph(50, options)).toEqual(layout)
    })
  }
}
