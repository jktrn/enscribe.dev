import { expect, test } from "bun:test"
import { preparedBatchWidths } from "@linebreak/adapters/pretext"

test("reads one natural width for every hard-break-delimited batch item", () => {
  expect(
    preparedBatchWidths(
      {
        segments: ["alpha", "\n", "be", "ta", "\n", "gamma"],
        kinds: ["text", "hard-break", "text", "text", "hard-break", "text"],
        widths: [40, 0, 12, 13, 0, 35],
      },
      3,
    ),
  ).toEqual([40, 25, 35])
})

test("rejects a batch whose hard-break count does not match its inputs", () => {
  expect(
    preparedBatchWidths(
      {
        segments: ["alpha", "\n", "beta"],
        kinds: ["text", "hard-break", "text"],
        widths: [40, 0, 25],
      },
      3,
    ),
  ).toBeNull()
})
