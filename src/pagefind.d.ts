declare module "*/pagefind.js" {
  export type PagefindResult = {
    data: () => Promise<{
      url: string
      excerpt: string
      meta: { title?: string }
    }>
  }

  export function init(): void
  export function debouncedSearch(
    query: string,
  ): Promise<{ results: PagefindResult[] } | null>
}
