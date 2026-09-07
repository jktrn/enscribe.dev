import { afterEach, expect, test } from "vitest"
import { handleCopy } from "@linebreak/dom/clipboard"

afterEach(() => {
  document.body.replaceChildren()
  getSelection()!.removeAllRanges()
})

test.each([
  "element",
  "document",
])("an iframe copy on %s uses its own selection, styles, and markup", (target) => {
  const frame = document.createElement("iframe")
  document.body.append(frame)
  const doc = frame.contentDocument!
  const p = doc.createElement("p")
  p.innerHTML =
    '<span data-linebreak-line="space" style="display:inline"><em style="display:inline">alpha</em></span> <span data-linebreak-line="end" style="display:inline">beta</span><span style="display:none">hidden</span>'
  p.setAttribute("data-linebreak-typeset", "2")
  doc.body.append(p)
  const range = doc.createRange()
  range.selectNodeContents(p)
  doc.getSelection()!.addRange(range)
  doc.addEventListener("copy", handleCopy)
  const event = new ClipboardEvent("copy", {
    bubbles: true,
    clipboardData: new DataTransfer(),
    cancelable: true,
  })
  ;(target === "element" ? p : doc).dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(event.clipboardData!.getData("text/plain")).toBe("alpha beta")
  const html = event.clipboardData!.getData("text/html")
  expect(html).toContain("<em")
  expect(html).not.toContain("data-linebreak")
  expect(getSelection()!.rangeCount).toBe(0)
})
