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

const NEUTRAL_VALUE: ReadonlySet<string> = new Set(["", "normal", "100%"])

const VARIANT_PROPERTIES = [
  "fontVariantAlternates",
  "fontVariantCaps",
  "fontVariantEastAsian",
  "fontVariantLigatures",
  "fontVariantNumeric",
  "fontVariantPosition",
  "fontFeatureSettings",
] as const

const PROBE_PROPERTIES = [
  "fontStretch",
  "fontVariationSettings",
  ...VARIANT_PROPERTIES,
] as const

export type ProbeStyle = readonly (readonly [
  (typeof PROBE_PROPERTIES)[number],
  string,
])[]

export const usesVariant = (style: CSSStyleDeclaration) =>
  VARIANT_PROPERTIES.some((property) => !NEUTRAL_VALUE.has(style[property]))

export const probeStyle = (style: CSSStyleDeclaration): ProbeStyle =>
  PROBE_PROPERTIES.map((property) => [property, style[property]] as const)

export const variantKey = (style: CSSStyleDeclaration) => {
  let key = ""
  for (const property of PROBE_PROPERTIES) {
    const value = style[property]
    if (!NEUTRAL_VALUE.has(value)) key += `${property}:${value};`
  }
  return key
}

const WIDTH_AXIS = /\bwdth\b/u

const authoredWidth = (style: CSSStyleDeclaration) => {
  if (!NEUTRAL_VALUE.has(style.fontStretch)) return "font-stretch"
  if (WIDTH_AXIS.test(style.fontVariationSettings)) {
    return "font-variation-settings"
  }
  return null
}

const INDENT_KEYWORD = /\b(?:hanging|each-line)\b/u

export const indentsSomeOtherLine = (style: CSSStyleDeclaration) =>
  INDENT_KEYWORD.test(style.textIndent)

export const firstLineIndent = (
  style: CSSStyleDeclaration,
  contentWidth: number,
) => {
  const value = style.textIndent
  if (value.endsWith("%")) {
    return (Number.parseFloat(value) / 100 || 0) * contentWidth
  }
  return cssPixels(value)
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
