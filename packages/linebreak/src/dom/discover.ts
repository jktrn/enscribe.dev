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

type Discovery = {
  readonly skip: string
  readonly filter: ((element: HTMLElement) => boolean) | undefined
  readonly blocks: HTMLElement[]
}

const blockChildrenOf = (element: Element) => {
  const children: Element[] = []
  for (const child of element.children) {
    if (!isInlineLevel(child)) children.push(child)
  }
  return children
}

const carriesProse = (
  element: Element,
  discovery: Discovery,
): element is HTMLElement => {
  if (!(element instanceof HTMLElement)) return false
  if (!(element.textContent ?? "").trim()) return false
  return !discovery.filter || discovery.filter(element)
}

const visitBlock = (element: Element, discovery: Discovery) => {
  if (element.matches(discovery.skip)) return

  const blockChildren = blockChildrenOf(element)
  if (blockChildren.length > 0) {
    for (const child of blockChildren) visitBlock(child, discovery)
    return
  }
  if (carriesProse(element, discovery)) discovery.blocks.push(element)
}

export const proseBlocks = (
  root: Element,
  options: DiscoverOptions = {},
): HTMLElement[] => {
  const discovery: Discovery = {
    skip: options.skip ? `${DEFAULT_SKIP}, ${options.skip}` : DEFAULT_SKIP,
    filter: options.filter,
    blocks: [],
  }

  visitBlock(root, discovery)
  return discovery.blocks
}
