import { afterEach, expect, test } from "vitest"
import { contentWidth, styleOf } from "@linebreak/dom/geometry"

afterEach(() => document.body.replaceChildren())

const element = (sizing: string, width: string, client: number) => {
  const host = document.createElement("div")
  host.style.boxSizing = sizing
  host.style.width = width
  host.style.paddingInlineStart = "7.125px"
  host.style.paddingInlineEnd = "7.125px"
  Object.defineProperty(host, "clientWidth", { value: client })
  document.body.append(host)
  return host
}

test("resolved content-box widths preserve subpixel content geometry", () => {
  const host = element("content-box", "100.375px", 115)
  expect(contentWidth(host, styleOf(host))).toBe(100.375)
})

test("content-box used width already excludes padding and reserved gutter space", () => {
  const host = element("content-box", "73.375px", 101)
  host.style.scrollbarGutter = "stable both-edges"
  host.style.overflow = "scroll"
  expect(contentWidth(host, styleOf(host))).toBe(73.375)
})

test("border-box measurements retain the client-width path", () => {
  const host = element("border-box", "100.375px", 98)
  expect(contentWidth(host, styleOf(host))).toBe(83.75)
})

test("unresolved widths retain the padding-adjusted client width", () => {
  const host = element("content-box", "auto", 100)
  expect(contentWidth(host, styleOf(host))).toBe(85.75)
})

test("hidden content boxes cannot borrow their declared visible width", () => {
  const host = element("content-box", "320px", 0)
  host.style.display = "none"
  expect(contentWidth(host, styleOf(host))).toBeLessThanOrEqual(0)
})

test("a zero client width remains unmeasurable even with a fractional declaration", () => {
  const host = element("content-box", "0.125px", 0)
  host.style.paddingInlineStart = "0px"
  host.style.paddingInlineEnd = "0px"
  expect(contentWidth(host, styleOf(host))).toBe(0)
})
