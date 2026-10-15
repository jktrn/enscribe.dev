/** Printable ASCII joins within each space-delimited run. Dashes and question
 * marks can introduce internal line breaks; leave those and Unicode to pretext. */
export const plainParts = (text: string): string[] | null =>
  /[^\x20-\x7e]|[-?]/u.test(text) ? null : text.match(/ +|[^ ]+/gu) ?? []

/** Certify simple Latin words before recognizing internal hyphen boundaries. */
export const hyphenatedParts = (text: string): string[] | null => {
  if (/[^\x20-\x7e\u00ad]|[?]/u.test(text)) return null
  const words = text.match(/ +|[^ ]+/gu) ?? []
  const parts: string[] = []
  for (const word of words) {
    if (!/[-\u00ad]/u.test(word)) { parts.push(word); continue }
    if (!/^[A-Za-z]+(?:[-\u00ad][A-Za-z]+)+[.,;:!]?$/u.test(word)) return null
    parts.push(...word.match(/[A-Za-z]+-|\u00ad|[^\u00ad-]+/gu)!)
  }
  return parts
}

/** Latin words with attached quotes and punctuation; em dashes remain separate. */
export const punctuationParts = (text: string): string[] | null => {
  if (/——|[^A-Za-z .,;:!?()'"‘’“”—]/u.test(text)) return null
  if (/(?<![A-Za-z])—|—(?![A-Za-z])/u.test(text)) return null
  const parts = text.match(/ +|—|[^ —]+/gu) ?? []
  for (const part of parts) {
    if (part === "—" || part[0] === " ") continue
    if (!/^[('"‘“]*[A-Za-z]+(?:['’][A-Za-z]+)*[.,;:!?'"’”)]*$/u.test(part)) return null
  }
  return parts
}
