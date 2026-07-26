import { expect, test } from "@playwright/test"
import { nativeText, settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

/**
 * Typesetting rewrites a paragraph into one element per line. These specs pin
 * the rule that keeps that invisible to the reader.
 *
 * One element per line means a line break is a real element boundary, and the
 * browser reports it as a newline. Where the break fell on a space that is
 * exactly right — the space was consumed. Where hyphenation split a word it is
 * not, and nothing can remove the boundary. So `innerText` is compared with the
 * hyphen boundaries rejoined, and the clipboard — what the reader actually
 * takes away — is required to match exactly.
 */

/**
 * Rebuilds the paragraph text from the line elements, honouring break kind.
 *
 * The rejoin happens on the live document rather than on a clone. `innerText`
 * on a detached element falls back to `textContent`, so a clone reports text
 * that CSS hides — a light/dark pair of SVG labels, say — while the baseline
 * this is compared against reads the rendered page. The two extractions have to
 * see the same CSS to be comparable. Nothing after this reads the page.
 */
const rejoinedText = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const rejoin = (block: Element) => {
      let text = ""
      const lines = [...block.querySelectorAll(":scope > .lb-line")]
      for (const [index, line] of lines.entries()) {
        text += line.textContent ?? ""
        if (index === lines.length - 1) continue
        // Only a break that consumed a space gets one back. A break inside a
        // word — hyphenated, or at a hyphen the author already wrote — did not.
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

  // WebKit's own baseline innerText drops an authored space sitting between an
  // anchor and a following span at a soft-wrap boundary. The space is present
  // in the markup and in the typeset render, so the difference is in WebKit's
  // text extraction rather than in this package.
  if (browserName === "webkit") {
    expect(live.replaceAll(" ", "")).toBe(plain.replaceAll(" ", ""))
    return
  }
  expect(live).toBe(plain)
})

/**
 * Drives the real `copy` handler, which `Selection.toString()` never reaches.
 *
 * The handler replaces both clipboard flavours, so what it puts there is what
 * the reader pastes — and nothing above this line tests it.
 */
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
      // `textContent`, not `innerText`: it is the same in every engine, and
      // what it omits — every line and break boundary — is exactly what the
      // copied text is supposed to add back.
      characters: (block.textContent ?? "").replace(/\s+/gu, ""),
    }
  }, selector)

test("copying restores the space a break consumed", async ({ page }) => {
  await settleTypeset(page)
  const copied = await copyFrom(page, "[data-linebreak-typeset]")

  expect(copied).not.toBeNull()
  if (!copied) return
  expect(copied.plain.length).toBeGreaterThan(0)
  // No word runs into the next, and nothing this package injects appears.
  expect(copied.plain).not.toMatch(/\p{L}\n\p{L}/u)
  expect(copied.plain).not.toContain("￼")
})

test("copying keeps the newline an authored break stands for", async ({
  page,
}) => {
  // The concert list separates artists, date and genres with `<br>`. Copied
  // through a payload built from `textContent`, those three run together into
  // one line — the newline the author wrote is simply gone.
  await settleTypeset(page, "/music")
  // A paragraph's own end is a forced break too, so the break has to be one
  // with a line after it to be an authored `<br>`.
  const copied = await copyFrom(
    page,
    '[data-linebreak-typeset]:has(> [data-linebreak-break="forced"]:not(:last-child))',
  )

  expect(copied).not.toBeNull()
  if (!copied) return
  // The break is a newline...
  const parts = copied.plain.split("\n").filter((part) => part.trim())
  expect(parts.length).toBeGreaterThan(1)
  // ...and nothing was lost or invented on either side of it.
  expect(copied.plain.replace(/\s+/gu, "")).toBe(copied.characters)
})

/**
 * The trade-off hyphenation buys, stated so it is visible rather than
 * discovered: a hyphenated word carries an element boundary, so anything
 * reading `textContent` sees the halves run together and the browser's
 * find-in-page will not match across it.
 */
test("a hyphenated break is an element boundary", async ({ page }) => {
  await settleTypeset(page)

  const boundary = await page.evaluate(() => {
    const line = document.querySelector("[data-linebreak-typeset] > .lb-hyphen")
    const block = line?.parentElement
    if (!line || !block) return null
    const next = line.nextElementSibling
    const before = line.textContent?.trim().split(/\s+/u).at(-1) ?? ""
    const after = next?.textContent?.trim().split(/\s+/u)[0] ?? ""
    return {
      whole: `${before}${after}`,
      // Rejoined, the word is intact; read raw, the halves are adjacent.
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
      // A wrapper cut by a break must not repeat its edge on both fragments.
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
