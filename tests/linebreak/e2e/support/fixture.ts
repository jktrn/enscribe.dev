import { expect, type Page } from "@playwright/test"
import type { FixtureApi } from "../fixture"

type FixtureMethod = keyof FixtureApi

export const openFixture = async (page: Page) => {
  const response = await page.goto("/")
  expect(response?.status()).toBe(200)
  await expect
    .poll(() =>
      page.evaluate(() => typeof window.linebreakFixture === "object"),
    )
    .toBe(true)
}

export const invoke = <Method extends FixtureMethod>(
  page: Page,
  method: Method,
): Promise<ReturnType<FixtureApi[Method]>> =>
  page.evaluate<ReturnType<FixtureApi[Method]>, Method>(
    (name) => window.linebreakFixture[name]() as ReturnType<FixtureApi[Method]>,
    method,
  )
