interface Assets {
  fetch(request: Request | URL): Promise<Response>
}

interface Env {
  ASSETS: Assets
}

const TIME_ZONE = "America/Los_Angeles"
const SLOT_HOURS = 2
const BANNER_PATHS = new Set(["/banner", "/banner.webp"])

function bannerSlot(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  )
  return String(Math.floor(hour / SLOT_HOURS) * SLOT_HOURS).padStart(2, "0")
}

async function banner(url: URL, env: Env): Promise<Response> {
  const slot = bannerSlot(new Date())
  const asset = await env.ASSETS.fetch(
    new URL(`/banners/banner-${slot}.webp`, url),
  )
  if (!asset.ok) return asset
  const headers = new Headers(asset.headers)
  headers.set("content-type", "image/webp")
  headers.set("cache-control", "no-cache, max-age=0, must-revalidate")
  headers.set("etag", `"banner-${slot}"`)
  headers.delete("last-modified")
  return new Response(asset.body, { status: 200, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (BANNER_PATHS.has(url.pathname)) return banner(url, env)
    return env.ASSETS.fetch(request)
  },
}
