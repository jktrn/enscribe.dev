import englishHyphenation from "hyphen/en-us"
import { hyphenationLimits } from "../layout/policy"
import type { Hyphenator } from "../types"

const { hyphenateSync } = englishHyphenation

const SOFT_HYPHEN = "\u00AD"

const englishLocales = new Map<string, boolean>()

export const usesEnglishHyphenation = (locale: string) => {
  const known = englishLocales.get(locale)
  if (known !== undefined) return known
  let english = false
  try {
    english = new Intl.Locale(locale).language === "en"
  } catch {
    english = false
  }
  englishLocales.set(locale, english)
  return english
}

export const hyphenationCacheLimit = 16_384

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

const offsetsFor = (word: string): readonly number[] => {
  const marked = hyphenateSync(word, {
    minWordLength: hyphenationLimits.minimumWordLength,
  })
  if (!marked.includes(SOFT_HYPHEN)) return []

  const offsets: number[] = []
  let offset = 0
  for (const character of marked) {
    if (character === SOFT_HYPHEN) offsets.push(offset)
    else offset += character.length
  }
  return offsets
}

export const englishHyphenator: Hyphenator = (word, locale) => {
  if (word.length < hyphenationLimits.minimumWordLength) return []
  if (!usesEnglishHyphenation(locale)) return []

  const known = hyphenated.get(locale)?.get(word)
  if (known) return known

  return remember(locale, word, offsetsFor(word))
}
