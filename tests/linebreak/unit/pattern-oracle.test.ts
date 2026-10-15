import { expect, test } from "bun:test"
import { createPatternHyphenator } from "@linebreak/text/pattern-hyphenator"

type Pattern = { letters: string; weights: number[] }
let state = 20260904
const random = (limit: number) => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return Math.floor((state / 2 ** 32) * limit)
}
const spelling = (alphabet: string, length: number) => {
  const symbols = Array.from(alphabet)
  return Array.from({ length }, () => symbols[random(symbols.length)]).join("")
}
const encode = (pattern: Pattern, markerEncoding: boolean) =>
  (markerEncoding ? "A" : "0") +
  pattern.weights
    .map((weight, index) => `${weight || ""}${pattern.letters[index] ?? ""}`)
    .join("")

// Deliberately scan every pattern at every start; no trie or failure links.
const exhaustive = (
  patterns: Pattern[],
  word: string,
  left: number,
  right: number,
) => {
  const text = `.${word.toLowerCase()}.`
  const weights = Array.from({ length: text.length + 1 }, () => 0)
  for (const pattern of patterns) {
    for (
      let start = 0;
      start + pattern.letters.length <= text.length;
      start += 1
    ) {
      if (!text.startsWith(pattern.letters, start)) continue
      for (const [offset, weight] of pattern.weights.entries()) {
        weights[start + offset] = Math.max(weights[start + offset], weight)
      }
    }
  }
  return weights
    .slice(1, word.length + 2)
    .flatMap((weight, offset) =>
      weight % 2 === 1 && offset >= left && offset <= word.length - right
        ? [offset]
        : [],
    )
}

for (const markerEncoding of [false, true])
  for (const alphabet of ["abc", "ab😀😁é"])
    test(`${markerEncoding ? "marker" : "generic"} matching ${alphabet} agrees with 8000 exhaustive pattern overlays`, () => {
      state = 20260904
      for (let dictionary = 0; dictionary < 400; dictionary += 1) {
        const unique = new Map<string, Pattern>()
        for (let index = 0; index < 20; index += 1) {
          const letters = `${random(5) === 0 ? "." : ""}${spelling(alphabet, 1 + random(5))}${random(5) === 0 ? "." : ""}`
          unique.set(letters, {
            letters,
            weights: Array.from({ length: letters.length + 1 }, () =>
              random(6),
            ),
          })
        }
        const patterns = [...unique.values()]
        const left = random(3)
        const right = random(3)
        const hyphenate = createPatternHyphenator(
          patterns
            .map((pattern) => encode(pattern, markerEncoding))
            .join(markerEncoding ? "" : " "),
          "",
          left,
          right,
          markerEncoding,
        )
        for (let sample = 0; sample < 20; sample += 1) {
          const word = spelling(`${alphabet}x`, 1 + random(20))
          expect(
            hyphenate(sample % 2 === 0 ? word.toUpperCase() : word),
          ).toEqual(exhaustive(patterns, word, left, right))
        }
      }
    })
