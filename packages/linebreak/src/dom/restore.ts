import { preserveImageAttributes } from "./render"

export const restoreAuthoredContent = (
  element: HTMLElement,
  original: HTMLElement,
  preservedImageAttributes: readonly string[],
) => {
  const restored = document.createDocumentFragment()
  for (const node of original.childNodes) {
    restored.appendChild(node.cloneNode(true))
  }
  preserveImageAttributes(element, restored, preservedImageAttributes)
  element.replaceChildren(restored)
  delete element.dataset.kpJustified
  delete element.dataset.kpLines
}
