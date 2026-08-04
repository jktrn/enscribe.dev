export type FontChoice = {
  readonly id: string
  readonly label: string
  readonly stack: string
  readonly family: string | null
  readonly kind: "static" | "variable"
  readonly origin: string
}

export const FONTS: readonly FontChoice[] = [
  {
    id: "md-lorien",
    label: "MD Lorien",
    stack: '"MD Lorien", Georgia, serif',
    family: '"MD Lorien"',
    kind: "static",
    origin: "bundled serif, no width axis",
  },
  {
    id: "eb-garamond",
    label: "EB Garamond",
    stack: '"EB Garamond", Georgia, serif',
    family: '"EB Garamond"',
    kind: "static",
    origin: "bundled serif, no width axis",
  },
  {
    id: "ibm-plex-sans",
    label: "IBM Plex Sans",
    stack: '"IBM Plex Sans", system-ui, sans-serif',
    family: '"IBM Plex Sans"',
    kind: "variable",
    origin: "bundled variable, wdth axis",
  },
  {
    id: "roboto-flex",
    label: "Roboto Flex",
    stack: '"Roboto Flex", system-ui, sans-serif',
    family: '"Roboto Flex"',
    kind: "variable",
    origin: "bundled variable, wdth axis",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    stack: '"IBM Plex Mono", ui-monospace, monospace',
    family: '"IBM Plex Mono"',
    kind: "static",
    origin: "bundled monospace, no width axis",
  },
  {
    id: "system-serif",
    label: "System serif",
    stack: 'ui-serif, Georgia, "Times New Roman", serif',
    family: null,
    kind: "static",
    origin: "installed serif, width axis unlikely",
  },
  {
    id: "system-sans",
    label: "System sans",
    stack: "system-ui, -apple-system, sans-serif",
    family: null,
    kind: "static",
    origin: "installed sans, width axis unlikely",
  },
  {
    id: "system-mono",
    label: "System mono",
    stack: 'ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace',
    family: null,
    kind: "static",
    origin: "installed monospace, width axis unlikely",
  },
]

export const fontById = (id: string): FontChoice =>
  FONTS.find((font) => font.id === id) ?? (FONTS[0] as FontChoice)

const SPECIMEN = "Hamburgefonstiv the quick brown fox, 0123456789"

const probes = new Map<string, number>()

const measureAt = (probe: HTMLElement, percent: number) => {
  probe.style.fontStretch = `${percent}%`
  return probe.getBoundingClientRect().width
}

export const widthAxisResponse = (stack: string, size: number) => {
  const key = `${size}|${stack}`
  const cached = probes.get(key)
  if (cached !== undefined) return cached

  const probe = document.createElement("span")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText =
    "position:absolute;top:-9999px;left:0;visibility:hidden;white-space:pre"
  probe.style.font = `${size}px ${stack}`
  probe.textContent = SPECIMEN
  document.body.append(probe)

  const base = measureAt(probe, 100)
  const wider = measureAt(probe, 102)
  const narrower = measureAt(probe, 98)
  probe.remove()

  const response = base > 0 ? Math.max(wider - base, base - narrower) / base : 0
  probes.set(key, response)
  return response
}

export const loadFont = async (font: FontChoice, size: number) => {
  if (font.family === null || !document.fonts) return
  await document.fonts.load(`${size}px ${font.family}`, SPECIMEN)
}
