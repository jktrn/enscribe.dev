const ROOT_SELECTOR = "[data-typeset-root]"
const BLOCK_SELECTOR =
  "p, li, blockquote, dt, dd, figcaption, td, th, bento-note"

export type TypesetContent = {
  readonly blocks: readonly HTMLElement[]
  readonly blockSet: ReadonlySet<HTMLElement>
  readonly blockContainers: ReadonlySet<Element>
}

export const discoverTypesetContent = (): TypesetContent => {
  const roots = [
    ...document.querySelectorAll<HTMLElement>(ROOT_SELECTOR),
  ].filter((root) => !root.parentElement?.closest(ROOT_SELECTOR))
  const candidates = new Set(
    roots.flatMap((root) => [
      ...root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR),
    ]),
  )
  const nestedBlocks = new Set<HTMLElement>()
  const blockContainers = new Set<Element>()
  for (const block of candidates) {
    let container = block.parentElement
    while (container && !blockContainers.has(container)) {
      blockContainers.add(container)
      if (container instanceof HTMLElement && candidates.has(container)) {
        nestedBlocks.add(container)
      }
      container = container.parentElement
    }
  }
  const blocks = [...candidates].filter((block) => !nestedBlocks.has(block))

  return {
    blocks,
    blockSet: new Set(blocks),
    blockContainers,
  }
}
