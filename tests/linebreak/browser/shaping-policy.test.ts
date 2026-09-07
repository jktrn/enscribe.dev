import { afterEach, expect, test, vi } from "vitest"
import { metricsForStyle } from "@linebreak/dom/measure-dom"

afterEach(() => vi.restoreAllMocks())

test.each([
  ["fontKerning", "none"],
  ["fontKerning", "normal"],
  ["textRendering", "optimizeSpeed"],
  ["textRendering", "optimizeLegibility"],
] as const)("authored %s:%s reaches the actual DOM measurement probe", (property, value) => {
  const style = document.createElement("span").style
  style[property] = value
  const canvas = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
  const probes: HTMLElement[] = []
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      expect(this.isConnected).toBe(true)
      expect(this.style[property]).toBe(value)
      probes.push(this)
      return new DOMRect(0, 0, this.textContent!.length * 7, 20)
    },
  )
  const metrics = metricsForStyle(document, style, "16px serif", 0)
  expect(metrics?.measureRun("AVATAR")).toBe(42)
  expect(canvas).not.toHaveBeenCalled()
  expect(probes.at(-1)?.textContent).toBe("AVATAR")
  expect(probes.every((probe) => !probe.isConnected)).toBe(true)
})
