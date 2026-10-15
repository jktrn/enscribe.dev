import { expect, test } from "bun:test"
import { englishHyphenator } from "@linebreak/text/hyphenate"

test("locale parsing remembers both accepted and malformed tags", () => {
  const OriginalLocale = Intl.Locale
  const descriptor = Object.getOwnPropertyDescriptor(Intl, "Locale")
  if (!descriptor) throw new Error("Intl.Locale descriptor is unavailable")
  const calls = new Map<string, number>()
  class CountingLocale extends OriginalLocale {
    constructor(tag: string | Intl.Locale, options?: Intl.LocaleOptions) {
      const key = String(tag)
      calls.set(key, (calls.get(key) ?? 0) + 1)
      super(tag, options)
    }
  }
  Object.defineProperty(Intl, "Locale", {
    ...descriptor,
    value: CountingLocale,
  })
  try {
    const accepted = "en-x-lb-locale-cache"
    const rejected = "en__lb_locale_cache"
    for (let repeat = 0; repeat < 2; repeat += 1) {
      expect(englishHyphenator("representation", accepted)).toEqual([
        3, 5, 8, 10,
      ])
      expect(englishHyphenator("representation", rejected)).toEqual([])
    }
    expect(calls.get(accepted)).toBe(1)
    expect(calls.get(rejected)).toBe(1)
    expect(englishHyphenator("cat", "en-x-lb-short")).toEqual([])
    expect(englishHyphenator("idea", "en-x-lb-short")).toEqual([])
    expect(calls.has("en-x-lb-short")).toBe(false)
  } finally {
    Object.defineProperty(Intl, "Locale", descriptor)
  }
})

test("a fresh locale stores its first result and retains it after other words", () => {
  const locale = "en-x-lb-first"
  const first = englishHyphenator("representation", locale)
  expect(englishHyphenator("representation", locale)).toBe(first)
  const second = englishHyphenator("beautiful", locale)
  expect(englishHyphenator("representation", locale)).toBe(first)
  expect(englishHyphenator("beautiful", locale)).toBe(second)
})

test("the word cache evicts exactly when inserting beyond its declared capacity", () => {
  const capacity = 16_384
  const locale = "en-x-lb-bound"
  let sentinel = englishHyphenator("representation", locale)
  let synchronized = false
  // Observe an actual eviction, independent of entries created by prior tests.
  // The triggering word and restored sentinel then occupy exactly two entries.
  for (let index = 0; index <= capacity; index += 1) {
    englishHyphenator(`zzinitial${index.toString(36)}`, locale)
    const recalled = englishHyphenator("representation", locale)
    if (recalled !== sentinel) {
      sentinel = recalled
      synchronized = true
      break
    }
  }
  expect(synchronized).toBe(true)
  for (let index = 0; index < capacity - 2; index += 1) {
    englishHyphenator(`zznext${index.toString(36)}`, locale)
  }
  expect(englishHyphenator("representation", locale)).toBe(sentinel)
  englishHyphenator("zzboundaryword", locale)
  const after = englishHyphenator("representation", locale)
  expect(after).not.toBe(sentinel)
  expect(after).toEqual(sentinel)
})
