import type { SourceRange } from "../../text/source"
import type { StyleReader } from "../style"
import type { InlineRun } from "./runs"

export const appendRestriction = (
  ranges: SourceRange[],
  start: number,
  end: number,
) => {
  if (start >= end) return
  const previous = ranges.at(-1)
  if (previous && start <= previous.end) {
    previous.end = Math.max(previous.end, end)
  } else {
    ranges.push({ start, end })
  }
}

const commonAncestor = (left: Element, right: Element) => {
  // Every extracted source element belongs to the same authored block.
  let ancestor = left
  while (!ancestor.contains(right)) ancestor = ancestor.parentElement!
  return ancestor
}

const beginsDisappearingBreak = (run: InlineRun) =>
  run.kind === "text" && /^[ \u00ad\u200b]/u.test(run.text)

export const restrictAtoms = (
  runs: readonly InlineRun[],
  ranges: SourceRange[],
  styleOf: StyleReader,
) => {
  let previous: InlineRun | undefined
  const combined = [...ranges]
  for (const run of runs) {
    if (run.kind === "anchor") continue
    if (previous && (previous.kind === "atom" || run.kind === "atom")) {
      const ancestor = commonAncestor(previous.sourceElement, run.sourceElement)
      if (
        styleOf(ancestor).textWrapMode === "nowrap" &&
        (!beginsDisappearingBreak(run) ||
          styleOf(run.sourceElement).textWrapMode === "nowrap")
      ) {
        combined.push({ start: run.start, end: run.start + 1 })
      }
    }
    previous = run
  }
  combined.sort((left, right) => left.start - right.start)
  const merged: SourceRange[] = []
  for (const range of combined)
    appendRestriction(merged, range.start, range.end)
  return merged
}
