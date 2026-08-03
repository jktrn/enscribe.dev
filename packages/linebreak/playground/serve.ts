import { dirname, join, normalize } from "node:path"

const root = join(dirname(Bun.fileURLToPath(import.meta.url)), "dist")
const port = Number(process.env.PORT ?? 5173)

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".woff2": "font/woff2",
}

const typeOf = (path: string) => {
  const dot = path.lastIndexOf(".")
  return TYPES[path.slice(dot)] ?? "application/octet-stream"
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    const relative = normalize(decodeURIComponent(url.pathname)).replace(
      /^(\.\.[/\\])+/,
      "",
    )
    const path = join(root, relative === "/" ? "index.html" : relative)
    const file = Bun.file(path)
    if (!(await file.exists()))
      return new Response("not found", { status: 404 })
    return new Response(file, {
      headers: { "content-type": typeOf(path), "cache-control": "no-store" },
    })
  },
})

console.log(`playground: http://localhost:${server.port}`)
