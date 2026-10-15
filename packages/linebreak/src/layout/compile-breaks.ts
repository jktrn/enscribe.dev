import {
  box,
  type Glue,
  type Item,
  type ItemSource,
  type Penalty,
  penalty,
} from "./items"
import { INFINITE_PENALTY } from "./policy"
import type { Emit } from "./compile-context"
import type { Hangs } from "./protrusion"

export type CompiledSpace = Glue & { source: ItemSource }

export type BreakSequence = {
  readonly first: number
  readonly choices: { endpoint: Penalty; width: number }[]
  width: number
  boxed: boolean
}

const refreshDecoration = (
  emit: Emit,
  sequence: BreakSequence,
  offset: number,
) => {
  const item = box(sequence.width, { start: offset, end: offset })
  if (sequence.boxed) {
    emit.items[sequence.first] = item
  } else if (sequence.width !== 0) {
    // Only this sequence's authored endpoints move; no later glyph exists yet.
    emit.items.splice(sequence.first, 0, item)
    sequence.boxed = true
    emit.folded?.add(sequence.first)
  }
}

export const appendSequenceDecoration = (
  emit: Emit,
  width: number,
  offset: number,
) => {
  const sequence = emit.sequence
  if (!sequence) return false
  sequence.width += width
  refreshDecoration(emit, sequence, offset)
  return true
}

export const appendCompiledSpace = (
  emit: Emit,
  spacer: CompiledSpace,
  wraps: boolean,
) => {
  // Glue remains elastic; a preceding penalty suppresses only its break.
  if (!wraps && emit.items.at(-1)?.kind === "box") {
    emit.items.push(penalty(INFINITE_PENALTY, {
      source: { start: spacer.source.start, end: spacer.source.start },
    }))
  }
  emit.space = true
  emit.items.push(spacer)
}

export class BreakSequences {
  private readonly sequences: BreakSequence[] = []

  append(emit: Emit, width: number, offset: number) {
    const { items, space } = emit
    const spacer = space ? items.pop()! : undefined
    let sequence = emit.sequence
    if (!sequence) {
      sequence = {
        first: items.length,
        choices: [],
        width: 0,
        boxed: false,
      }
      emit.sequence = sequence
      this.sequences.push(sequence)
    }
    sequence.width += width
    refreshDecoration(emit, sequence, offset)
    const endpoint = penalty(0, { source: { start: offset, end: offset } })
    items.push(endpoint)
    sequence.choices.push({ endpoint, width: sequence.width })
    if (spacer) items.push(spacer)
    return endpoint
  }

  applyHangs(hangs: Hangs) {
    for (const sequence of this.sequences) {
      const carried = hangs.end[sequence.first]!
      const first = sequence.first + Number(sequence.boxed)
      for (const [index, choice] of sequence.choices.entries()) {
        // Move only the selected boundary's credit, not the carried scan state.
        if (choice.width === 0) hangs.end[first + index] = carried
        if (sequence.width !== choice.width) hangs.start[first + index + 1] = 0
      }
    }
  }

  finish(items: Item[], breakRuns: Map<Item, number>) {
    // Shared decoration precedes all choices, so every selected opportunity can
    // discard the same elastic space. Only later decoration continues afterward.
    for (const sequence of this.sequences) {
      const first = sequence.first + Number(sequence.boxed)
      for (const [index, choice] of sequence.choices.entries()) {
        const remaining = sequence.width - choice.width
        const endpoint = penalty(0, {
          width: 0 - remaining,
          continuationWidth: remaining === 0 ? undefined : remaining,
          source: choice.endpoint.source,
        })
        items[first + index] = endpoint
        // compileBlock registers every authored endpoint before final indexing.
        const runIndex = breakRuns.get(choice.endpoint)!
        breakRuns.delete(choice.endpoint)
        breakRuns.set(endpoint, runIndex)
      }
    }
  }
}
