import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { BrowserCache, contentKey } from "@linebreak/browser/cache"
import { BrowserMeasurements } from "@linebreak/browser/measurement"
import { computedFont, variantKey } from "@linebreak/dom/style"
import { defaultGlue, texDefaults } from "@linebreak/layout/policy"
import { browserFixture, paragraph } from "./support/controller"

beforeEach(browserFixture)
afterEach(() => vi.restoreAllMocks())

const measured = () => {
  const p = paragraph()
  const style = getComputedStyle(p)
  const basis = {
    font: computedFont(style),
    variant: variantKey(style),
    letterSpacing: 0,
    locale: "en-US",
  }
  const measurer = new BrowserMeasurements({
    maximumCharacters: 3000,
    expand: false,
    track: false,
    policy: texDefaults,
    glue: defaultGlue,
  })
  const built = measurer.build(p, style, basis, false)
  if (!built.ok) throw new Error(`Fixture declined: ${built.reason}`)
  const cache = new BrowserCache(new Set(), [])
  cache.set(p, built.measurement)
  return { p, basis, cache, measurement: built.measurement }
}

test("a changed measurement basis evicts the obsolete entry permanently", () => {
  const { p, basis, cache } = measured()
  expect(cache.get(p, { ...basis, font: "18px serif" })).toBeUndefined()
  expect(cache.get(p, basis)).toBeUndefined()
})

test("authored edits disown the old generation even when its markup is later recreated", () => {
  const { p, basis, cache } = measured()
  const generated = `<span data-linebreak-line="end">${p.textContent}</span>`
  p.innerHTML = generated
  p.setAttribute("data-linebreak-typeset", "2")
  cache.written(p)
  p.textContent = "Reauthored content"
  cache.restore(p)
  expect(p.textContent).toBe("Reauthored content")
  expect(p.hasAttribute("data-linebreak-typeset")).toBe(false)
  p.innerHTML = generated
  expect(cache.get(p, basis)).toBeUndefined()
})

test("unchanged content shares its prepared input until explicitly invalidated", () => {
  const { p, basis, cache, measurement } = measured()
  expect(cache.get(p, basis)).toBe(measurement)
  cache.delete(p)
  expect(cache.get(p, basis)).toBeUndefined()
  cache.set(p, measurement)
  cache.clear()
  expect(cache.get(p, basis)).toBeUndefined()
})

test("ordinary content fingerprints do not clone an entire DOM subtree", () => {
  const p = paragraph()
  const clone = vi.spyOn(p, "cloneNode")
  expect(contentKey(p, [])).toBe(p.innerHTML)
  expect(clone).not.toHaveBeenCalled()
})
