import { policy } from "../../policy"
import type { StyleReader } from "../style"
import { Collapser } from "./collapse"
import type { ExtractResult } from "./runs"
import { RawCollector } from "./walk"
import { buildWrapperInfo } from "./wrappers"

export const extractBlock = (
  block: HTMLElement,
  styleOf: StyleReader,
): ExtractResult => {
  const collector = new RawCollector(block, styleOf)
  const rejected = collector.collect()
  if (rejected) return { ok: false, diagnostic: rejected }

  const { text, runs, breakRestrictions } = Collapser.collapse(collector.raws)
  if (text.length === 0) {
    return { ok: false, diagnostic: { kind: "empty-content", element: block } }
  }
  if (text.length > policy.limits.maximumCharacters) {
    return {
      ok: false,
      diagnostic: {
        kind: "content-too-long",
        element: block,
        length: text.length,
        maximum: policy.limits.maximumCharacters,
      },
    }
  }

  return {
    ok: true,
    block: {
      text,
      runs,
      breakRestrictions,
      wrappers: buildWrapperInfo(runs, styleOf),
    },
  }
}

export {
  breakAllowedAt,
  codeWrapper,
  hasVisibleText,
  LINE_SEPARATOR,
} from "./runs"
export type { ExtractedBlock, ExtractResult, InlineRun } from "./runs"
export { outerWidth, runEdgeWidths } from "./wrappers"
