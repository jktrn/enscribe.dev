import type { ShikiTransformer } from 'shiki'
import { createCommentNotationTransformer } from '@shikijs/transformers'

export interface TransformerNotationSkipOptions {
  /**
   * Class for skipped lines
   */
  classActiveSkip?: string
  /**
   * Class added to the root element when the code has skipped lines
   */
  classActivePre?: string
}

export function transformerNotationSkip(
  options: TransformerNotationSkipOptions = {},
): ShikiTransformer {
  const { classActiveSkip = 'skip', classActivePre = undefined } = options

  return createCommentNotationTransformer(
    'skip-lines',
    // comment-start             | marker   | range       | comment-end
    /^\s*(?:\/\/|\/\*|<!--|#)\s+\[!code skip:(\d+):(\d+)\]\s*(?:\*\/|-->)?/,
    function ([_, start, end], _line) {
      _line.children = [{ type: 'text', value: `${start}-${end}` }]
      _line.properties = { style: `counter-set:line ${end}` }

      if (classActiveSkip) this.addClassToHast(_line, classActiveSkip)
      if (classActivePre) this.addClassToHast(this.pre, classActivePre)
      return false
    },
    false, // remove empty lines
  )
}
