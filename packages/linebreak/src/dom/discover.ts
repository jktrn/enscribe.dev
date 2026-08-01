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
  skip?: string
  filter?: (element: HTMLElement) => boolean
}

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
