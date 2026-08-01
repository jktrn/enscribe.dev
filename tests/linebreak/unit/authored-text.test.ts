import { expect, test } from "bun:test"
import { authoredText } from "@linebreak/dom/restore"

const el = (textContent: string | null) => ({ textContent })

test("source indentation and newlines do not count as a content change", () => {
  expect(authoredText(el("\n      Hello there,\n      reader.\n    "))).toBe(
    authoredText(el("Hello there, reader.")),
  )
})

test("a real edit changes the text", () => {
  expect(authoredText(el("Hello there"))).not.toBe(
    authoredText(el("Hello, there")),
  )
  expect(authoredText(el("one two"))).not.toBe(authoredText(el("one three")))
})

test("an empty or missing text node normalises to the empty string", () => {
  expect(authoredText(el(null))).toBe("")
  expect(authoredText(el("   \n\t "))).toBe("")
})

test("collapsing is idempotent, so a stored value never drifts", () => {
  const once = authoredText(el("  a \n b  "))
  expect(authoredText(el(once))).toBe(once)
})
