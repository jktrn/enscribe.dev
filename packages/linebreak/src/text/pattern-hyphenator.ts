type PatternNode = {
  next: Map<number, PatternNode>
  child: PatternNode | null
  code: number
  weights: number[]
  failure: PatternNode | null
}

const NO_EDGES = new Map<number, PatternNode>()
const NO_WEIGHTS: number[] = []

const node = (): PatternNode => ({
  next: NO_EDGES,
  child: null,
  code: -1,
  weights: NO_WEIGHTS,
  failure: null,
})

const edge = (state: PatternNode, code: number) =>
  state.code === code ? state.child : state.next.get(code)

const setEdge = (state: PatternNode, code: number, child: PatternNode) => {
  if (state.child === null) {
    state.code = code
    state.child = child
  } else {
    if (state.next === NO_EDGES) state.next = new Map()
    state.next.set(code, child)
  }
}

const addPattern = (root: PatternNode, pattern: string) => {
  let current = root
  let offset = 0
  const weights: number[] = [0]
  for (let index = 0; index < pattern.length; index += 1) {
    const code = pattern.charCodeAt(index)
    if (code >= 48 && code <= 57) {
      weights[offset] = code - 48
      continue
    }
    let child = edge(current, code)
    if (!child) {
      child = node()
      setEdge(current, code, child)
    }
    current = child
    offset += 1
    weights.push(0)
  }
  // Distances from the match end let suffix-pattern weights share one overlay.
  current.weights = weights.reverse()
}

const advance = (root: PatternNode, state: PatternNode, code: number) => {
  let next = edge(state, code)
  while (!next && state.failure) {
    state = state.failure
    next = edge(state, code)
  }
  return next ?? root
}

const linkChild = (
  root: PatternNode,
  parent: PatternNode,
  code: number,
  child: PatternNode,
  queue: PatternNode[],
) => {
  const fallback = advance(root, parent.failure as PatternNode, code)
  child.failure = fallback
  if (child.weights.length === 0) child.weights = fallback.weights
  else {
    for (let distance = 0; distance < fallback.weights.length; distance += 1) {
      child.weights[distance] = Math.max(
        child.weights[distance],
        fallback.weights[distance],
      )
    }
  }
  queue.push(child)
}

const linkFailures = (root: PatternNode) => {
  const queue = root.child ? [root.child, ...root.next.values()] : []
  for (const child of queue) child.failure = root
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index]
    if (state.child) linkChild(root, state, state.code, state.child, queue)
    for (const [code, child] of state.next)
      linkChild(root, state, code, child, queue)
  }
}

// Preserve insertion order; the first transition lives directly in its state.
const completeRootTransitions = (root: PatternNode) => {
  const entries = [...root.next]
  if (root.child) entries.unshift([root.code, root.child])
  for (const [, state] of entries) {
    for (const [code, target] of entries) {
      if (!edge(state, code)) setEdge(state, code, target)
    }
  }
}

const compilePatterns = (packed: string, markerEncoding: boolean) => {
  const root = node()
  let previous = ""
  if (markerEncoding) {
    let start = 0
    for (let end = 1; end <= packed.length; end += 1) {
      const code = packed.charCodeAt(end)
      if (end === packed.length || (code >= 65 && code <= 90)) {
        previous =
          previous.slice(0, packed.charCodeAt(start) - 65) +
          packed.slice(start + 1, end)
        addPattern(root, previous)
        start = end
      }
    }
  } else {
    for (const token of packed.split(" ")) {
      previous = previous.slice(0, token.charCodeAt(0) - 48) + token.slice(1)
      addPattern(root, previous)
    }
  }
  linkFailures(root)
  completeRootTransitions(root)
  return root
}

const exceptionOffsets = (definition: string) => {
  const parts = definition.split("-")
  let offset = 0
  return parts.slice(0, -1).map((part) => (offset += part.length))
}

const patternOffsets = (root: PatternNode, word: string) => {
  const wrapped = `.${word}.`
  const weights = new Uint8Array(wrapped.length + 1)
  let state = root
  for (let end = 0; end < wrapped.length; end += 1) {
    state = advance(root, state, wrapped.charCodeAt(end))
    for (let distance = 0; distance < state.weights.length; distance += 1) {
      const offset = end + 1 - distance
      weights[offset] = Math.max(weights[offset], state.weights[distance])
    }
  }
  const offsets: number[] = []
  for (let offset = 0; offset <= word.length; offset += 1) {
    if (weights[offset + 1] % 2 === 1) offsets.push(offset)
  }
  return offsets
}

/** Compile Liang weights into a lazy Aho–Corasick matcher; offsets are UTF-16 indices. */
export const createPatternHyphenator = (
  packed: string,
  exceptions: string,
  left: number,
  right: number,
  markerEncoding = false,
) => {
  let root: PatternNode | undefined
  const exceptionMap = new Map(
    exceptions
      .split(" ")
      .map((definition) => [
        definition.replaceAll("-", ""),
        exceptionOffsets(definition),
      ]),
  )
  return (word: string): readonly number[] => {
    const lower = word.toLowerCase()
    if (lower.length !== word.length) return []
    const known = exceptionMap.get(lower)
    const offsets =
      known ??
      patternOffsets((root ??= compilePatterns(packed, markerEncoding)), lower)
    return offsets.filter(
      (offset) => offset >= left && offset <= word.length - right,
    )
  }
}
