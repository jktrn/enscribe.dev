import { describe, expect, test } from "bun:test"
import { latinProtrusion, protrusionCode } from "@linebreak/text/protrusion"

describe("microtype codes", () => {
  test("the stops carry microtype's default right-side values", () => {
    expect(protrusionCode(latinProtrusion, ".", "r")).toBe(700)
    expect(protrusionCode(latinProtrusion, ",", "r")).toBe(500)
    expect(protrusionCode(latinProtrusion, ":", "r")).toBe(500)
    expect(protrusionCode(latinProtrusion, ";", "r")).toBe(300)
    expect(protrusionCode(latinProtrusion, "!", "r")).toBe(100)
    expect(protrusionCode(latinProtrusion, "?", "r")).toBe(100)
  })

  test("a stop does not protrude into the left margin", () => {
    for (const character of [".", ",", ":", ";", "!", "?"]) {
      expect(protrusionCode(latinProtrusion, character, "l")).toBe(0)
    }
  })

  test("the hyphen carries microtype's T1 dash value on both sides", () => {
    expect(protrusionCode(latinProtrusion, "-", "l")).toBe(500)
    expect(protrusionCode(latinProtrusion, "-", "r")).toBe(500)
    expect(latinProtrusion["‐"]).toEqual(latinProtrusion["-"])
  })

  test("dashes shorten as they widen", () => {
    expect(protrusionCode(latinProtrusion, "–", "r")).toBe(200)
    expect(protrusionCode(latinProtrusion, "—", "r")).toBe(150)
  })

  test("brackets protrude on the side that faces the text", () => {
    expect(protrusionCode(latinProtrusion, "(", "l")).toBe(100)
    expect(protrusionCode(latinProtrusion, "(", "r")).toBe(0)
    expect(protrusionCode(latinProtrusion, ")", "r")).toBe(200)
    expect(protrusionCode(latinProtrusion, ")", "l")).toBe(0)
  })

  test("straight quotes mirror their curly equivalents", () => {
    expect(latinProtrusion["'"]).toEqual(latinProtrusion["’"])
    expect(latinProtrusion['"']).toEqual(latinProtrusion["”"])
  })
})

describe("lookup", () => {
  test("an ordinary letter has no entry and no code", () => {
    for (const character of ["a", "A", "e", "O", "1", "7", " "]) {
      expect(protrusionCode(latinProtrusion, character, "l")).toBe(0)
      expect(protrusionCode(latinProtrusion, character, "r")).toBe(0)
    }
  })

  test("an empty or multi-character key resolves to zero", () => {
    expect(protrusionCode(latinProtrusion, "", "r")).toBe(0)
    expect(protrusionCode(latinProtrusion, "..", "r")).toBe(0)
  })

  test("inherited object properties are not mistaken for codes", () => {
    expect(protrusionCode(latinProtrusion, "constructor", "l")).toBe(0)
    expect(protrusionCode(latinProtrusion, "toString", "r")).toBe(0)
  })

  test("the table holds only punctuation and symbols", () => {
    for (const character of Object.keys(latinProtrusion)) {
      expect(/\p{L}|\p{N}/u.test(character)).toBe(false)
    }
  })
})
