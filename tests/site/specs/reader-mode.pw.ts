import { expect, test } from "@playwright/test"

const articles = [
  "/blog/dhhutc-2022-port-authority",
  "/blog/azusawas-gacha-world",
]

test("hides prose icons in reader mode", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("readerMode", "on"))

  for (const article of articles) {
    await page.goto(article, { waitUntil: "domcontentloaded" })
    await expect(page.locator("html")).toHaveAttribute("data-reader-mode", "")

    const proseIcons = page.locator("prose-content svg")
    expect(await proseIcons.count()).toBeGreaterThan(0)
    await expect(page.locator("prose-content svg:visible")).toHaveCount(0)
  }
})
