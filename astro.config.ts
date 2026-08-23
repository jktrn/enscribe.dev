import { defineConfig } from "astro/config"
import sitemap from "@astrojs/sitemap"
import { satteri } from "@astrojs/markdown-satteri"
import { hastPlugins, mdastPlugins } from "./src/lib/markdown"
import { fetchDiscussion } from "./src/lib/discussions"

export default defineConfig({
  site: "https://enscribe.dev",
  server: { port: 4321 },
  compressHTML: true,
  prefetch: { prefetchAll: true },
  vite: {
    resolve: { tsconfigPaths: true },
    build: { rollupOptions: { external: ["/pagefind/pagefind.js"] } },
    plugins: [
      {
        name: "pagefind-dev-external",
        apply: "serve",
        resolveId: (id: string) =>
          id === "/pagefind/pagefind.js" ? { id, external: true } : null,
      },
      {
        name: "comments-api-dev",
        apply: "serve",
        configureServer(server) {
          server.middlewares.use("/api/comments", async (request, response) => {
            const term = new URL(
              request.url ?? "",
              "http://localhost",
            ).searchParams.get("term")
            const token = process.env.GITHUB_TOKEN
            response.setHeader("content-type", "application/json")

            if (!term || !token) {
              response.statusCode = term ? 500 : 400
              response.end(
                JSON.stringify({
                  error: term ? "GITHUB_TOKEN is not set" : "Missing term",
                }),
              )
              return
            }

            try {
              const discussion = await fetchDiscussion({
                token,
                repo: "jktrn/enscribe.dev",
                category: "Comments",
                term,
              })
              response.end(JSON.stringify(discussion))
            } catch (error) {
              response.statusCode = 502
              response.end(JSON.stringify({ error: (error as Error).message }))
            }
          })
        },
      },
    ],
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !/\/blog\/[^/]+\/[^/]+\/?$/.test(page) &&
        !/\/authors\/[^/]+\/?$/.test(page) &&
        !page.includes("/tags/") &&
        !page.includes("/fixtures/") &&
        !/\/music\/?$/.test(page) &&
        !/\.(md|txt|xml)\/?$/.test(page),
    }),
  ],
  markdown: {
    syntaxHighlight: false,
    processor: satteri({
      features: { directive: true, math: true, smartPunctuation: true },
      mdastPlugins,
      hastPlugins,
    }),
  },
})
