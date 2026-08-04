export type Hyphenator = (word: string, locale: string) => readonly number[]

export type SourceRange = { start: number; end: number }

export const hasVisibleText = (text: string) => /[^\t\n\f\r ]/u.test(text)

export const collapseWhitespace = (text: string) =>
  text.replace(/[\t\n\f\r ]+/gu, " ")

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
