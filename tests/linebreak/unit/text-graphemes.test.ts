import { expect, test } from "bun:test"
import { graphemes } from "@linebreak/text/graphemes"

test("ASCII grapheme records match the native segmenter", () => {
  const native = new Intl.Segmenter()
  let state = 20260917
  for (let trial = 0; trial < 2000; trial++) {
    let text = ""
    for (let index = 0; index < trial % 95; index++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      text += String.fromCharCode(32 + state % 95)
    }
    expect([...graphemes(text)]).toEqual([...native.segment(text)])
  }
})

test("controls, combining marks and emoji preserve native boundaries", () => {
  const native = new Intl.Segmenter()
  for (const text of ["\r\n", "a\tb", "a\u0301", "👩🏽‍💻", "🇳🇿", "漢字", "क्‍ष"]) {
    expect([...graphemes(text)]).toEqual([...native.segment(text)])
  }
})
