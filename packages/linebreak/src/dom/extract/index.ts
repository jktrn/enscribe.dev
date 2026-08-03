import { engineDefaults } from "../../policy"
import type { StyleReader } from "../style"
import { Collapser } from "./collapse"
import type { ExtractResult } from "./runs"
import { RawCollector } from "./walk"
import { buildWrapperInfo } from "./wrappers"

export const extractBlock = (
  block: HTMLElement,
  styleOf: StyleReader,
  maximumCharacters: number = engineDefaults.maximumCharacters,
): ExtractResult => {
  const collector = new RawCollector(block, styleOf)
  const rejected = collector.collect()
  if (rejected) return { ok: false, reason: rejected }

  const { text, runs, breakRestrictions } = Collapser.collapse(collector.raws)
  if (text.length === 0) return { ok: false, reason: "empty" }
  if (text.length > maximumCharacters) {
    return { ok: false, reason: "too-long" }
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

export { codeWrapper, LINE_SEPARATOR } from "./runs"
export type {
  ExtractedBlock,
  ExtractResult,
  InlineRun,
  WrapperInfo,
} from "./runs"
export { outerWidth, runEdgeWidths } from "./wrappers"
