import { defineMdastPlugin } from "satteri"

const NUMBER_RANGE =
  /(?<![\d-])(\d{1,4}(?:\.\d+)?)-(\d{1,4}(?:\.\d+)?)(?![\d-])/g
const MINUS_SIGN = /(?<=^|[\s(["'“‘])-(?=\d)/g
const MULTIPLIER = /(?<=\b\d+(?:\.\d+)?)x\b/g

export const microTypography = defineMdastPlugin({
  name: "micro-typography",
  text(node) {
    if (node.value.includes("://") || node.value.startsWith("www.")) return

    const value = node.value
      .replace(NUMBER_RANGE, "$1–$2")
      .replace(MINUS_SIGN, "−")
      .replace(MULTIPLIER, "×")

    if (value === node.value) return
    return { ...node, value }
  },
})
