import { runJustif, runLinebreak, type ParagraphOutcome } from "./engines"
import { fontById, FONTS, loadFont, widthAxisResponse } from "./fonts"
import { type ColumnMetrics, measureColumn } from "./metrics"
import { paintOverlay } from "./overlays"
import { renderAsymmetries, renderMetrics, type Triple } from "./report"
import { SAMPLES } from "./samples"
import {
  DEFAULT_STATE,
  type EngineId,
  loadState,
  saveState,
  type State,
} from "./state"

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

const column = (engine: EngineId) =>
  document.querySelector(`.column[data-engine="${engine}"]`) as HTMLElement

const roleOf = (engine: EngineId, role: string) =>
  column(engine).querySelector(`[data-role="${role}"]`) as HTMLElement

const ENGINES: readonly EngineId[] = ["browser", "linebreak", "justif"]
const AXIS_FLOOR = 0.001

let state = loadState()
let generation = 0

const fillSelect = (
  select: HTMLSelectElement,
  entries: readonly { value: string; label: string }[],
) => {
  select.replaceChildren()
  for (const entry of entries) {
    const option = document.createElement("option")
    option.value = entry.value
    option.textContent = entry.label
    select.append(option)
  }
}

const populate = () => {
  fillSelect(
    element<HTMLSelectElement>("sample"),
    SAMPLES.map((sample) => ({ value: sample.id, label: sample.label })),
  )
  fillSelect(
    element<HTMLSelectElement>("font"),
    FONTS.map((font) => ({
      value: font.id,
      label: `${font.label} — ${font.kind}`,
    })),
  )
}

const writeControls = () => {
  element<HTMLSelectElement>("sample").value = state.sample
  element<HTMLSelectElement>("font").value = state.font
  element<HTMLInputElement>("measure").value = String(state.measure)
  element<HTMLInputElement>("size").value = String(state.size)
  element<HTMLInputElement>("hyphenate").checked = state.hyphenate
  element<HTMLInputElement>("protrude").checked = state.protrude
  element<HTMLInputElement>("expand").checked = state.expand
  element<HTMLInputElement>("track").checked = state.track
  element<HTMLInputElement>("lastline").value = String(state.lastLineMinWidth)
  element<HTMLInputElement>("indent").value = String(state.indent)
  element<HTMLSelectElement>("hang").value = state.hang
  element<HTMLSelectElement>("single-engine").value = state.single
  element<HTMLInputElement>("rulers").checked = state.rulers
  element<HTMLInputElement>("tint").checked = state.tint
  element<HTMLInputElement>("boxes").checked = state.boxes
}

const writeReadouts = () => {
  element("measure-out").textContent = `${state.measure}px`
  element("size-out").textContent = `${state.size}px`
  element("lastline-out").textContent = state.lastLineMinWidth.toFixed(2)
  element("indent-out").textContent = `${state.indent}em`
  const sample = SAMPLES.find((entry) => entry.id === state.sample)
  element("sample-note").textContent = sample?.note ?? ""
  element("font-note").textContent = fontById(state.font).origin
}

const writeShell = () => {
  const root = document.documentElement
  const font = fontById(state.font)
  root.dataset.theme = state.theme
  root.style.setProperty("--measure", `${state.measure}px`)
  root.style.setProperty("--size", `${state.size}px`)
  root.style.setProperty("--indent", `${state.indent}em`)
  root.style.setProperty("--family", font.stack)
  document.body.classList.toggle("rulers", state.rulers)
  document.body.classList.toggle("single", state.view === "single")

  const columns = element("columns")
  columns.dataset.view = state.view
  for (const engine of ENGINES) {
    column(engine).classList.toggle("solo", engine === state.single)
  }
  for (const button of document.querySelectorAll("[data-view-button]")) {
    const pressed = (button as HTMLElement).dataset.viewButton === state.view
    button.setAttribute("aria-pressed", String(pressed))
  }
  for (const button of document.querySelectorAll("[data-theme-button]")) {
    const pressed = (button as HTMLElement).dataset.themeButton === state.theme
    button.setAttribute("aria-pressed", String(pressed))
  }
}

const nativeHyphens = () => {
  const targets = [
    roleOf("browser", "typeset"),
    roleOf("linebreak", "native"),
    roleOf("justif", "native"),
  ]
  for (const target of targets) {
    target.style.hyphens = state.hyphenate ? "auto" : "none"
    target.style.setProperty(
      "-webkit-hyphens",
      state.hyphenate ? "auto" : "none",
    )
    target.style.setProperty("hyphenate-limit-chars", "5 2 3")
  }
}

const fillArticles = () => {
  const sample = SAMPLES.find((entry) => entry.id === state.sample)
  const html = sample?.html ?? ""
  for (const engine of ENGINES) {
    roleOf(engine, "typeset").innerHTML = html
    const native = column(engine).querySelector('[data-role="native"]')
    if (native) native.innerHTML = html
  }
  nativeHyphens()
}

