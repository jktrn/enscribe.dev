export type ReadingAnchor = { element: Element; top: number }

const BLOCK_SELECTOR = "p, li, blockquote, dt, dd, figcaption, td, th"
const PROBE_OFFSETS = [0, -0.05, 0.05, -0.1, 0.1]
const READING_FOCUS = 0.45

export const captureReadingAnchor = (): ReadingAnchor | null => {
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
    if (!probe?.closest("main")) continue
    const block = probe.closest(BLOCK_SELECTOR)
    if (block) return { element: block, top: block.getBoundingClientRect().top }
    if (!lastResort) lastResort = probe
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
