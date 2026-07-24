import { describe, expect, test } from "bun:test"
import { formatDate, formatDateParts, ordinalSuffix } from "@/lib/utils"

describe("date formatting", () => {
  test("uses a full month name and an ordinal day", () => {
    const date = new Date(Date.UTC(2026, 6, 16))

    expect(formatDate(date)).toBe("July 16th, 2026")
    expect(formatDateParts(date)).toEqual({
      month: "July",
      day: 16,
      suffix: "th",
      year: "2026",
    })
  })

  test("handles English ordinal suffix exceptions", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinalSuffix)).toEqual(
      ["st", "nd", "rd", "th", "th", "th", "th", "st", "nd", "rd", "st"],
    )
  })
})
