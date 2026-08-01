/**
 * Content the engine cannot model, or that nobody wants justified. Pruning
 * here rather than letting `compose` decline saves a measurement per element
 * and keeps the outcome stream meaningful.
 */
export const DEFAULT_SKIP = [
  "[data-linebreak-skip]",
  "pre",
  "table",
  "svg",
  "math",
  "code",
  "kbd",
  "samp",
  "textarea, select, button, input",
  "script, style, template",
  "[contenteditable]",
].join(", ")

/**
 * Display values that participate in an inline formatting context, so an
 * element containing only these is a leaf block and therefore a paragraph.
 */
const INLINE_LEVEL = new Set([
  "contents",
  "math",
  "none",
  "ruby",
  "ruby-base",
  "ruby-base-container",
  "ruby-text",
  "ruby-text-container",
])

const isInlineLevel = (element: Element) => {
  const { display } = getComputedStyle(element)
  return display.startsWith("inline") || INLINE_LEVEL.has(display)
}

export type DiscoverOptions = {
  /** Added to {@link DEFAULT_SKIP}. Matching elements and their subtrees go. */
  skip?: string
  /** Final say per candidate. Return false to leave an element ragged. */
  filter?: (element: HTMLElement) => boolean
}

/**
 * Find the paragraphs under `root`.
 *
 * A paragraph is a "leaf block": an element with no block-level children and
 * some text. Computed `display` decides, not tag names, so a flex item that is
 * normally inline — a card title `<a>`, say — is correctly treated as a block.
 *
 * ```ts
 * const blocks = proseBlocks(article, { skip: ".no-justify" })
 * ```
 */
export const proseBlocks = (
  root: Element,
  options: DiscoverOptions = {},
): HTMLElement[] => {
  const skip = options.skip ? `${DEFAULT_SKIP}, ${options.skip}` : DEFAULT_SKIP
  const blocks: HTMLElement[] = []

  const visit = (element: Element) => {
    if (element.matches(skip)) return

    const blockChildren: Element[] = []
    for (const child of element.children) {
      if (!isInlineLevel(child)) blockChildren.push(child)
    }
    if (blockChildren.length > 0) {
      for (const child of blockChildren) visit(child)
      return
    }
    if (!(element instanceof HTMLElement)) return
    if (!(element.textContent ?? "").trim()) return
    if (options.filter && !options.filter(element)) return
    blocks.push(element)
  }

  visit(root)
  return blocks
}
