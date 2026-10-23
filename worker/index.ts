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

async function banner(request: Request, env: Env): Promise<Response> {
  const slot = bannerSlot(new Date())
  const etag = `"banner-${slot}"`
  const headers = new Headers({
    "content-type": "image/webp",
    "cache-control": "no-cache, max-age=0, must-revalidate",
    etag,
  })
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers })
  }
  const asset = await env.ASSETS.fetch(
    new URL(`/banners/banner-${slot}.webp`, request.url),
  )
  if (!asset.ok) return asset
  return new Response(asset.body, { status: 200, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (BANNER_PATHS.has(url.pathname)) return banner(request, env)
    return env.ASSETS.fetch(request)
  },
}
