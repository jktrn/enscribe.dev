import {
  expect,
  test,
  type Frame,
  type Locator,
  type Page,
} from "@playwright/test"

const ARTICLE = "/blog/japan-retrospective"
const GISCUS_ORIGIN = "https://giscus.app"
const LOCAL_ORIGIN = `http://localhost:${process.env.SITE_PLAYWRIGHT_PORT ?? 4321}`
const HTTPS_ORIGIN = "https://site.enscribe.test"
const IFRAME = 'giscus-thread > iframe[title="Comments"]'
const SESSION_KEY = "giscus-session"
const THEME_PREFIX = "data:text/css;base64,"

const widgetMarkup = `<!doctype html>
<html data-giscus-mock>
  <body>
    <script>
      window.__receivedThemes = []
      addEventListener("message", (event) => {
        const theme = event.data?.giscus?.setConfig?.theme
        if (typeof theme === "string") window.__receivedThemes.push(theme)
      })
    </script>
  </body>
</html>`

const mockNetwork = async (page: Page) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())

    if (url.origin === GISCUS_ORIGIN && url.pathname === "/en/widget") {
      await route.fulfill({ contentType: "text/html", body: widgetMarkup })
      return
    }

    if (url.origin === HTTPS_ORIGIN) {
      const localUrl = new URL(`${url.pathname}${url.search}`, LOCAL_ORIGIN)
      const response = await page.request.fetch(localUrl.toString())
      await route.fulfill({ response })
      return
    }

    if (url.hostname === "localhost") {
      await route.continue()
      return
    }

    await route.abort("blockedbyclient")
  })
}

const visitArticle = async (
  page: Page,
  path = ARTICLE,
  origin = LOCAL_ORIGIN,
) => {
  await mockNetwork(page)
  await page.goto(new URL(path, origin).toString(), {
    waitUntil: "domcontentloaded",
  })
  const iframe = page.locator(IFRAME)
  await expect(iframe).toHaveAttribute(
    "src",
    /^https:\/\/giscus\.app\/en\/widget\?/,
  )
  return iframe
}

const widgetUrl = async (iframe: Locator) => {
  const source = await iframe.getAttribute("src")
  if (!source) throw new Error("Giscus iframe has no source URL")
  return new URL(source)
}

const loadWidget = async (page: Page, iframe: Locator) => {
  await iframe.scrollIntoViewIfNeeded()
  await expect(iframe).not.toHaveClass(/giscus-frame--loading/)
  await expect(iframe).not.toHaveAttribute("style", /opacity/)
  await expect(
    page.frameLocator(IFRAME).locator("html[data-giscus-mock]"),
  ).toBeAttached()

  const frame = page
    .frames()
    .find((candidate) =>
      candidate.url().startsWith(`${GISCUS_ORIGIN}/en/widget?`),
    )
  if (!frame) throw new Error("Mock Giscus frame did not load")
  return frame
}

const emitFromWidget = (frame: Frame, message: Record<string, unknown>) =>
  frame.evaluate((giscus) => parent.postMessage({ giscus }, "*"), message)

const receivedThemes = (frame: Frame) =>
  frame.evaluate(
    () =>
      (window as typeof window & { __receivedThemes: string[] })
        .__receivedThemes,
  )

const decodeTheme = (theme: string | null) => {
  if (!theme?.startsWith(THEME_PREFIX)) {
    throw new Error("Giscus did not receive an inline custom theme")
  }
  return Buffer.from(theme.slice(THEME_PREFIX.length), "base64").toString()
}

const localizeTheme = (theme: string, origin: string) =>
  `${THEME_PREFIX}${Buffer.from(
    decodeTheme(theme).replaceAll("https://enscribe.dev/", `${origin}/`),
  ).toString("base64")}`

