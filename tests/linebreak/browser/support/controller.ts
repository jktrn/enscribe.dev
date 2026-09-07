import { vi } from "vitest"
import { createMetrics } from "@linebreak/text/segments"
import * as measurement from "@linebreak/dom/measure-dom"
import * as rendering from "@linebreak/dom/render"
import * as solver from "@linebreak/layout/breaker/prepared"

export const mockPreparedLayout = () => {
  const prepare = solver.prepareParagraph
  const solve = vi.fn(
    (
      original: solver.PreparedParagraph["breakParagraph"],
      width: number,
      options?: solver.PreparedLayoutOptions,
    ) => original(width, options),
  )
  vi.spyOn(solver, "prepareParagraph").mockImplementation((items, options) => {
    const prepared = prepare(items, options)
    return {
      ...prepared,
      breakParagraph: (width, settings) =>
        solve(prepared.breakParagraph, width, settings),
    }
  })
  return solve
}

export const PROSE =
  "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau."

export const browserFixture = () => {
  document.body.replaceChildren()
  document.documentElement.lang = "en-US"
  const style = document.createElement("style")
  style.textContent = `
    * { direction: ltr; writing-mode: horizontal-tb; font: 16px serif;
        line-height: 20px; white-space-collapse: collapse; text-wrap-mode: wrap;
        letter-spacing: 0px; text-transform: none; }
    p { display: block; width: 300px; }
    span, em, strong, a, code { display: inline; }
  `
  document.body.append(style)
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return Number.parseFloat(this.style.width) || 300
    },
  )
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.clientWidth
    },
  )
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const lines = [
        ...(this.parentElement?.querySelectorAll("[data-linebreak-line]") ??
          []),
      ]
      const index = Math.max(0, lines.indexOf(this))
      return new DOMRect(0, index * 20, this.clientWidth, 20)
    },
  )
  const metrics = vi
    .spyOn(measurement, "metricsForStyle")
    .mockImplementation((_document, _style, font, letterSpacing) =>
      createMetrics({
        font,
        letterSpacing,
        measure: (text) => text.length * 8,
      }),
    )
  const advance = vi
    .spyOn(measurement, "currentAdvance")
    .mockImplementation((_document, _font, text) => text.length * 8)
  vi.spyOn(rendering, "honoursHangingMargins").mockReturnValue(false)
  return { metrics, advance }
}

export const paragraph = (text = PROSE, width = 300) => {
  const element = document.createElement("p")
  element.textContent = text
  element.style.width = `${width}px`
  document.body.append(element)
  return element
}
