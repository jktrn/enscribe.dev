import { cssPixels } from "./styles"

export type TextMetrics = {
  font: string
  letterSpacing: number
  requiresExactWidth: (text: string) => boolean
}

export const computedFont = (style: CSSStyleDeclaration) =>
  style.font ||
  `${[style.fontStyle, style.fontWeight, style.fontSize]
    .filter(Boolean)
    .join(" ")} ${style.fontFamily}`

const parseLetterSpacing = (style: CSSStyleDeclaration) =>
  cssPixels(style.letterSpacing)

const isCustom = (value: string) => value !== "" && value !== "normal"

export const readTextMetrics = (style: CSSStyleDeclaration): TextMetrics => {
  const everyRun =
    isCustom(style.fontFeatureSettings) ||
    isCustom(style.fontVariationSettings) ||
    (style.fontSizeAdjust !== "" && style.fontSizeAdjust !== "none") ||
    (style.textTransform !== "" && style.textTransform !== "none") ||
    (Number.parseFloat(style.wordSpacing) || 0) !== 0 ||
    isCustom(style.fontVariantEastAsian)
  const letters = isCustom(style.fontVariantCaps)
  const numbers = isCustom(style.fontVariantNumeric)
  const emoji = isCustom(style.getPropertyValue("font-variant-emoji"))

  return {
    font: computedFont(style),
    letterSpacing: parseLetterSpacing(style),
    requiresExactWidth: everyRun
      ? () => true
      : (text) =>
          (letters && /\p{L}/u.test(text)) ||
          (numbers && /\p{N}/u.test(text)) ||
          (emoji && /\p{Extended_Pictographic}/u.test(text)),
  }
}
