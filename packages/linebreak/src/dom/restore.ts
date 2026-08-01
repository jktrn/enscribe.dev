import { preserveImageAttributes, TYPESET_ATTRIBUTE } from "./render"

export type AuthoredContent = DocumentFragment

export const authoredText = (element: { textContent: string | null }) =>
  (element.textContent ?? "").replace(/\s+/gu, " ").trim()

export const captureAuthored = (element: HTMLElement): AuthoredContent => {
  const fragment = element.ownerDocument.createDocumentFragment()
  for (const child of element.childNodes) {
    fragment.appendChild(child.cloneNode(true))
  }
  return fragment
}

export const restoreAuthored = (
  element: HTMLElement,
  authored: AuthoredContent,
  preservedImageAttributes: readonly string[],
) => {
  if (!element.hasAttribute(TYPESET_ATTRIBUTE)) return
  const restored = authored.cloneNode(true) as DocumentFragment
  preserveImageAttributes(element, restored, preservedImageAttributes)
  element.replaceChildren(restored)
  element.removeAttribute(TYPESET_ATTRIBUTE)
}
