import { afterEach, expect, test } from "vitest"
import { extractBlock } from "@linebreak/dom/extract"
import { breakAllowedAt } from "@linebreak/text/source"
import { extract, fixture, read } from "./support/extraction"

afterEach(() => document.body.replaceChildren())

test("the root paragraph's nowrap policy governs direct text children", () => {
  const p = fixture("alpha beta")
  p.setAttribute("data-nowrap", "")
  const result = extractBlock(p, read)
  if (!result.ok) throw new Error(result.reason)
  expect(breakAllowedAt(result.block.breakRestrictions, 5)).toBe(false)
})

test("preserved root whitespace is declined before normalization can lose authored spaces", () => {
  const p = fixture("alpha  beta")
  p.setAttribute("data-preserve", "")
  expect(extractBlock(p, read)).toEqual({
    ok: false,
    reason: "unsupported-content",
  })
})

test("display contents contributes descendants without an authored box", () => {
  const p = fixture(
    'alpha<span data-display="contents" id="contents"></span>beta',
  )
  p.querySelector("span")!.getBoundingClientRect = () =>
    new DOMRect(0, 0, 20, 10)
  const result = extractBlock(p, read)
  if (!result.ok) throw new Error(result.reason)
  expect(result.block.text).toBe("alphabeta")
  expect(result.block.runs.every((run) => run.kind === "text")).toBe(true)
})

test.each([
  "<span data-nowrap><img></span>beta",
  "<span data-nowrap><span data-wrap><img></span></span>beta",
])("the wrapping common ancestor permits breaks outside a nowrap atom: %s", (html) => {
  const block = extract(`alpha${html}`)
  expect(breakAllowedAt(block.breakRestrictions, 5)).toBe(true)
})

test("the wrapping common ancestor permits breaks outside an empty nowrap inline box", () => {
  const p = fixture('alpha<span data-nowrap id="atom"></span>beta')
  p.querySelector("span")!.getBoundingClientRect = () =>
    new DOMRect(0, 0, 20, 10)
  const result = extractBlock(p, read)
  if (!result.ok) throw new Error(result.reason)
  expect(result.block.runs.find((run) => run.kind === "atom")).toBeDefined()
  expect(breakAllowedAt(result.block.breakRestrictions, 5)).toBe(true)
})

test("a disappearing break later in a text run cannot permit the atom's opening boundary", () => {
  const block = extract(
    "<span data-nowrap><img><span data-wrap>beta gamma</span></span>",
  )
  expect(breakAllowedAt(block.breakRestrictions, 1)).toBe(false)
  expect(breakAllowedAt(block.breakRestrictions, 5)).toBe(true)
})

test("children appended to a WBR do not become rendered paragraph content", () => {
  const p = fixture("alpha<wbr>beta")
  p.querySelector("wbr")!.append(document.createTextNode("invisible child"))
  const result = extractBlock(p, read)
  if (!result.ok) throw new Error(result.reason)
  expect(result.block.text).toBe("alphabeta")
  expect(result.block.runs.filter((run) => run.kind === "break")).toHaveLength(
    1,
  )
})

test.each([
  "<span data-nowrap><img> beta</span>",
  "<span data-nowrap><span data-wrap><img></span> beta</span>",
])("an initial nowrap atom forbids a following space owned by that nowrap wrapper: %s", (html) => {
  const block = extract(html)
  expect(block.text).toBe("\ufffc beta")
  expect(breakAllowedAt(block.breakRestrictions, 1)).toBe(false)
})

test("an empty wrapping inline still inherits the outer atom's nowrap boundary policy", () => {
  const p = fixture(
    '<span data-nowrap><i data-wrap id="empty"></i> beta</span>',
  )
  p.querySelector("i")!.getBoundingClientRect = () => new DOMRect(0, 0, 20, 10)
  const result = extractBlock(p, read)
  if (!result.ok) throw new Error(result.reason)
  expect(result.block.text).toBe("\ufffc beta")
  expect(breakAllowedAt(result.block.breakRestrictions, 1)).toBe(false)
})

test("a later whitespace contributor cannot pull its content wrapper before the retained space", () => {
  const block = extract(
    'alpha <em id="following" style="padding-inline-start:3px"> <i>beta</i></em>',
  )
  expect(block.text).toBe("alpha beta")
  expect(block.runs.filter((run) => run.kind === "anchor")).toEqual([])
  const beta = block.runs.find(
    (run) => run.kind === "text" && run.text.includes("beta"),
  )!
  expect(beta.wrappers.map((wrapper) => wrapper.id)).toContain("following")
})

test.each([
  "\u00ad",
  "\u200b",
])("an initial invisible opportunity belongs to its nowrap text: %s", (opportunity) => {
  const block = extract(`<span data-nowrap>alpha<wbr>${opportunity}beta</span>`)
  expect(breakAllowedAt(block.breakRestrictions, 5)).toBe(false)
  expect(
    block.runs.some(
      (run) => run.kind === "break" && !run.forced && run.start === 5,
    ),
  ).toBe(true)
})
