import type { Hyphenator } from "../types"
import { englishExceptions, englishPatterns } from "./english-patterns"
import { createPatternHyphenator } from "./pattern-hyphenator"

const hyphenationLimits = Object.freeze({
  minimumWordLength: 5,
  left: 2,
  right: 3,
})

const englishLocales = new Map<string, boolean>()

const isEnglishLocale = (locale: string) => {
  try {
    return new Intl.Locale(locale).language === "en"
  } catch {
    return false
  }
}

const usesEnglishHyphenation = (locale: string) => {
  const known = englishLocales.get(locale)
  if (known !== undefined) return known
  const english = isEnglishLocale(locale)
  englishLocales.set(locale, english)
  return english
}

const hyphenationCacheLimit = 16_384

const hyphenated = new Map<string, Map<string, readonly number[]>>()
let hyphenatedWords = 0

const remember = (locale: string, word: string, offsets: readonly number[]) => {
  if (hyphenatedWords >= hyphenationCacheLimit) {
    hyphenated.clear()
    hyphenatedWords = 0
  }
  const known = hyphenated.get(locale)
  if (known) known.set(word, offsets)
  else hyphenated.set(locale, new Map([[word, offsets]]))
  hyphenatedWords += 1
  return offsets
}

const offsetsFor = createPatternHyphenator(
  englishPatterns,
  englishExceptions,
  hyphenationLimits.left,
  hyphenationLimits.right,
  true,
)

export const englishHyphenator: Hyphenator = (word, locale) => {
  if (word.length < hyphenationLimits.minimumWordLength) return []
  if (!usesEnglishHyphenation(locale)) return []

  const known = hyphenated.get(locale)?.get(word)
  if (known) return known

  return remember(locale, word, offsetsFor(word))
}
