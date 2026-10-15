export type Hyphenator = (word: string, locale: string) => readonly number[]

export type SourceRange = { start: number; end: number }

export const hasLineContent = (text: string) => /[^\t\n\f\r \u00ad\u200b]/u.test(text)

export const hasVisibleText = (text: string) => /[^\t\n\f\r ]/u.test(text)

export const collapseWhitespace = (text: string) =>
  text.replace(/[\t\n\f\r ]+/gu, " ")

const isWordJoiner = (character: string | undefined) =>
  character === "\u2060" || character === "\uFEFF"

const COMBINING_START = /^[\p{M}\u200D]/u
const COMBINING_END = /[\p{M}\u200D]$/u
const COMBINING_RESET = /[\u000A-\u000D \u0085\u2028\u2029\u200B]/u

export const combiningSizeAt = (text: string, offset: number) => {
  if (text.charCodeAt(offset) < 0x0300) return 0
  return COMBINING_START.exec(text.slice(offset, offset + 2))?.[0].length ?? 0
}

export const combiningBaseEnd = (text: string, offset: number) => {
  let end = offset
  while (text.charCodeAt(end - 1) >= 0x0300) {
    const combining = COMBINING_END.exec(text.slice(Math.max(0, end - 2), end))
    if (!combining) break
    end -= combining[0].length
  }
  return end
}

// UAX #14 LB8a/LB9: marks inherit their base; SPACE, ZW and hard breaks reset it.
export const combiningBoundaryAllows = (text: string, offset: number) => {
  const before = text.charAt(offset - 1)
  if (before === "\u200D") return false
  if (combiningSizeAt(text, offset) === 0) return true
  return COMBINING_RESET.test(before)
}

export const wordJoinerAllows = (text: string, offset: number) => {
  if (isWordJoiner(text[combiningBaseEnd(text, offset) - 1])) return false
  if (!isWordJoiner(text[offset])) return true
  // Unicode UAX #14: LB8 (ZW SP* break) precedes LB11 (no WJ break).
  let before = offset - 1
  while (text[before] === " ") before -= 1
  return text[before] === "\u200B"
}

// Unicode 17 HY/HH (UAX #14 LB21); SP and ZW opportunities have priority.
// Atomic inline boundaries use their separate CSS Text 3 tailoring.
const HYPHEN_START =
  /^[-\u058A\u05BE\u1400\u2010\u2012\u2013\u2E17\u2E40\u2E5D\u{10D6E}\u{10EAD}]/u

export const hyphenBoundaryAllows = (text: string, offset: number) =>
  !HYPHEN_START.test(text.slice(offset, offset + 2)) ||
  text[offset - 1] === " " ||
  text[offset - 1] === "\u200B"

export const breakAllowedAt = (
  restrictions: readonly SourceRange[],
  offset: number,
) => {
  let low = 0
  let high = restrictions.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if ((restrictions[middle] as SourceRange).start <= offset) low = middle + 1
    else high = middle
  }
  const range = restrictions[low - 1]
  return !range || offset >= range.end
}
