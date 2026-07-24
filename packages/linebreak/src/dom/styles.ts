export type StyleReader = (element: Element) => CSSStyleDeclaration

export const cssPixels = (value: string) => Number.parseFloat(value) || 0

export const createStyleReader = (
  root: HTMLElement,
  rootStyle: CSSStyleDeclaration,
): StyleReader => {
  const styles = new Map<Element, CSSStyleDeclaration>()
  styles.set(root, rootStyle)

  return (element) => {
    let style = styles.get(element)
    if (!style) {
      style = getComputedStyle(element)
      styles.set(element, style)
    }
    return style
  }
}
