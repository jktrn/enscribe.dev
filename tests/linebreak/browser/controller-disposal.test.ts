import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createLinebreaker } from "@linebreak/linebreaker"
import { browserFixture, paragraph } from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

// Inspect strong data-property ownership without depending on cache field names.
// WeakMap entries and function closures are deliberately outside this check.
const retains = (owner: object, target: object, seen = new Set<object>()): boolean => {
  if (owner === target) return true
  if (seen.has(owner)) return false
  seen.add(owner)
  const children = owner instanceof Map
    ? [...owner.keys(), ...owner.values()]
    : owner instanceof Set
      ? [...owner]
      : Object.values(Object.getOwnPropertyDescriptors(owner)).map((entry) => entry.value)
  return children.some((child) => child !== null && typeof child === "object" && retains(child, target, seen))
}

test("disposing a retained controller releases strong ownership of declined paragraphs", () => {
  const p = paragraph()
  p.style.direction = "rtl"
  const engine = createLinebreaker()
  expect(engine.typeset([p])[0]).toMatchObject({ status: "declined", reason: "unsupported-direction" })
  p.remove()
  engine.dispose()
  expect(retains(engine, p)).toBe(false)
})

test("a disposed controller cannot disown markup produced by a subsequent controller", () => {
  const p = paragraph()
  const retired = createLinebreaker()
  expect(retired.typeset([p])[0]?.status).toBe("typeset")
  retired.dispose()
  const current = createLinebreaker()
  expect(current.typeset([p])[0]?.status).toBe("typeset")
  const ownedMarkup = p.outerHTML
  const ownedLines = [...p.childNodes]
  retired.restore([p])
  expect(p.outerHTML).toBe(ownedMarkup)
  expect([...p.childNodes]).toEqual(ownedLines)
  expect(p.firstChild).toBe(ownedLines[0])
  current.dispose()
})