const renderOutcomes = (engine: EngineId, outcomes: ParagraphOutcome[]) => {
  const host = roleOf(engine, "outcomes")
  host.replaceChildren()
  for (const outcome of outcomes) {
    const line = document.createElement("div")
    line.className = "outcome"
    const label = document.createElement("b")
    label.textContent = `¶${outcome.index + 1} ${outcome.status}`
    line.append(label, ` ${outcome.reason}`)
    host.append(line)
  }
}

const syncExpansion = (response: number) => {
  const control = element<HTMLInputElement>("expand")
  const reason = element("expand-reason")
  const available = response >= AXIS_FLOOR
  control.disabled = !available
  reason.textContent = available
    ? ""
    : `— ${fontById(state.font).label} has no usable wdth axis`
  return available && state.expand
}

const paragraphsOf = (engine: EngineId) => [
  ...roleOf(engine, "typeset").querySelectorAll("p"),
]

const measureAll = (): Triple => {
  const [browser, linebreak, justif] = ENGINES.map((engine) =>
    measureColumn(roleOf(engine, "typeset"), engine),
  ) as [ColumnMetrics, ColumnMetrics, ColumnMetrics]
  return [browser, linebreak, justif]
}

const paintAll = (columns: Triple) => {
  for (const [index, engine] of ENGINES.entries()) {
    paintOverlay(
      roleOf(engine, "overlay"),
      columns[index] as ColumnMetrics,
      state,
    )
  }
}

const render = async () => {
  const round = ++generation
  const font = fontById(state.font)
  writeReadouts()
  writeShell()
  await loadFont(font, state.size)
  if (round !== generation) return

  const response = widthAxisResponse(font.stack, state.size)
  const effective: State = { ...state, expand: syncExpansion(response) }
  fillArticles()

  renderOutcomes(
    "linebreak",
    runLinebreak(paragraphsOf("linebreak"), effective),
  )
  const declines = await runJustif(paragraphsOf("justif"), effective)
  if (round !== generation) return
  renderOutcomes("justif", declines)

  const columns = measureAll()
  renderMetrics(element<HTMLTableElement>("metrics"), columns)
  renderAsymmetries(element("asymmetries"), effective, response)
  paintAll(columns)
  saveState(state)
}

const schedule = (() => {
  let timer = 0
  return () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => void render(), 60)
  }
})()

const patch = (change: Partial<State>) => {
  state = { ...state, ...change }
  schedule()
}

const bindInputs = () => {
  const number = (
    id: string,
    key: "measure" | "size" | "lastLineMinWidth" | "indent",
  ) =>
    element<HTMLInputElement>(id).addEventListener("input", (event) => {
      patch({ [key]: Number((event.target as HTMLInputElement).value) })
    })
  number("measure", "measure")
  number("size", "size")
  number("lastline", "lastLineMinWidth")
  number("indent", "indent")

  const flag = (id: string, key: keyof State) =>
    element<HTMLInputElement>(id).addEventListener("change", (event) => {
      patch({ [key]: (event.target as HTMLInputElement).checked })
    })
  flag("hyphenate", "hyphenate")
  flag("protrude", "protrude")
  flag("expand", "expand")
  flag("track", "track")
  flag("rulers", "rulers")
  flag("tint", "tint")
  flag("boxes", "boxes")

  const choice = (id: string, key: keyof State) =>
    element<HTMLSelectElement>(id).addEventListener("change", (event) => {
      patch({ [key]: (event.target as HTMLSelectElement).value })
    })
  choice("sample", "sample")
  choice("font", "font")
  choice("hang", "hang")
  choice("single-engine", "single")
}

const bindButtons = () => {
  for (const button of document.querySelectorAll("[data-view-button]")) {
    button.addEventListener("click", () => {
      patch({
        view: (button as HTMLElement).dataset.viewButton as State["view"],
      })
    })
  }
  for (const button of document.querySelectorAll("[data-theme-button]")) {
    button.addEventListener("click", () => {
      patch({
        theme: (button as HTMLElement).dataset.themeButton as State["theme"],
      })
    })
  }
  element("reset").addEventListener("click", () => {
    state = { ...DEFAULT_STATE }
    writeControls()
    schedule()
  })
}

const bindFlicker = () => {
  const reveal = (on: boolean) =>
    document.body.classList.toggle("revealing", on)
  document.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest(".dock, .report")) return
    reveal(true)
  })
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    document.addEventListener(type, () => reveal(false))
  }
}

const bindResize = () => {
  let timer = 0
  addEventListener("resize", () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => void render(), 150)
  })
}

populate()
writeControls()
bindInputs()
bindButtons()
bindFlicker()
bindResize()
void render()
