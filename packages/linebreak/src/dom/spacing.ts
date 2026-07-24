export type AuthoredSpacing = {
  readonly letterSpacing: string
  readonly wordSpacing: string
}

const additiveSpacing = (value: string) =>
  value === "normal" || value === "" ? "0px" : value

export const readAuthoredSpacing = (
  style: CSSStyleDeclaration,
): AuthoredSpacing => ({
  letterSpacing: additiveSpacing(style.letterSpacing),
  wordSpacing: additiveSpacing(style.wordSpacing),
})
