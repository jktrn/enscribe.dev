import { describe, expect, test } from "bun:test"
import { getMarqueeTiming } from "@/lib/marquee"

describe("getMarqueeTiming", () => {
  test("only enables scrolling for meaningful overflow", () => {
    expect(getMarqueeTiming(-20)).toBeNull()
    expect(getMarqueeTiming(1)).toBeNull()
    expect(getMarqueeTiming(Number.POSITIVE_INFINITY)).toBeNull()
  })

  test("uses the minimum duration and scroll speed", () => {
    expect(getMarqueeTiming(28)).toEqual({
      shiftPx: 28,
      durationSeconds: 4,
    })
    expect(getMarqueeTiming(182)).toEqual({
      shiftPx: 182,
      durationSeconds: 10,
    })
  })
})
