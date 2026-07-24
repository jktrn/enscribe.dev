import type { PreparedParagraph } from "../layout/line-model"
import { computedFont } from "./typography"

type MeasuredSlice = {
  end: number
  index: number
  start: number
}

export type ExactTextRun = {
  hyphenIndexes: number[]
  slices: MeasuredSlice[]
  sourceElement: HTMLElement
  text: string
}

export type ExactTextSegment = {
  index: number
  style: ExactTextStyle
  target: "width" | "discretionary-hyphen"
  text: string
}

export type ExactTextCache = Map<string, number>

export type ExactTextStyle = {
  cacheKey: string
  declarations: ReturnType<typeof probeTypography>
  language: string
  ownerDocument: Document
}

const probeTypography = (style: CSSStyleDeclaration) => ({
  font: computedFont(style),
  fontFeatureSettings: style.fontFeatureSettings,
  fontKerning: style.fontKerning,
  fontOpticalSizing: style.fontOpticalSizing,
  fontSizeAdjust: style.fontSizeAdjust,
  fontStretch: style.fontStretch,
  fontVariant: style.fontVariant,
  fontVariationSettings: style.fontVariationSettings,
  letterSpacing: style.letterSpacing,
  textRendering: style.textRendering,
  textTransform: style.textTransform,
  wordSpacing: style.wordSpacing,
})

export const exactTextStyle = (
  sourceElement: HTMLElement,
  style: CSSStyleDeclaration,
): ExactTextStyle => {
  const declarations = probeTypography(style)
  const language =
    sourceElement.closest<HTMLElement>("[lang]")?.lang ||
    sourceElement.ownerDocument.documentElement.lang
  return {
    cacheKey: `${language}\u0000${JSON.stringify(declarations)}`,
    declarations,
    language,
    ownerDocument: sourceElement.ownerDocument,
  }
}

type PendingSegment = {
  jobs: ExactTextSegment[]
  probe: HTMLSpanElement
}

type PendingTypography = {
  container: HTMLSpanElement
  segments: Map<string, PendingSegment>
}

const probe = (ownerDocument: Document, text: string) => {
  const element = ownerDocument.createElement("span")
  element.style.display = "inline-block"
  element.style.margin = "0"
  element.style.padding = "0"
  element.style.border = "0"
  element.style.whiteSpace = "pre"
  element.textContent = text
  return element
}

export const measureExactSegments = (
  paragraph: PreparedParagraph,
  segments: ExactTextSegment[],
  cache: ExactTextCache,
) => {
  const pending = new Map<string, PendingTypography>()
  for (const segment of segments) {
    const key = `${segment.style.cacheKey}\u0000${segment.text}`
    const cached = cache.get(key)
    if (cached !== undefined) {
      const prepared = paragraph.segments[segment.index]
      if (segment.target === "width") prepared.width = cached
      else prepared.discretionaryHyphenWidth = cached
      continue
    }
    let typography = pending.get(segment.style.cacheKey)
    if (!typography) {
      const container = segment.style.ownerDocument.createElement("span")
      Object.assign(container.style, segment.style.declarations, {
        display: "block",
      })
      container.lang = segment.style.language
      typography = { container, segments: new Map() }
      pending.set(segment.style.cacheKey, typography)
    }
    const existing = typography.segments.get(segment.text)
    if (existing) {
      existing.jobs.push(segment)
      continue
    }

    const element = probe(segment.style.ownerDocument, segment.text)
    typography.container.appendChild(element)
    typography.segments.set(segment.text, { jobs: [segment], probe: element })
  }
  if (pending.size === 0) return

  const ownerDocument = segments[0].style.ownerDocument
  const host = ownerDocument.createElement("span")
  host.setAttribute("aria-hidden", "true")
  Object.assign(host.style, {
    contain: "layout style paint",
    display: "block",
    inlineSize: "max-content",
    insetBlockStart: "0",
    insetInlineStart: "-100000px",
    pointerEvents: "none",
    position: "fixed",
    visibility: "hidden",
    whiteSpace: "nowrap",
  })
  host.append(...[...pending.values()].map(({ container }) => container))

  try {
    ownerDocument.body.appendChild(host)
    for (const [styleKey, typography] of pending) {
      for (const [text, { jobs, probe }] of typography.segments) {
        const width = probe.getBoundingClientRect().width
        cache.set(`${styleKey}\u0000${text}`, width)
        for (const job of jobs) {
          const segment = paragraph.segments[job.index]
          if (job.target === "width") segment.width = width
          else segment.discretionaryHyphenWidth = width
        }
      }
    }
  } finally {
    host.remove()
  }
}

