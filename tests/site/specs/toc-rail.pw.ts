import { expect, test, type Page } from "@playwright/test"

const openRail = async (page: Page, height: number) => {
  await page.setViewportSize({ width: 1024, height })
  await page.goto("/blog/smart-eyes-stupid-hands", {
    waitUntil: "domcontentloaded",
  })

  const rail = page.locator("page-toc nav[data-rail]")
  await expect(rail).toBeVisible()
  return rail
}

test("keeps the TOC rail aligned with page navigation when space permits", async ({
  page,
}) => {
  const rail = await openRail(page, 768)

  await expect(rail).not.toHaveAttribute("data-edge", "")
})

test("moves a crowded TOC rail twelve pixels from the viewport edge", async ({
  page,
}) => {
  const rail = await openRail(page, 500)

  await expect(rail).toHaveAttribute("data-edge", "")
  const tickStart = await rail
    .locator("a")
    .first()
    .evaluate((anchor) => anchor.getBoundingClientRect().left)
  expect(tickStart).toBeCloseTo(12, 1)
})
