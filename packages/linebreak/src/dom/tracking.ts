import { graphemes } from "../text/graphemes"
import type { ExtractedBlock, InlineRun } from "./extract"

export const hasSplitGrapheme = (block: ExtractedBlock) => {
  const boundaries = new Set<number>()
  let previous: InlineRun | undefined
  for (const run of block.runs) {
    if (run.kind === "anchor") continue
    if (previous?.kind === "text" && run.kind === "text") {
      boundaries.add(run.start)
    }
    previous = run
  }
  if (boundaries.size === 0) return false
  for (const { index } of graphemes(block.text)) boundaries.delete(index)
  return boundaries.size !== 0
}
