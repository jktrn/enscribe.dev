import { afterEach, expect, test, vi } from "vitest"
import { primeFontMetrics } from "@linebreak/dom/measure-dom"
import { hasNativeCalibration } from "@linebreak/text/native-width-cache"

afterEach(() => vi.restoreAllMocks())

test("independent fonts are calibrated after all probes have been attached", () => {
  const owner = document.implementation.createHTMLDocument()
  class Fonts extends EventTarget {
    status = "loaded";
    *[Symbol.iterator]() {}
  }
  Object.defineProperty(owner, "fonts", { value: new Fonts() })
  const styles = [12, 20].map(size => {
    const style = owner.createElement("span").style
    style.font = `${size}px serif`
    return style
  })
  const contexts = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    const context = { font: "", measureText: (text: string) => ({ width: text.length * Number.parseFloat(context.font) }) as TextMetrics }
    return context as CanvasRenderingContext2D
  })
  const reads = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    expect(this.parentElement!.childElementCount).toBe(2)
    const width = this.textContent!.length * Number.parseFloat(this.style.font)
    return new DOMRect(0, 0, width, 16)
  })
  const primed = primeFontMetrics(owner, () => styles)
  expect(hasNativeCalibration(owner)).toBe(true)
  expect(primed.map(value => value.suffix)).toEqual(["0||12px serif", "0||20px serif"])
  expect(primed.map(value => value.metrics.measureRun("ab"))).toEqual([24, 40])
  expect(contexts).toHaveBeenCalledOnce()
  expect(primed[0]!.metrics.measureRun("cd")).toBe(24)
  expect(primed[1]!.metrics.measureRun("ef")).toBe(40)
  expect(primed[0]!.metrics.measureRun("gh")).toBe(24)
  expect(reads).toHaveBeenCalledTimes(2)
  const inspectStyles = vi.fn(() => styles)
  expect(primeFontMetrics(owner, inspectStyles)).toEqual([])
  expect(inspectStyles).not.toHaveBeenCalled()
  expect(contexts).toHaveBeenCalledOnce()
  expect(reads).toHaveBeenCalledTimes(2)
  expect(owner.body.childElementCount).toBe(0)
})
