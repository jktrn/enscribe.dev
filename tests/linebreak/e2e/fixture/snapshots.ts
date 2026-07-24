import {
  cleanCopiedLinebreaks,
  type LinebreakResult,
} from "@enscribe/linebreak"
import { elements } from "./state"

export const resultSnapshot = ({
  lineCount,
  reason,
  state,
}: LinebreakResult) => ({ lineCount, reason, state })

export const ownerSnapshot = (element: HTMLElement) => ({
  html: element.innerHTML,
  lineCount: Number(element.dataset.kpLines ?? 0),
  overflow: element.scrollWidth - element.clientWidth,
  typeset: element.hasAttribute("data-kp-justified"),
  wrappedLines: [
    ...element.querySelectorAll<HTMLElement>(":scope > .kp-line"),
  ].filter((line) => {
    const lineHeight = Number.parseFloat(getComputedStyle(line).lineHeight)
    return line.getBoundingClientRect().height > lineHeight + 1
  }).length,
})

export const maximumLineResidual = (element: HTMLElement) => {
  const width = element.clientWidth
  const residuals = [
    ...element.querySelectorAll<HTMLElement>(
      ":scope > .kp-line:not(.kp-final-line)",
    ),
  ].map((line) => {
    const range = document.createRange()
    range.selectNodeContents(line)
    return Math.abs(width - range.getBoundingClientRect().width)
  })
  return Math.max(0, ...residuals)
}

const projectedRowPitch = (element: HTMLElement) => {
  const lines = [...element.querySelectorAll<HTMLElement>(":scope > .kp-line")]
  return lines.length > 1
    ? lines[1].getBoundingClientRect().top -
        lines[0].getBoundingClientRect().top
    : 0
}

export const geometrySnapshot = () => ({
  computedLineHeight: getComputedStyle(elements.geometry).lineHeight,
  nativeLineHeight: getComputedStyle(elements.geometryNative).lineHeight,
  nativePitch: Number.parseFloat(
    getComputedStyle(elements.geometryNative).lineHeight,
  ),
  projectedPitch: projectedRowPitch(elements.geometry),
  maximumResidual: maximumLineResidual(elements.geometry),
  ...ownerSnapshot(elements.geometry),
})

export const copyHyphenated = () => {
  const selection = getSelection()
  selection?.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(elements.hyphen)
  selection?.addRange(range)
  const clipboardData = new DataTransfer()
  cleanCopiedLinebreaks({
    clipboardData,
    preventDefault() {},
  } as unknown as ClipboardEvent)
  selection?.removeAllRanges()
  return {
    html: clipboardData.getData("text/html"),
    text: clipboardData.getData("text/plain"),
  }
}
