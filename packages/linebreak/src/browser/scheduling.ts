/** Yield lazily so elapsed time includes the consumer's work on each paragraph. */
export function* queuedSlice(
  queued: Set<HTMLElement>,
  maximumBlocks: number,
  milliseconds: number,
): Generator<HTMLElement> {
  const started = performance.now()
  let count = 0
  for (const block of queued) {
    if (
      count >= maximumBlocks ||
      (count > 0 && performance.now() - started >= milliseconds)
    )
      return
    queued.delete(block)
    count += 1
    yield block
  }
}

/** Callers supply nonempty batches; prefetch one element before user hooks run. */
export const captureBatch = (elements: Iterable<HTMLElement>) => {
  const iterator = elements[Symbol.iterator]()
  const first = iterator.next().value as HTMLElement
  function* sequence(): Generator<HTMLElement> {
    yield first
    yield* { [Symbol.iterator]: () => iterator }
  }
  return { elements: sequence(), first }
}
