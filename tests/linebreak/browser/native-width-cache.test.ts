import { beforeEach, expect, test, vi } from "vitest"
import { cachedNativeAdvance, cachedNativeCalibration, invalidateNativeWidths, sharedDomWidths } from "@linebreak/text/native-width-cache"

class Fonts extends EventTarget {
  status: "loaded" | "loading" = "loaded"
  readonly faces = new Set<FontFace>();
  [Symbol.iterator]() { return this.faces[Symbol.iterator]() }
}
const fixture = () => {
  const owner = document.implementation.createHTMLDocument()
  const fonts = new Fonts()
  Object.defineProperty(owner, "fonts", { value: fonts })
  return { owner, fonts }
}
beforeEach(invalidateNativeWidths)

test("owners of the same document reuse widths while fonts and documents stay distinct", () => {
  const { owner } = fixture(), another = fixture().owner
  const measure = vi.fn((text: string) => text.length)
  expect(cachedNativeAdvance(owner, "one", measure)("word")).toBe(4)
  expect(cachedNativeAdvance(owner, "one", measure)("word")).toBe(4)
  expect(measure).toHaveBeenCalledOnce()
  cachedNativeAdvance(owner, "two", measure)("word")
  cachedNativeAdvance(another, "one", measure)("word")
  expect(measure).toHaveBeenCalledTimes(3)
})

test.each(["loading", "loadingdone", "loadingerror"])("%s expires retained widths", event => {
  const { owner, fonts } = fixture(), measure = vi.fn(() => 7)
  const advance = cachedNativeAdvance(owner, "font", measure)
  advance("word")
  fonts.dispatchEvent(new Event(event))
  advance("word")
  expect(measure).toHaveBeenCalledTimes(2)
})

test("pending loads, Unicode and oversized keys bypass retention", () => {
  const { owner, fonts } = fixture(), measure = vi.fn(() => 7)
  const advance = cachedNativeAdvance(owner, "font", measure)
  fonts.status = "loading"
  advance("word"); advance("word")
  fonts.status = "loaded"
  advance("é"); advance("é")
  advance("a".repeat(2049)); advance("a".repeat(2049))
  expect(measure).toHaveBeenCalledTimes(6)
})

test("explicit invalidation reaches existing cache closures", () => {
  const { owner } = fixture(), measure = vi.fn(() => 7)
  const advance = cachedNativeAdvance(owner, "font", measure)
  advance("word")
  invalidateNativeWidths()
  advance("word")
  expect(measure).toHaveBeenCalledTimes(2)
})

test("loaded face additions, descriptor changes and removal expire cross-owner reuse", () => {
  const { owner, fonts } = fixture(), measure = vi.fn(() => 7)
  const advance = () => cachedNativeAdvance(owner, "font", measure)("word")
  advance()
  const face = { family: "Example", style: "normal", weight: "400", status: "loaded" } as FontFace
  fonts.faces.add(face)
  advance()
  face.weight = "700"
  advance()
  fonts.faces.delete(face)
  advance()
  expect(measure).toHaveBeenCalledTimes(4)
})

test.each([1, 1000])("retention evicts old entries with %i-character text", size => {
  const { owner } = fixture(), measure = vi.fn(() => 7)
  const advance = cachedNativeAdvance(owner, "font", measure)
  advance("first")
  const count = size === 1 ? 1024 : 66
  for (let index = 0; index < count; index++) advance(`${index}${"a".repeat(size)}`)
  advance("first")
  expect(measure).toHaveBeenCalledTimes(count + 2)
})

test("nonfinite widths are returned without retention", () => {
  const { owner } = fixture(), measure = vi.fn(() => Infinity)
  const advance = cachedNativeAdvance(owner, "font", measure)
  expect(advance("word")).toBe(Infinity)
  expect(advance("word")).toBe(Infinity)
  expect(measure).toHaveBeenCalledTimes(2)
})

test.each([true, false])("calibration retains a %s result across owners", result => {
  const { owner } = fixture(), verify = vi.fn(() => result)
  expect(cachedNativeCalibration(owner, "font", verify)).toBe(result)
  expect(cachedNativeCalibration(owner, "font", verify)).toBe(result)
  expect(verify).toHaveBeenCalledOnce()
})

test("calibrations distinguish fonts and documents", () => {
  const { owner } = fixture(), verify = vi.fn(() => true)
  cachedNativeCalibration(owner, "one", verify)
  cachedNativeCalibration(owner, "two", verify)
  cachedNativeCalibration(fixture().owner, "one", verify)
  expect(verify).toHaveBeenCalledTimes(3)
})

test("loading and explicit resets expire calibration", () => {
  const { owner, fonts } = fixture(), verify = vi.fn(() => true)
  const check = () => cachedNativeCalibration(owner, "font", verify)
  check()
  fonts.dispatchEvent(new Event("loadingdone"))
  check()
  invalidateNativeWidths()
  check()
  expect(verify).toHaveBeenCalledTimes(3)
})

test("a load started during calibration cannot leave a retained result", () => {
  const { owner, fonts } = fixture(), verify = vi.fn(() => { fonts.status = "loading"; return true })
  cachedNativeCalibration(owner, "font", verify)
  fonts.status = "loaded"
  cachedNativeCalibration(owner, "font", verify)
  expect(verify).toHaveBeenCalledTimes(2)
})

test("calibration count and key lengths are bounded", () => {
  const { owner } = fixture(), verify = vi.fn(() => true)
  cachedNativeCalibration(owner, "first", verify)
  for (let index = 0; index < 32; index++) cachedNativeCalibration(owner, `font${index}`, verify)
  cachedNativeCalibration(owner, "first", verify)
  const large = "a".repeat(2049)
  cachedNativeCalibration(owner, large, verify)
  cachedNativeCalibration(owner, large, verify)
  expect(verify).toHaveBeenCalledTimes(36)
})

test("DOM widths reuse their own namespace and distinguish shaping signatures", () => {
  const { owner } = fixture()
  const dom = sharedDomWidths(owner, "font|0")!
  dom.set("word", 27.125)
  expect(sharedDomWidths(owner, "font|0")?.get("word")).toBe(27.125)
  expect(sharedDomWidths(owner, "font|.25")?.get("word")).toBeUndefined()
  expect(cachedNativeAdvance(owner, "font|0", () => 27.13)("word")).toBe(27.13)
  invalidateNativeWidths()
  expect(dom.get("word")).toBeUndefined()
})

test("DOM widths obey loading, character, numeric and shared-budget bounds", () => {
  const { owner, fonts } = fixture(), dom = sharedDomWidths(owner, "font")!
  for (const text of ["é", "a".repeat(2049)]) { dom.set(text, 1); expect(dom.get(text)).toBeUndefined() }
  dom.set("bad", Infinity)
  expect(dom.get("bad")).toBeUndefined()
  fonts.status = "loading"
  dom.set("pending", 1)
  expect(dom.get("pending")).toBeUndefined()
  fonts.status = "loaded"
  dom.set("first", 1)
  const native = cachedNativeAdvance(owner, "font", () => 1)
  for (let index = 0; index < 1024; index++) native(`${index}`)
  expect(dom.get("first")).toBeUndefined()
})
