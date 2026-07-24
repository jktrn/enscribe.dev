import type { TypesetContent } from "./typeset-content"

export type ReadingAnchor = { element: Element; top: number }

type ManagedBlocks = Pick<TypesetContent, "blockSet" | "blockContainers">

const PROBE_OFFSETS = [0, -0.05, 0.05, -0.1, 0.1]
const READING_FOCUS = 0.45

const closestManagedBlock = (element: Element, blocks: ManagedBlocks) => {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    if (current instanceof HTMLElement && blocks.blockSet.has(current)) {
      return current
    }
  }
  return null
}

export const prioritizeForReading = (blocks: readonly HTMLElement[]) => {
  const focus = innerHeight * READING_FOCUS
  return blocks
    .map((block) => ({
      block,
      distance: Math.abs(block.getBoundingClientRect().top - focus),
    }))
    .sort((left, right) => left.distance - right.distance)
    .map(({ block }) => block)
}

export const captureReadingAnchor = (
  blocks: ManagedBlocks,
): ReadingAnchor | null => {
  if (scrollY === 0) return null
  const viewportHeight = innerHeight
  const focus = viewportHeight * READING_FOCUS
  const probeX = innerWidth / 2
  let lastResort: Element | null = null
  for (const offset of PROBE_OFFSETS) {
    const probe = document.elementFromPoint(
      probeX,
      focus + viewportHeight * offset,
    )
    const block = probe && closestManagedBlock(probe, blocks)
    if (block) return { element: block, top: block.getBoundingClientRect().top }
    if (
      !lastResort &&
      probe?.closest("main") &&
      !blocks.blockContainers.has(probe)
    ) {
      lastResort = probe
    }
  }
  return lastResort
    ? { element: lastResort, top: lastResort.getBoundingClientRect().top }
    : null
}

export const restoreReadingAnchor = (anchor: ReadingAnchor | null) => {
  if (!anchor?.element.isConnected) return
  const delta = anchor.element.getBoundingClientRect().top - anchor.top
  if (Math.abs(delta) > 0.5) scrollBy({ top: delta, behavior: "instant" })
}
