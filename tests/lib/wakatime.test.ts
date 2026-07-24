import { describe, expect, test } from "bun:test"
import { MAX_WAKATIME_ROWS, visibleWakatimeRows } from "../../src/lib/wakatime"

describe("visibleWakatimeRows", () => {
  test.each([
    [6.99, 3],
    [7, 4],
    [8.49, 4],
    [8.5, 5],
    [9.99, 5],
    [10, 6],
    [19.99, 6],
    [20, MAX_WAKATIME_ROWS],
  ])("shows the expected rows at %frem", (height, expected) => {
    expect(visibleWakatimeRows(height)).toBe(expected)
  })
})
