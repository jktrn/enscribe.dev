import { fontById } from "./fonts"
import type { Triple } from "./scoring"
import type { State, SweepAxis } from "./state"
import { effectiveState, type Surface, typesetSurface } from "./typeset"
import { yieldToUi } from "./schedule"

export type SweepPoint = {
  readonly value: number
  readonly columns: Triple
}

export type SweepSpec = {
  readonly label: string
  readonly unit: string
  readonly min: number
  readonly max: number
  readonly steps: readonly number[]
}

export const SWEEPS: Record<SweepAxis, SweepSpec> = {
  measure: {
    label: "measure",
    unit: "px",
    min: 240,
    max: 900,
    steps: [40, 20, 10],
  },
  size: {
    label: "font size",
    unit: "px",
    min: 13,
    max: 24,
    steps: [2, 1, 0.5],
  },
}

export const defaultStep = (axis: SweepAxis) => SWEEPS[axis].steps[1] as number

export const stepsFor = (axis: SweepAxis, step: number) => {
  const { min, max } = SWEEPS[axis]
  const values: number[] = []
  for (let value = min; value <= max + 1e-9; value += step) {
    values.push(Number(value.toFixed(4)))
  }
  return values
}

export const cacheKey = (axis: SweepAxis, step: number, state: State) =>
  JSON.stringify([
    axis,
    step,
    state.sample,
    state.font,
    state.hyphenate,
    state.protrude,
    state.expand,
    state.track,
    state.lastLineMinWidth,
    state.indent,
    state.hang,
    axis === "measure" ? state.size : state.measure,
  ])

const cache = new Map<string, SweepPoint[]>()

export const cached = (axis: SweepAxis, step: number, state: State) =>
  cache.get(cacheKey(axis, step, state))

export const runSweep = async (options: {
  readonly axis: SweepAxis
  readonly step: number
  readonly state: State
  readonly host: HTMLElement
  readonly surface: Surface
  readonly signal: AbortSignal
  readonly onPoint: (point: SweepPoint, done: number, total: number) => void
}) => {
  const { axis, step, state, host, surface, signal, onPoint } = options
  const values = stepsFor(axis, step)
  const points: SweepPoint[] = []

  host.style.setProperty("--family", fontById(state.font).stack)
  host.style.setProperty("--indent", `${state.indent}em`)

  for (const [index, value] of values.entries()) {
    if (signal.aborted) return points
    const at: State = { ...state, [axis]: value }
    host.style.setProperty("--measure", `${at.measure}px`)
    host.style.setProperty("--size", `${at.size}px`)
    host.style.setProperty(
      "--column",
      `calc(${at.measure}px + 2 * var(--hang))`,
    )

    const { columns } = await typesetSurface(surface, effectiveState(at))
    if (signal.aborted) return points

    const point: SweepPoint = { value, columns }
    points.push(point)
    onPoint(point, index + 1, values.length)
    await yieldToUi()
  }

  cache.set(cacheKey(axis, step, state), points)
  return points
}
