import { afterEach, expect, test, vi } from "vitest"
import { invalidateStretchScales, stretchScaleFor } from "@linebreak/dom/stretch"

afterEach(() => { vi.restoreAllMocks(); invalidateStretchScales(); document.body.replaceChildren() })

test("calibration cache distinguishes stretch budgets for the same font", () => {
  const probe = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, Number.parseFloat(this.style.fontStretch), 16)
  })
  const narrow = stretchScaleFor(document, "16px serif", 0, 0.01)
  expect(narrow?.steps.map((step) => step.pct)).toEqual([99, 100, 101])
  const broad = stretchScaleFor(document, "16px serif", 0, 0.02)
  expect(broad?.steps.map((step) => step.pct)).toEqual([98, 99, 100, 101, 102])
  expect(broad).not.toBe(narrow)
  const reads = probe.mock.calls.length
  expect(stretchScaleFor(document, "16px serif", 0, 0.01)).toBe(narrow)
  expect(stretchScaleFor(document, "16px serif", 0, 0.02)).toBe(broad)
  expect(probe).toHaveBeenCalledTimes(reads)
})

test("a budget that fits no step does not poison a wider calibration", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, Number.parseFloat(this.style.fontStretch), 16)
  })
  expect(stretchScaleFor(document, "16px serif", 0, 0.001)).toBeNull()
  expect(stretchScaleFor(document, "16px serif", 0, 0.02)?.steps).toHaveLength(5)
})
