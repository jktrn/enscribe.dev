import { describe, expect, test } from "bun:test"
import { latinProtrusion, protrusionCode } from "@linebreak/text/protrusion"
import reference from "../fixtures/microtype-protrusion-reference.json"

describe("protrusion values against the independent CTAN source", () => {
  test("every retained default/T1-default code matches the original source row", () => {
    const expectedCharacters: string[] = []
    for (const row of reference.rows) {
      const pairs = [...row.source.matchAll(/=\s*\{\s*(-?\d*)\s*,\s*(-?\d*)\s*\}/gu)]
      expect(pairs).toHaveLength(row.characters.length)
      row.characters.forEach((character, index) => {
        expectedCharacters.push(character)
        const pair = pairs[index]
        const left = pair[1] === "" ? undefined : Number(pair[1])
        const right = pair[2] === "" ? undefined : Number(pair[2])
        expect(latinProtrusion[character]?.l).toBe(left)
        expect(latinProtrusion[character]?.r).toBe(right)
        expect(protrusionCode(latinProtrusion, character, "l")).toBe(left ?? 0)
        expect(protrusionCode(latinProtrusion, character, "r")).toBe(right ?? 0)
      })
    }
    for (const [character, original] of reference.aliases) {
      expectedCharacters.push(character)
      expect(latinProtrusion[character]).toEqual(latinProtrusion[original])
    }
    expect(Object.keys(latinProtrusion).sort()).toEqual(expectedCharacters.sort())
  })
})
