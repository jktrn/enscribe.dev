import { describe, expect, test } from "bun:test"
import { mergeThemedSvg } from "@/lib/assets/themed-svg"

const svg = (body: string) => `<svg viewBox="0 0 8 8" fill="none">${body}</svg>`
const LONG = "M0 0h8v8H0zM1 1h6v6H1zM2 2h4v4H2z"

describe("mergeThemedSvg", () => {
  test("keeps one copy of geometry the themes share", () => {
    const merged = mergeThemedSvg(
      svg(`<path d="${LONG}" fill="var(--background-l6)"/>`),
      svg(`<path d="${LONG}" fill="var(--background-l3)"/>`),
    )
    expect(merged).toBe(
      svg(
        `<path d="${LONG}" fill="light-dark(var(--background-l6), var(--background-l3))"/>`,
      ),
    )
  })

  test("leaves a paint both themes agree on untouched", () => {
    const source = svg(`<path d="${LONG}" fill="white" stroke="none"/>`)
    expect(mergeThemedSvg(source, source)).toBe(source)
  })

  test("paints nothing where one theme has no fill", () => {
    const merged = mergeThemedSvg(
      svg(`<path d="${LONG}" fill="none"/>`),
      svg(`<path d="${LONG}" fill="red"/>`),
    )
    expect(merged).toContain('fill="light-dark(transparent, red)"')
  })

  test("gates an element only one theme draws", () => {
    const merged = mergeThemedSvg(
      svg(`<path d="${LONG}" fill="red"/><g><rect width="1" height="1"/></g>`),
      svg(`<path d="${LONG}" fill="red"/><circle r="1"/>`),
    )
    expect(merged).toBe(
      svg(
        `<path d="${LONG}" fill="red"/>` +
          `<g data-theme-light><rect width="1" height="1"/></g>` +
          `<circle data-theme-dark r="1"/>`,
      ),
    )
  })

  test("points both themes at the shared definition", () => {
    const themed = (suffix: string, fill: string) =>
      svg(
        `<g clip-path="url(#clip_${suffix})"><path d="${LONG}" fill="${fill}"/></g>` +
          `<defs><clipPath id="clip_${suffix}"><rect width="8" height="8"/></clipPath></defs>`,
      )
    const merged = mergeThemedSvg(themed("1_2", "red"), themed("3_4", "blue"))
    expect(merged).toContain('clip-path="url(#clip_1_2)"')
    expect(merged).toContain('<clipPath id="clip_1_2">')
    expect(merged).not.toContain("3_4")
  })

  test("renames a definition only the dark theme has", () => {
    const merged = mergeThemedSvg(
      svg(`<path d="${LONG}" fill="red"/>`),
      svg(
        `<path d="${LONG}" fill="red"/>` +
          `<mask id="m"><rect width="1" height="1"/></mask>` +
          `<rect width="2" height="2" mask="url(#m)"/>`,
      ),
    )
    expect(merged).toContain('<mask data-theme-dark id="m-dark">')
    expect(merged).toContain('mask="url(#m-dark)"')
  })

  test("declines when shared geometry references different definitions", () => {
    const themed = (clip: string) =>
      svg(
        `<g clip-path="url(#c)"><path d="${LONG}" fill="red"/></g>` +
          `<defs><clipPath id="c">${clip}</clipPath><clipPath id="d"><rect width="1" height="1"/></clipPath></defs>`,
      )
    const light = themed('<rect width="8" height="8"/>')
    const dark = themed('<rect width="8" height="8"/>').replace(
      'clip-path="url(#c)"',
      'clip-path="url(#d)"',
    )
    expect(mergeThemedSvg(light, dark)).toBeNull()
  })

  test("declines when the themes differ by more than paint and a few elements", () => {
    expect(
      mergeThemedSvg(
        svg(`<path d="${LONG}" fill="red"/>`),
        svg(`<path d="M0 0h1v1H0zM3 3h1v1H3zM5 5h1v1H5z" fill="red"/>`),
      ),
    ).toBeNull()
  })

  test("draws a shape twice when a gradient differs between themes", () => {
    const merged = mergeThemedSvg(
      svg(`<path d="${LONG}" fill="url(#a)"/>`),
      svg(`<path d="${LONG}" fill="red"/>`),
    )
    expect(merged).toBe(
      svg(
        `<path data-theme-light d="${LONG}" fill="url(#a)"/>` +
          `<path data-theme-dark d="${LONG}" fill="red"/>`,
      ),
    )
  })

  test("declines when a group is clipped differently between themes", () => {
    const themed = (clip: string) =>
      svg(
        `<g clip-path="url(#c)"><path d="${LONG}" fill="red"/></g>` +
          `<clipPath id="c">${clip}</clipPath>`,
      )
    expect(
      mergeThemedSvg(
        themed('<rect width="8" height="8"/>').replace("url(#c)", "url(#x)"),
        themed('<rect width="8" height="8"/>'),
      ),
    ).toBeNull()
  })

  test("declines when a group wrapping shared geometry differs", () => {
    const shared = `<path d="${LONG}" fill="red"/>`
    expect(
      mergeThemedSvg(
        svg(`<g>${shared}</g>`),
        svg(`<g opacity="0.5">${shared}</g>`),
      ),
    ).toBeNull()
  })

  test("declines when one theme splits a group the other keeps whole", () => {
    const first = `<path d="${LONG}" fill="red"/>`
    const second = `<path d="${LONG}z" fill="red"/>`
    expect(
      mergeThemedSvg(
        svg(`<g>${first}</g><g>${second}</g>`),
        svg(`<g>${first}${second}</g>`),
      ),
    ).toBeNull()
  })

  test("declines text and comments it cannot align", () => {
    const text = svg(`<text>${LONG}</text>`)
    const comment = svg(`<!-- note --><path d="${LONG}"/>`)
    expect(mergeThemedSvg(text, text)).toBeNull()
    expect(mergeThemedSvg(comment, comment)).toBeNull()
  })
})
