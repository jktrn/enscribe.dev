import { expect, test } from "@playwright/test"
import { nativeText, settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

const rejoinedText = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const rejoin = (block: Element) => {
      let text = ""
      const lines = [
        ...block.querySelectorAll(":scope > [data-linebreak-break]"),
      ]
      for (const [index, line] of lines.entries()) {
        text += line.textContent ?? ""
        if (index === lines.length - 1) continue

        if ((line as HTMLElement).dataset.linebreakBreak === "space") {
          text += " "
        }
      }
      return text
    }

    const main = document.querySelector("main")
    if (!main) return ""
    for (const block of main.querySelectorAll("[data-linebreak-typeset]")) {
      block.textContent = rejoin(block)
    }
    return main.innerText.replace(/\s+/gu, " ").trim()
  })

test("rendered text matches the JavaScript-disabled render", async ({
  page,
  browserName,
}) => {
  const plain = await nativeText(page)
  await settleTypeset(page)
  const live = await rejoinedText(page)

  if (browserName === "webkit") {
    expect(live.replaceAll(" ", "")).toBe(plain.replaceAll(" ", ""))
    return
  }
  expect(live).toBe(plain)
})

const copyFrom = (page: import("@playwright/test").Page, selector: string) =>
  page.evaluate((blockSelector) => {
    const block = document.querySelector(blockSelector)
    if (!block) return null
    const selection = getSelection()
    selection?.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(block)
    selection?.addRange(range)

    const event = new ClipboardEvent("copy", {
      clipboardData: new DataTransfer(),
      bubbles: true,
      cancelable: true,
    })
    if (!event.clipboardData) return null
    document.dispatchEvent(event)
    return {
      plain: event.clipboardData.getData("text/plain"),

      characters: (block.textContent ?? "").replace(/\s+/gu, ""),
    }
  }, selector)

test("copying restores the space a break consumed", async ({ page }) => {
  await settleTypeset(page)
  const copied = await copyFrom(page, "[data-linebreak-typeset]")

  expect(copied).not.toBeNull()
  if (!copied) return
  expect(copied.plain.length).toBeGreaterThan(0)

  expect(copied.plain).not.toMatch(/\p{L}\n\p{L}/u)
  expect(copied.plain).not.toContain("￼")
})

test("copying keeps the newline an authored break stands for", async ({
  page,
}) => {
  await settleTypeset(page, "/music")

  const copied = await copyFrom(
    page,
    '[data-linebreak-typeset]:has(> [data-linebreak-break="forced"]:not(:last-child))',
  )

  expect(copied).not.toBeNull()
  if (!copied) return

  const parts = copied.plain.split("\n").filter((part) => part.trim())
  expect(parts.length).toBeGreaterThan(1)

  expect(copied.plain.replace(/\s+/gu, "")).toBe(copied.characters)
})

test("a hyphenated break is an element boundary", async ({ page }) => {
  await settleTypeset(page)

  const boundary = await page.evaluate(() => {
    const line = document.querySelector(
      '[data-linebreak-typeset] > [data-linebreak-break="hyphen"]',
    )
    const block = line?.parentElement
    if (!line || !block) return null
    const next = line.nextElementSibling
    const before = line.textContent?.trim().split(/\s+/u).at(-1) ?? ""
    const after = next?.textContent?.trim().split(/\s+/u)[0] ?? ""
    return {
      whole: `${before}${after}`,
      intactWhenRejoined: (block.textContent ?? "").includes(
        `${before}${after}`,
      ),
    }
  })

  expect(boundary).not.toBeNull()
  expect(boundary?.intactWhenRejoined).toBe(true)
})

test("inline code and decorated links survive being split", async ({
  page,
}) => {
  await settleTypeset(page)

  const fragments = await page.evaluate(() => {
    const cut = [
      ...document.querySelectorAll(
        "[data-linebreak-typeset] [data-linebreak-fragment]",
      ),
    ]
    const openEnded = cut.filter(
      (element) =>
        !element.hasAttribute("data-linebreak-fragment-start") ||
        !element.hasAttribute("data-linebreak-fragment-end"),
    )
    return {
      total: cut.length,
      suppressed: openEnded.every((element) => {
        const style = getComputedStyle(element)
        if (!element.hasAttribute("data-linebreak-fragment-start")) {
          return Number.parseFloat(style.paddingInlineStart) === 0
        }
        return Number.parseFloat(style.paddingInlineEnd) === 0
      }),
    }
  })

  expect(fragments.total).toBeGreaterThan(0)
  expect(fragments.suppressed).toBe(true)
})
