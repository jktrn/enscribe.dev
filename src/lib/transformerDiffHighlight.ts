import type { ShikiTransformer } from 'shiki'

interface DiffInfo {
  add: number[]
  remove: number[]
  highlight: number[]
}

function parseDiffString(meta: string): DiffInfo {
  const result: DiffInfo = { add: [], remove: [], highlight: [] }
  const addMatch = meta.match(/add\{([\d,-]+)\}/)
  const removeMatch = meta.match(/remove\{([\d,-]+)\}/)
  const highlightMatch = meta.match(/highlight\{([\d,-]+)\}/)

  if (addMatch) {
    result.add = parseRanges(addMatch[1])
  }
  if (removeMatch) {
    result.remove = parseRanges(removeMatch[1])
  }
  if (highlightMatch) {
    result.highlight = parseRanges(highlightMatch[1])
  }

  return result
}

function parseRanges(rangeString: string): number[] {
  return rangeString.split(',').flatMap((v) => {
    const [start, end] = v.split('-').map((n) => parseInt(n, 10))
    if (!end) return [start]
    return Array.from({ length: end - start + 1 }, (_, i) => i + start)
  })
}

function parseStartingLineNumber(meta: string): number | null {
  const match = meta.match(/showLineNumbers\{(\d+)\}/)
  if (!match) return null
  return parseInt(match[1], 10)
}

export interface TransformerDiffHighlightOptions {
  addClassName?: string
  removeClassName?: string
  highlightClassName?: string
}

const diffSymbol = Symbol('diff-lines')
const startLineSymbol = Symbol('start-line')

export function transformerDiffHighlight(
  options: TransformerDiffHighlightOptions = {},
): ShikiTransformer {
  const {
    addClassName = 'diff add',
    removeClassName = 'diff remove',
    highlightClassName = 'diff highlight',
  } = options

  return {
    name: '@shikijs/transformers:diff-highlight',
    preprocess(code) {
      if (this.options.meta?.__raw) {
        const diffInfo = parseDiffString(this.options.meta.__raw)
        ;(this.meta as any)[diffSymbol] = diffInfo

        const startingLineNumber = parseStartingLineNumber(
          this.options.meta.__raw,
        )
        ;(this.meta as any)[startLineSymbol] = startingLineNumber || 1
      }
      return code
    },
    line(node, line) {
      if (!this.options.meta?.__raw) {
        return node
      }

      const diffInfo: DiffInfo = (this.meta as any)[diffSymbol]
      const startLine: number = (this.meta as any)[startLineSymbol]
      const adjustedLine = line + startLine - 1

      if (diffInfo.add.includes(adjustedLine)) {
        this.addClassToHast(node, addClassName)
      }
      if (diffInfo.remove.includes(adjustedLine)) {
        this.addClassToHast(node, removeClassName)
      }
      if (diffInfo.highlight.includes(adjustedLine)) {
        this.addClassToHast(node, highlightClassName)
      }

      return node
    },
  }
}
