import { fetchDiscussion } from "@/lib/discussions"

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  GITHUB_TOKEN?: string
}

const REPO = "jktrn/enscribe.dev"
const CATEGORY = "Comments"
const ROUTE = "/api/comments"

function json(body: unknown, status: number, cache?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (cache) headers["cache-control"] = cache
  return new Response(JSON.stringify(body), { status, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== ROUTE) return env.ASSETS.fetch(request)

    const term = url.searchParams.get("term")
    if (!term) return json({ error: "Missing term" }, 400)
    if (!env.GITHUB_TOKEN) return json({ error: "Token not configured" }, 500)

    try {
      const discussion = await fetchDiscussion({
        token: env.GITHUB_TOKEN,
        repo: REPO,
        category: CATEGORY,
        term,
      })
      return json(discussion, 200, "public, max-age=60, s-maxage=300")
    } catch (error) {
      return json({ error: (error as Error).message }, 502)
    }
  },
}
