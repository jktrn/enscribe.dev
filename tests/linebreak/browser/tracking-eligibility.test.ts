import { afterEach, expect, test, vi } from "vitest"
import { extractBlock } from "@linebreak/dom/extract"
import { hasSplitGrapheme } from "@linebreak/dom/tracking"

const extracted = (html: string) => {
  const paragraph = document.createElement("p")
  paragraph.innerHTML = html
  document.body.append(paragraph)
  const result = extractBlock(paragraph, (element) => {
    const style = getComputedStyle(element)
    return new Proxy(style, {
      get(target, property) {
        if (property === "whiteSpaceCollapse") return "collapse"
        if (property === "textWrapMode") return "wrap"
        if (property === "display") return style.display || "inline"
        return Reflect.get(target, property)
      },
    })
  })
  if (!result.ok) throw new Error(result.reason)
  return result.block
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

test("one shaping run does not need an extra paragraph segmentation pass", () => {
  const block = extracted("ordinary text with no inline boundary")
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment")
  expect(hasSplitGrapheme(block)).toBe(false)
  expect(segment).not.toHaveBeenCalled()
})

test("whitespace anchors do not conceal an adjacent text grapheme boundary", () => {
  const block = extracted("alpha<i> </i><em>\u0301beta</em>")
  expect(block.runs.some((run) => run.kind === "anchor")).toBe(true)
  expect(hasSplitGrapheme(block)).toBe(true)
})

test.each([
  "alpha<img><em>\u0301beta</em>",
  "alpha\u0600<img>beta",
  "alpha<wbr><em>\u0301beta</em>",
])("non-text inline boundaries do not represent a split shaping run: %s", (html) => {
  expect(hasSplitGrapheme(extracted(html))).toBe(false)
})

test("a whitespace anchor cannot hide a preceding grapheme prepend character", () => {
  const block = extracted("alpha\u0600<i> </i>beta")
  expect(block.runs.some((run) => run.kind === "anchor")).toBe(true)
  expect(hasSplitGrapheme(block)).toBe(true)
})
