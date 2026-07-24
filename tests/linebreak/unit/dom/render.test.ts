import { expect, test } from "bun:test"
import { preserveImageAttributes } from "@linebreak/dom/render"

test("image-free blocks do not inspect their replacement", () => {
  const block = {
    querySelectorAll: () => [],
  } as unknown as HTMLElement
  let replacementReads = 0
  const replacement = new Proxy({} as ParentNode, {
    get() {
      replacementReads += 1
      return () => []
    },
  })

  preserveImageAttributes(block, replacement, ["data-loaded"])

  expect(replacementReads).toBe(0)
})
