import { defaultLayoutPolicy } from "../layout/default-policy"
import type { OptimizedLine } from "../layout/line-model"
import type { ExtractedBlock } from "./extract"
import type { AuthoredSpacing } from "./spacing"
import { cssPixels } from "./styles"

export type BlockPlan = {
  element: HTMLElement
  extracted: ExtractedBlock
  lines: OptimizedLine[]
  width: number
  authoredSpacing: AuthoredSpacing
}

export type RenderedLineMeasurement = {
  span: HTMLElement
  line: OptimizedLine
  deficit: number
}

const LINE_CORRECTION_TOLERANCE = 0.25

export const contentWidth = (block: HTMLElement, style: CSSStyleDeclaration) =>
  block.clientWidth -
  Number.parseFloat(style.paddingInlineStart || "0") -
  Number.parseFloat(style.paddingInlineEnd || "0")

const validateLineElements = (
  plan: BlockPlan,
  lineElements: readonly HTMLElement[],
) => {
  const { childNodes } = plan.element
  const expectedNodes = Math.max(0, plan.lines.length * 2 - 1)
  if (
    lineElements.length !== plan.lines.length ||
    childNodes.length !== expectedNodes
  ) {
    throw new Error("Rendered lines no longer match their paragraph")
  }

  for (let index = 0; index < lineElements.length; index += 1) {
    const line = lineElements[index]
    const isFinal = index === lineElements.length - 1
    if (
      childNodes[index * 2] !== line ||
      !line.classList.contains("kp-line") ||
      line.classList.contains("kp-final-line") !== isFinal
    ) {
      throw new Error("Rendered lines no longer match their paragraph")
    }

    if (isFinal) continue
    const lineBreak = childNodes[index * 2 + 1]
    if (
      lineBreak?.nodeName !== "BR" ||
      !(lineBreak as HTMLElement).classList.contains("kp-break")
    ) {
      throw new Error("Rendered lines no longer match their paragraph")
    }
  }
}

export const measureGeneratedLines = (
  plan: BlockPlan,
  lineElements: readonly HTMLElement[],
) => {
  validateLineElements(plan, lineElements)
  const tops = new Set<number>()
  let hasWrappedLine = false

  for (const line of lineElements) {
    const rect = line.getBoundingClientRect()
    tops.add(Math.round(rect.top * 2) / 2)
    if (!hasWrappedLine) {
      const lineHeight = Number.parseFloat(getComputedStyle(line).lineHeight)
      hasWrappedLine =
        Number.isFinite(lineHeight) && rect.height > lineHeight + 1
    }
  }

  return { hasWrappedLine, visualLineCount: tops.size }
}

export const measureRenderedLines = (
  plan: BlockPlan,
  lineElements: readonly HTMLElement[],
): RenderedLineMeasurement[] => {
  validateLineElements(plan, lineElements)
  const measurements: RenderedLineMeasurement[] = []
  const range = plan.element.ownerDocument.createRange()
  for (let index = 0; index < lineElements.length - 1; index += 1) {
    const line = plan.lines[index]
    if (line.spaceCount === 0 && line.naturalBreakCount === 0) continue
    const span = lineElements[index]
    range.selectNodeContents(span)
    const renderedWidth = range.getBoundingClientRect().width
    measurements.push({
      span,
      line,
      deficit: plan.width - renderedWidth,
    })
  }
  return measurements
}

export const correctionsFrom = (
  measurements: RenderedLineMeasurement[],
): RenderedLineMeasurement[] =>
  measurements.filter(
    ({ deficit }) => Math.abs(deficit) > LINE_CORRECTION_TOLERANCE,
  )

export const applyLineCorrection = ({
  span,
  line,
  deficit,
}: RenderedLineMeasurement) => {
  let remaining = deficit
  const currentWordSpacing = cssPixels(
    span.style.getPropertyValue("--kp-word-spacing-delta"),
  )
  const currentLetterSpacing = cssPixels(
    span.style.getPropertyValue("--kp-letter-spacing-delta"),
  )
  if (line.spaceCount > 0) {
    const naturalSpaceWidth = line.spaceWidth / line.spaceCount
    const minimum = naturalSpaceWidth * defaultLayoutPolicy.wordSpacing.shrink
    const maximum = naturalSpaceWidth * defaultLayoutPolicy.wordSpacing.stretch
    const wordSpacing = Math.min(
      maximum,
      Math.max(minimum, currentWordSpacing + remaining / line.spaceCount),
    )
    span.style.setProperty("--kp-word-spacing-delta", `${wordSpacing}px`)
    remaining -= (wordSpacing - currentWordSpacing) * line.spaceCount
  }
  if (
    Math.abs(remaining) > 0.01 &&
    line.characterCount > 0 &&
    (line.spaceCount > 0 || line.naturalBreakCount > 0)
  ) {
    const letterSpacing = Math.min(
      line.trackingLimit,
      Math.max(
        -line.trackingLimit,
        currentLetterSpacing + remaining / line.characterCount,
      ),
    )
    span.style.setProperty("--kp-letter-spacing-delta", `${letterSpacing}px`)
    remaining -= (letterSpacing - currentLetterSpacing) * line.characterCount
  }
  return Math.abs(remaining) <= LINE_CORRECTION_TOLERANCE
}
