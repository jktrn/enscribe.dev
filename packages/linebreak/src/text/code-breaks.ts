const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
})

const separatorPattern = /[./\\,;:]/u
const operatorPattern = /[-=+*%<>!&|?~^]/u

const identifierPattern = /[\p{L}\p{N}$]/u
const lowercaseOrDigitPattern = /[\p{Ll}\p{N}]/u
const uppercasePattern = /\p{Lu}/u
const lowercasePattern = /\p{Ll}/u

const codeBreakPenalty = {
  separator: 300,
  closingDelimiter: 450,
  operator: 550,
  wordSeparator: 750,
  identifierBoundary: 850,
  letterNumberBoundary: 900,
  emergency: 950,
} as const

export const codeBreakOffsets = (text: string) => {
  const graphemes = [...graphemeSegmenter.segment(text)]
  const penalties = new Map<number, number>()
  const add = (offset: number, penalty: number) => {
    if (offset <= 0 || offset >= text.length) return
    const current = penalties.get(offset)
    if (current === undefined || penalty < current) {
      penalties.set(offset, penalty)
    }
  }

  for (let index = 1; index <= graphemes.length; index += 1) {
    const before = graphemes[index - 1]?.segment ?? ""
    const after = graphemes[index]?.segment ?? ""
    const next = graphemes[index + 1]?.segment ?? ""
    const previous = graphemes[index - 2]?.segment ?? ""
    const offset = graphemes[index]?.index ?? text.length

    if (/\s/u.test(before) || /\s/u.test(after)) continue

    if (separatorPattern.test(before)) {
      const decimalPoint =
        before === "." && /\p{N}/u.test(previous) && /\p{N}/u.test(after)
      const middleOfNamespace = before === ":" && after === ":"
      const middleOfRepeatedSeparator =
        before === after && /[./\\]/u.test(before)
      if (!decimalPoint && !middleOfNamespace && !middleOfRepeatedSeparator) {
        add(offset, codeBreakPenalty.separator)
      }
    }

    if (/[)\]}]/u.test(before)) {
      add(offset, codeBreakPenalty.closingDelimiter)
    }

    if (operatorPattern.test(before) && !operatorPattern.test(after)) {
      add(offset, codeBreakPenalty.operator)
    }

    if (before === "_" || (before === "-" && !operatorPattern.test(after))) {
      add(offset, codeBreakPenalty.wordSeparator)
    }

    const camelCaseBoundary =
      lowercaseOrDigitPattern.test(before) && uppercasePattern.test(after)

    const acronymBoundary =
      uppercasePattern.test(previous) &&
      uppercasePattern.test(before) &&
      lowercasePattern.test(next)
    if (camelCaseBoundary || acronymBoundary) {
      add(offset, codeBreakPenalty.identifierBoundary)
    }

    const letterNumberBoundary =
      (/[\p{L}]/u.test(before) && /\p{N}/u.test(after)) ||
      (/\p{N}/u.test(before) && /[\p{L}]/u.test(after))
    if (letterNumberBoundary) {
      add(offset, codeBreakPenalty.letterNumberBoundary)
    }
  }

  let identifierStart = 0
  while (identifierStart < graphemes.length) {
    if (!identifierPattern.test(graphemes[identifierStart].segment)) {
      identifierStart += 1
      continue
    }

    let identifierEnd = identifierStart + 1
    while (
      identifierEnd < graphemes.length &&
      identifierPattern.test(graphemes[identifierEnd].segment)
    ) {
      identifierEnd += 1
    }

    if (identifierEnd - identifierStart >= 5) {
      const length = identifierEnd - identifierStart
      const interiorBreaks = new Set([
        identifierStart + Math.floor(length / 2),
        identifierStart + Math.ceil((length * 2) / 3),
      ])
      for (const index of interiorBreaks) {
        if (index < identifierStart + 2 || index > identifierEnd - 2) continue
        add(graphemes[index].index, codeBreakPenalty.emergency)
      }
    }
    identifierStart = identifierEnd
  }

  return penalties
}
