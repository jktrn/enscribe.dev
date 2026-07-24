import {
  prepareWithSegments as prepareWithPretext,
  setLocale as setPretextLocale,
  type PrepareOptions,
} from "@chenglou/pretext"
import type { PretextPreparationPhase, PretextPreparationStat } from "../types"

type PreparedBatch = {
  segments: string[]
  kinds: string[]
  widths: number[]
}

export const preparedBatchWidths = (
  prepared: PreparedBatch,
  expectedCount: number,
) => {
  if (
    prepared.segments.length !== prepared.kinds.length ||
    prepared.segments.length !== prepared.widths.length
  ) {
    return null
  }

  const widths: number[] = []
  let width = 0
  for (let index = 0; index < prepared.segments.length; index += 1) {
    if (prepared.kinds[index] === "hard-break") {
      widths.push(width)
      width = 0
    } else {
      width += prepared.widths[index]
    }
  }
  widths.push(width)
  return widths.length === expectedCount ? widths : null
}

const preparationStats = new Map<
  PretextPreparationPhase,
  PretextPreparationStat
>()

const benchmarkEnabled =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("kp-benchmark")

let activeLocale: string | undefined

export const configurePretextLocale = (locale?: string) => {
  const nextLocale = locale?.trim() || undefined
  if (nextLocale === activeLocale) return
  setPretextLocale(nextLocale)
  activeLocale = nextLocale
}

export const prepareWithSegments = (
  phase: PretextPreparationPhase,
  text: string,
  font: string,
  options?: PrepareOptions,
) => {
  if (!benchmarkEnabled) return prepareWithPretext(text, font, options)

  const started = performance.now()
  const prepared = prepareWithPretext(text, font, options)
  const elapsed = performance.now() - started
  const stat = preparationStats.get(phase) ?? {
    calls: 0,
    characters: 0,
    milliseconds: 0,
  }
  stat.calls += 1
  stat.characters += text.length
  stat.milliseconds += elapsed
  preparationStats.set(phase, stat)
  return prepared
}

export const measureTextBatch = (
  texts: string[],
  font: string,
  letterSpacing: number,
) => {
  if (texts.length === 0 || texts.some((text) => text.includes("\n"))) {
    return null
  }
  const prepared = prepareWithSegments("styled-batch", texts.join("\n"), font, {
    letterSpacing,
    whiteSpace: "pre-wrap",
  })
  const widths = preparedBatchWidths(prepared, texts.length)
  return widths
    ? { widths, discretionaryHyphenWidth: prepared.discretionaryHyphenWidth }
    : null
}

export const readPretextPreparationStats = () =>
  Object.fromEntries(
    [...preparationStats].map(([phase, stat]) => [phase, { ...stat }]),
  ) as Partial<Record<PretextPreparationPhase, PretextPreparationStat>>
