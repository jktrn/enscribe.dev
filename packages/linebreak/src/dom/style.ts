export type StyleReader = (element: Element) => CSSStyleDeclaration

export const cssPixels = (value: string) => Number.parseFloat(value) || 0

export const createStyleReader = (
  root: HTMLElement,
  rootStyle: CSSStyleDeclaration,
): StyleReader => {
  const styles = new Map<Element, CSSStyleDeclaration>([[root, rootStyle]])
  return (element) => {
    let style = styles.get(element)
    if (!style) {
      style = getComputedStyle(element)
      styles.set(element, style)
    }
    return style
  }
}

export const computedFont = (style: CSSStyleDeclaration) =>
  style.font ||
  `${[style.fontStyle, style.fontWeight, style.fontSize]
    .filter(Boolean)
    .join(" ")} ${style.fontFamily}`

const NEUTRAL_STRETCH: ReadonlySet<string> = new Set(["", "normal", "100%"])

const WIDTH_AXIS = /\bwdth\b/u

const authoredWidth = (style: CSSStyleDeclaration) => {
  if (!NEUTRAL_STRETCH.has(style.fontStretch)) return "font-stretch"
  if (WIDTH_AXIS.test(style.fontVariationSettings)) {
    return "font-variation-settings"
  }
  return null
}

export const unmodellableProperty = (style: CSSStyleDeclaration) => {
  if (style.textTransform !== "" && style.textTransform !== "none") {
    return "text-transform"
  }
  if (cssPixels(style.wordSpacing) !== 0) return "word-spacing"
  return authoredWidth(style)
}

export const uniformLetterSpacing = (
  elements: Iterable<Element>,
  read: StyleReader,
  spacing: number,
) => {
  for (const element of elements) {
    if (cssPixels(read(element).letterSpacing) !== spacing) return false
  }
  return true
}