type PendingRun = {
  probe: HTMLSpanElement
  runs: ExactTextRun[]
}

type MeasurementHost = {
  add: (run: ExactTextRun) => void
  element: HTMLSpanElement
  hyphenIndexes: number[]
  hyphenProbe: HTMLSpanElement
  pendingByText: Map<string, PendingRun>
}

const createHost = (sourceElement: HTMLElement): MeasurementHost => {
  const ownerDocument = sourceElement.ownerDocument
  const element = ownerDocument.createElement("span")
  element.dataset.kpMeasurement = ""
  element.setAttribute("aria-hidden", "true")
  for (const [property, value] of Object.entries({
    all: "inherit",
    position: "fixed",
    "inset-inline-start": "-100000px",
    "inset-block-start": "0",
    display: "block",
    "inline-size": "max-content",
    "block-size": "auto",
    margin: "0",
    padding: "0",
    border: "0",
    "white-space": "nowrap",
    visibility: "hidden",
    "pointer-events": "none",
    contain: "layout style paint",
  })) {
    element.style.setProperty(property, value, "important")
  }

  const root = element.attachShadow({ mode: "closed" })
  const hyphenProbe = probe(ownerDocument, "-")
  const hyphenIndexes: number[] = []
  const pendingByText = new Map<string, PendingRun>()
  root.appendChild(hyphenProbe)

  return {
    element,
    hyphenIndexes,
    hyphenProbe,
    pendingByText,
    add(run) {
      hyphenIndexes.push(...run.hyphenIndexes)
      const existing = pendingByText.get(run.text)
      if (existing) {
        existing.runs.push(run)
        return
      }

      const measurement = {
        probe: probe(ownerDocument, run.text),
        runs: [run],
      }
      pendingByText.set(run.text, measurement)
      root.appendChild(measurement.probe)
    },
  }
}

const prefixWidths = (pending: PendingRun) => {
  const text = pending.probe.firstChild
  if (text?.nodeType !== Node.TEXT_NODE) return null

  const boundaries = new Set([0])
  for (const run of pending.runs) {
    for (const slice of run.slices) {
      boundaries.add(slice.start)
      boundaries.add(slice.end)
    }
  }

  const widths = new Map([[0, 0]])
  const range = pending.probe.ownerDocument.createRange()
  for (const boundary of [...boundaries].sort((left, right) => left - right)) {
    if (boundary === 0) continue
    range.setStart(text, 0)
    range.setEnd(text, boundary)
    widths.set(boundary, range.getBoundingClientRect().width)
  }
  return widths
}

export const measureExactText = (
  paragraph: PreparedParagraph,
  runs: ExactTextRun[],
) => {
  const hostsBySource = new Map<HTMLElement, MeasurementHost>()
  for (const run of runs) {
    let host = hostsBySource.get(run.sourceElement)
    if (!host) {
      host = createHost(run.sourceElement)
      hostsBySource.set(run.sourceElement, host)
    }
    host.add(run)
  }

  try {
    for (const [sourceElement, host] of hostsBySource) {
      sourceElement.appendChild(host.element)
    }
    for (const host of hostsBySource.values()) {
      const hyphenWidth = host.hyphenProbe.getBoundingClientRect().width
      for (const index of host.hyphenIndexes) {
        paragraph.segments[index].discretionaryHyphenWidth = hyphenWidth
      }
      for (const pending of host.pendingByText.values()) {
        const widths = prefixWidths(pending)
        if (!widths) throw new Error("Unable to measure an exact text run")
        for (const run of pending.runs) {
          for (const slice of run.slices) {
            const start = widths.get(slice.start)
            const end = widths.get(slice.end)
            if (start === undefined || end === undefined) {
              throw new Error("Unable to measure an exact text slice")
            }
            paragraph.segments[slice.index].width = end - start
          }
        }
      }
    }
  } finally {
    for (const host of hostsBySource.values()) host.element.remove()
  }
}
