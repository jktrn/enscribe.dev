import type { ColumnMetrics, Gap, LineGeometry } from "./metrics"
import type { State } from "./state"

const TINT_FLOOR = 0.06
const TINT_SPAN = Math.log(2)

const gapMark = (gap: Gap, origin: DOMRect) => {
  const ratio = gap.width / gap.natural
  const intensity = Math.min(1, Math.abs(Math.log(ratio)) / TINT_SPAN)
  const mark = document.createElement("div")
  mark.className = ratio >= 1 ? "gapmark loose" : "gapmark tight"
  mark.style.left = `${gap.left - origin.left}px`
  mark.style.top = `${gap.top - origin.top}px`
  mark.style.width = `${gap.width}px`
  mark.style.height = `${gap.bottom - gap.top}px`
  mark.style.opacity = `${intensity < TINT_FLOOR ? 0 : 0.12 + intensity * 0.55}`
  mark.title = `${Math.round(ratio * 100)}% of natural space`
  return mark
}

const lineBox = (line: LineGeometry, origin: DOMRect) => {
  const box = document.createElement("div")
  box.className = "linebox"
  box.style.left = `${line.left - origin.left}px`
  box.style.top = `${line.top - origin.top}px`
  box.style.width = `${line.right - line.left}px`
  box.style.height = `${line.bottom - line.top}px`

  const label = document.createElement("span")
  label.textContent = Number.isFinite(line.ratio)
    ? `r ${line.ratio.toFixed(2)}`
    : "rigid"
  box.append(label)
  return box
}

export const paintOverlay = (
  overlay: HTMLElement,
  metrics: ColumnMetrics,
  state: State,
) => {
  overlay.replaceChildren()
  if (!state.tint && !state.boxes) return

  const origin = overlay.getBoundingClientRect()
  const nodes: HTMLElement[] = []
  for (const para of metrics.paragraphs) {
    for (const line of para.lines) {
      if (state.boxes) nodes.push(lineBox(line, origin))
      if (!state.tint) continue
      for (const gap of line.gaps) nodes.push(gapMark(gap, origin))
    }
  }
  overlay.append(...nodes)
}
