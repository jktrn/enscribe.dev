import type { ExtractedBlock, InlineItem, WrapperInfo } from "./extract"

const correspondingElements = (source: Element, clone: Element) => {
  const elements = new Map<Element, Element>()
  const sourceWalker = source.ownerDocument.createTreeWalker(
    source,
    NodeFilter.SHOW_ELEMENT,
  )
  const cloneWalker = clone.ownerDocument.createTreeWalker(
    clone,
    NodeFilter.SHOW_ELEMENT,
  )

  let sourceElement: Element | null = source
  let cloneElement: Element | null = clone
  while (sourceElement && cloneElement) {
    elements.set(sourceElement, cloneElement)
    sourceElement = sourceWalker.nextNode() as Element | null
    cloneElement = cloneWalker.nextNode() as Element | null
  }

  if (sourceElement || cloneElement) {
    throw new Error("Cloned block has a different element structure")
  }
  return elements
}

const clonedElement = <ElementType extends Element>(
  elements: Map<Element, Element>,
  source: ElementType,
) => {
  const clone = elements.get(source)
  if (!clone) throw new Error("Extracted element is outside its block")
  return clone as ElementType
}

const cloneItem = <Item extends InlineItem>(
  item: Item,
  elements: Map<Element, Element>,
): Item =>
  ({
    ...item,
    sourceElement: clonedElement(elements, item.sourceElement),
    wrappers: item.wrappers.map((wrapper) => clonedElement(elements, wrapper)),
  }) as Item

const cloneWrapperInfo = (
  info: WrapperInfo,
  elements: Map<Element, Element>,
): WrapperInfo => ({
  ...info,
  leading: {
    ...info.leading,
    nodes: info.leading.nodes.map((node) => clonedElement(elements, node)),
  },
  trailing: {
    ...info.trailing,
    nodes: info.trailing.nodes.map((node) => clonedElement(elements, node)),
  },
})

export const createBlockTemplate = (
  block: HTMLElement,
  extracted: ExtractedBlock,
) => {
  const root = block.cloneNode(true) as HTMLElement
  const elements = correspondingElements(block, root)
  return {
    root,
    extracted: {
      ...extracted,
      items: extracted.items.map((item) => cloneItem(item, elements)),
      wrappers: new Map(
        [...extracted.wrappers].map(([wrapper, info]) => [
          clonedElement(elements, wrapper),
          cloneWrapperInfo(info, elements),
        ]),
      ),
    },
  }
}
