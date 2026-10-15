import { breakAllowedAt, wordJoinerAllows } from "../text/source"
import type { CompiledBlock } from "./block"
import type { Emit } from "./compile-context"

// CSS Text 3 §5.6: GL/WJ/ZWJ suppress wrapping beside atomic inlines,
// except U+00A0. These GL and ZWJ ranges come from Unicode 17 LineBreak.txt.
const INSEPARABLE =
  /[\u{35C}-\u{362}\u{F08}\u{F0C}\u{F12}\u{FD9}-\u{FDA}\u{180E}\u{1AEB}\u{1DCD}\u{1DFC}\u{2007}\u{2011}\u{202F}\u{FE20}\u{FE22}\u{FE24}\u{FE26}-\u{FE27}\u{FE29}\u{FE2B}\u{FE2D}-\u{FE2E}\u{1107F}\u{13430}-\u{13436}\u{13439}-\u{1343B}\u{16FE4}\u{200D}]/u

export const appendAtomBoundary = (
  emit: Emit,
  block: CompiledBlock,
  offset: number,
) => {
  // Both callers precede an atom or nonempty text, never paragraph end.
  if (offset === 0) return
  // Nonzero source starts follow an emitted item, including the forbidden
  // marker retained for an invisible leading character.
  if (emit.items.at(-1)!.kind !== "box") return
  if (!breakAllowedAt(block.breakRestrictions, offset)) return
  if (!wordJoinerAllows(block.text, offset)) return
  const left = Array.from(block.text.slice(Math.max(0, offset - 2), offset)).at(
    -1,
  )!
  const right = String.fromCodePoint(block.text.codePointAt(offset)!)
  if (INSEPARABLE.test(left) || INSEPARABLE.test(right)) return
  emit.items.push({
    kind: "penalty",
    width: 0,
    penalty: 0,
    flagged: false,
    source: { start: offset, end: offset },
  })
}