test("loads Giscus with the post identity and a same-origin HTTPS theme", async ({
  page,
}) => {
  const iframe = await visitArticle(page, ARTICLE, HTTPS_ORIGIN)
  const widget = await widgetUrl(iframe)
  const params = widget.searchParams
  const cleanUrl = new URL(page.url())
  const authOrigin = new URL(cleanUrl)
  authOrigin.hash = "comments"

  expect(params.get("origin")).toBe(authOrigin.toString())
  expect(params.get("backLink")).toBe(cleanUrl.toString())
  expect(params.get("term")).toBe("blog/japan-retrospective")
  expect(params.get("repo")).toBe("jktrn/enscribe.dev")
  expect(params.get("strict")).toBe("1")
  expect(params.get("emitMetadata")).toBe("1")

  const css = decodeTheme(params.get("theme"))
  const fontUrls = [...css.matchAll(/https?:\/\/[^)"']+\.woff2/g)].map(
    ([url]) => url,
  )

  expect(fontUrls.length).toBeGreaterThan(0)
  expect(fontUrls.every((url) => new URL(url).protocol === "https:")).toBe(true)
  expect(css).toContain(`${cleanUrl.origin}/fonts/MDLorien-Regular.woff2`)
  expect(css).not.toContain(`${LOCAL_ORIGIN}/fonts/`)

  const frame = await loadWidget(page, iframe)
  await expect
    .poll(async () => (await receivedThemes(frame)).at(-1))
    .toBe(params.get("theme"))
})

test("accepts resize and count messages only from its Giscus frame", async ({
  page,
}) => {
  const iframe = await visitArticle(page)
  const frame = await loadWidget(page, iframe)
  const count = page.locator("post-comments [data-count]")

  await emitFromWidget(frame, {
    resizeHeight: 347,
    discussion: { totalCommentCount: 4 },
  })
  await expect(iframe).toHaveCSS("height", "347px")
  await expect(count).toHaveText("(4)")

  await page.evaluate(
    ({ origin, iframeSelector }) => {
      const iframe = document.querySelector<HTMLIFrameElement>(iframeSelector)
      if (!iframe?.contentWindow) throw new Error("Giscus iframe is missing")
      const forged = {
        giscus: { resizeHeight: 999, discussion: { totalCommentCount: 99 } },
      }

      dispatchEvent(
        new MessageEvent("message", {
          data: forged,
          origin: "https://untrusted.example",
          source: iframe.contentWindow,
        }),
      )
      dispatchEvent(
        new MessageEvent("message", {
          data: forged,
          origin,
          source: window,
        }),
      )
    },
    { origin: GISCUS_ORIGIN, iframeSelector: IFRAME },
  )

  await expect(iframe).toHaveCSS("height", "347px")
  await expect(count).toHaveText("(4)")
})

test("synchronizes themes and clears a signed-out session", async ({
  page,
}) => {
  const iframe = await visitArticle(page, `${ARTICLE}?giscus=test-session`)
  await expect.poll(() => new URL(page.url()).search).toBe("")

  const initialWidget = await widgetUrl(iframe)
  expect(initialWidget.searchParams.get("session")).toBe("test-session")
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), SESSION_KEY))
    .toBe(JSON.stringify("test-session"))

  const frame = await loadWidget(page, iframe)
  const darkTheme = await page
    .locator("giscus-thread")
    .getAttribute("data-theme-dark")
  expect(darkTheme).toBeTruthy()

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark"
  })
  await expect
    .poll(async () => (await receivedThemes(frame)).at(-1))
    .toBe(localizeTheme(darkTheme!, new URL(page.url()).origin))

  await emitFromWidget(frame, { signOut: true })
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), SESSION_KEY))
    .toBeNull()
  await expect
    .poll(async () => (await widgetUrl(iframe)).searchParams.has("session"))
    .toBe(false)
})

test("mounts Giscus when session storage is unavailable", async ({ page }) => {
  await page.addInitScript((key) => {
    const nativeGet = Storage.prototype.getItem
    const nativeSet = Storage.prototype.setItem
    const nativeRemove = Storage.prototype.removeItem
    const denied = () =>
      new DOMException("Storage is disabled", "SecurityError")

    Storage.prototype.getItem = function (name) {
      if (name === key) throw denied()
      return nativeGet.call(this, name)
    }
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw denied()
      nativeSet.call(this, name, value)
    }
    Storage.prototype.removeItem = function (name) {
      if (name === key) throw denied()
      nativeRemove.call(this, name)
    }
  }, SESSION_KEY)

  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))
  const iframe = await visitArticle(page)

  await loadWidget(page, iframe)
  expect(pageErrors).toEqual([])
})

test("keeps the mobile Discuss action visible and jumps to comments", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await visitArticle(page)
  const discuss = page.locator('post-actions a[aria-label="Discuss"]')

  await expect(discuss).toBeVisible()
  await expect(discuss).toHaveAttribute("href", "#comments")
  const before = await page.evaluate(() => scrollY)
  await discuss.click()

  await expect(page).toHaveURL(/#comments$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
  await expect
    .poll(() =>
      page.locator("#comments").evaluate((comments) => {
        const bounds = comments.getBoundingClientRect()
        return bounds.top < innerHeight && bounds.bottom > 0
      }),
    )
    .toBe(true)
})
