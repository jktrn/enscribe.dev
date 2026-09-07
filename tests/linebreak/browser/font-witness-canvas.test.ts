import { afterEach, expect, test, vi } from "vitest"
import { currentAdvance } from "@linebreak/dom/measure-dom"

afterEach(() => vi.restoreAllMocks())

test("font witnesses reuse a document's canvas and always read its current font", () => {
  let scale = 1
  const create = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    const context = { font: "", measureText: (text: string) => ({ width: scale * text.length * Number.parseFloat(context.font) }) as TextMetrics }
    return context as CanvasRenderingContext2D
  })
  const owner = document.implementation.createHTMLDocument()
  expect(currentAdvance(owner, "12px serif", "ab")).toBe(24)
  scale = 2
  expect(currentAdvance(owner, "20px serif", "ab")).toBe(80)
  expect(create).toHaveBeenCalledOnce()
  const another = document.implementation.createHTMLDocument()
  expect(currentAdvance(another, "10px serif", "ab")).toBe(40)
  expect(create).toHaveBeenCalledTimes(2)
  expect(owner.body.childElementCount).toBe(0)
  expect(another.body.childElementCount).toBe(0)
})

test("an unavailable context can be retried later", () => {
  const create = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  const owner = document.implementation.createHTMLDocument()
  expect(currentAdvance(owner, "12px serif", "ab")).toBeNull()
  create.mockReturnValue({ canvas: document.createElement("canvas"), font: "", measureText: (_text: string) => ({ width: 24 }) as TextMetrics } as CanvasRenderingContext2D)
  expect(currentAdvance(owner, "12px serif", "ab")).toBe(24)
})
