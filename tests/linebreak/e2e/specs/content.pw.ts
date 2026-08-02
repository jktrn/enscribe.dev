import { expect, test } from "@playwright/test"
import { nativeText, settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

const rejoinedText = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const main = document.querySelector("main")
    if (!main) return ""
    for (const block of main.querySelectorAll("[data-linebreak-typeset]")) {
      block.textContent = block.textContent ?? ""
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
    '[data-linebreak-typeset]:has(> [data-linebreak-line="forced"])',
  )

  expect(copied).not.toBeNull()
  if (!copied) return

  const parts = copied.plain.split("\n").filter((part) => part.trim())
  expect(parts.length).toBeGreaterThan(1)

  expect(copied.plain.replace(/\s+/gu, "")).toBe(copied.characters)
})

test("copying keeps inline math and ruby in the surrounding text", async ({
  page,
}) => {
  await settleTypeset(page)
  await page.evaluate(() => {
    const block = document.createElement("p")
    block.dataset.copyFixture = ""
    block.dataset.linebreakTypeset = "1"
    block.innerHTML =
      '<span data-linebreak-line="none">Before <math><mi>x</mi><mo>+</mo><mn>1</mn></math> and <ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp></ruby> after</span>'
    document.body.append(block)
  })

  const copied = await copyFrom(page, "[data-copy-fixture]")

  expect(copied?.plain).toBe("Before x+1 and 漢kan after")
})

test("a hyphenated break is an element boundary", async ({ page }) => {
  await settleTypeset(page)

  const boundary = await page.evaluate(() => {
    const line = document.querySelector(
      '[data-linebreak-typeset] > [data-linebreak-line="hyphen"]',
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

const SHY = "­"

const COMPOUND = `kraftfahrzeug${SHY}haftpflicht`

const TAIL =
  ", and the measure below has to decide whether to use it or to leave the compound whole."

const AUTHORED = `An authored joint sits inside ${COMPOUND}${TAIL}`

const GUARDED = `An authored joint sits inside <span style="text-wrap-mode: nowrap">${COMPOUND}</span>${TAIL}`

const MEASURE = 340

const typesetFixture = async (
  page: import("@playwright/test").Page,
  markup: string,
) => {
  await settleTypeset(page)
  const authored = await page.evaluate(
    ({ html, width }) => {
      const root = document.querySelector("[data-linebreak-root]")
      if (!root) throw new Error("the page carries no linebreak root")
      const block = document.createElement("p")
      block.dataset.shyFixture = ""
      block.style.width = `${width}px`
      block.innerHTML = html
      root.append(block)
      block.scrollIntoView()
      for (const enabled of [false, true]) {
        document.dispatchEvent(
          new CustomEvent("text-justification-change", { detail: { enabled } }),
        )
      }
      return block.innerHTML
    },
    { html: markup, width: MEASURE },
  )
  await page.waitForFunction(
    () =>
      document.querySelector("[data-shy-fixture][data-linebreak-typeset]") !==
      null,
    undefined,
    { timeout: 20_000 },
  )
  return authored
}

const fixtureLines = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const block = document.querySelector("[data-shy-fixture]")
    if (!block) return null
    const lines = [
      ...block.querySelectorAll<HTMLElement>(":scope > [data-linebreak-line]"),
    ]
    return {
      kinds: lines.map((line) => line.dataset.linebreakLine ?? ""),
      texts: lines.map((line) => line.textContent ?? ""),
      text: (block.textContent ?? "").replace(/\s+/gu, " ").trim(),
    }
  })

const raggedFixture = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("text-justification-change", {
        detail: { enabled: false },
      }),
    )
    return document.querySelector("[data-shy-fixture]")?.innerHTML ?? ""
  })

test("a paragraph breaks at the soft hyphen its author wrote", async ({
  page,
}) => {
  await typesetFixture(page, AUTHORED)
  const rendered = await fixtureLines(page)

  expect(rendered).not.toBeNull()
  if (!rendered) return
  const broke = rendered.texts.findIndex((text) => text.endsWith(SHY))

  expect(broke).toBeGreaterThanOrEqual(0)
  expect(rendered.texts[broke]).toContain(`inside kraftfahrzeug${SHY}`)
  expect(rendered.texts[broke + 1]).toMatch(/^haftpflicht,/u)
  expect(rendered.kinds[broke]).toBe("hyphen")
  expect(rendered.text).toBe(AUTHORED)
})

test("restoring gives back the soft hyphen a line broke at", async ({
  page,
}) => {
  const authored = await typesetFixture(page, AUTHORED)
  const broken = await fixtureLines(page)

  expect(authored).toContain(SHY)
  expect(broken?.texts.some((text) => text.endsWith(SHY))).toBe(true)
  expect(await raggedFixture(page)).toBe(authored)
})

test("a soft hyphen a wrapper forbids breaking at stays inert", async ({
  page,
}) => {
  await typesetFixture(page, GUARDED)
  const rendered = await fixtureLines(page)

  expect(rendered).not.toBeNull()
  if (!rendered) return

  expect(rendered.texts.length).toBeGreaterThan(1)
  expect(rendered.texts.some((text) => text.endsWith(SHY))).toBe(false)
  expect(rendered.texts.some((text) => text.includes(COMPOUND))).toBe(true)
  expect(rendered.text).toBe(AUTHORED)
})

test("an edit to a typeset paragraph survives the next reflow", async ({
  page,
}) => {
  await settleTypeset(page)

  const edited = "Rewritten by the consumer after the paragraph was typeset."
  const applied = await page.evaluate((text) => {
    const block = document.querySelector("[data-linebreak-typeset]")
    if (!block) return false
    block.textContent = text
    return true
  }, edited)
  expect(applied).toBe(true)

  await page.setViewportSize({ width: 1180, height: 900 })
  await page.waitForTimeout(1200)

  const survived = await page.evaluate(() => {
    const main = document.querySelector("main")
    return (main?.textContent ?? "").replace(/\s+/gu, " ")
  })
  expect(survived).toContain(edited)
})
