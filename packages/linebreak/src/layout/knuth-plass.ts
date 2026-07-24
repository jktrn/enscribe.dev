import { defaultLayoutPolicy } from "./default-policy"
import {
  type MeasuredLine,
  type OptimizedLine,
  ParagraphLineModel,
} from "./line-model"

type State = {
  cost: number
  fitness: number
  hyphenRun: number
  lineCount: number
  previous: State | null
  line: MeasuredLine | null
}

const addState = (states: State[], candidate: State) => {
  const existingIndex = states.findIndex(
    (state) =>
      state.fitness === candidate.fitness &&
      state.hyphenRun === candidate.hyphenRun,
  )

  if (existingIndex === -1) {
    states.push(candidate)
  } else if (candidate.cost < states[existingIndex].cost) {
    states[existingIndex] = candidate
  }
}

const collectLines = (final: State): OptimizedLine[] => {
  const lines: OptimizedLine[] = []
  let state: State | null = final
  while (state?.line) {
    lines.push({
      start: state.line.start,
      end: state.line.end,
      discretionaryHyphen: state.line.discretionaryHyphen,
      naturalWidth: state.line.naturalWidth,
      wordSpacing: state.line.wordSpacing,
      letterSpacing: state.line.letterSpacing,
      spaceCount: state.line.spaceCount,
      naturalBreakCount: state.line.naturalBreakCount,
      characterCount: state.line.characterCount,
      spaceWidth: state.line.spaceWidth,
      trackingLimit: state.line.trackingLimit,
      breakKind: state.line.breakKind,
    })
    state = state.previous
  }
  return lines.reverse()
}

export const optimizeParagraph = (
  model: ParagraphLineModel,
  maxWidth: number,
): OptimizedLine[] | null => {
  const layout = model.atWidth(maxWidth)
  if (layout.candidates.length < 3) return null

  const states: State[][] = Array.from(
    { length: layout.candidates.length },
    () => [],
  )
  states[0].push({
    cost: 0,
    fitness: 1,
    hyphenRun: 0,
    lineCount: 0,
    previous: null,
    line: null,
  })

  for (
    let fromIndex = 0;
    fromIndex < layout.candidates.length - 1;
    fromIndex += 1
  ) {
    if (states[fromIndex].length === 0) continue

    for (
      let toIndex = fromIndex + 1;
      toIndex < layout.candidates.length;
      toIndex += 1
    ) {
      const isLastLine = toIndex === layout.candidates.length - 1
      const line = layout.measure(fromIndex, toIndex)
      const verdict = layout.verdict(line, isLastLine)
      if (verdict === "stop") break
      if (verdict === "skip") continue

      const fitness = layout.fitness(line, isLastLine)
      const cost =
        layout.demerits(line, isLastLine) + layout.candidates[toIndex].penalty

      for (const previous of states[fromIndex]) {
        const hyphenRun = line.discretionaryHyphen
          ? Math.min(previous.hyphenRun + 1, 3)
          : 0
        let transitionCost = 0
        if (line.discretionaryHyphen) {
          transitionCost += defaultLayoutPolicy.optimizer.hyphen
          if (previous.hyphenRun > 0) {
            transitionCost +=
              previous.hyphenRun ** 2 *
              defaultLayoutPolicy.optimizer.consecutiveHyphenMultiplier
          }
        }
        if (
          previous.lineCount > 0 &&
          Math.abs(fitness - previous.fitness) > 1
        ) {
          transitionCost += defaultLayoutPolicy.optimizer.fitnessJump
        }

        addState(states[toIndex], {
          cost: previous.cost + cost + transitionCost,
          fitness,
          hyphenRun,
          lineCount: previous.lineCount + 1,
          previous,
          line,
        })
      }
    }
  }

  const final = states
    .at(-1)
    ?.reduce<State | null>(
      (best, state) => (!best || state.cost < best.cost ? state : best),
      null,
    )
  if (!final || final.lineCount < 2) return null
  return collectLines(final)
}
