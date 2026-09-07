let segmenter: Intl.Segmenter | undefined

export const graphemes = (text: string): Iterable<Intl.SegmentData> => {
  if (!/[^\x20-\x7e]/u.test(text)) {
    return Array.from(text, (segment, index) => ({ segment, index, input: text }))
  }
  segmenter ??= new Intl.Segmenter()
  return segmenter.segment(text)
}
