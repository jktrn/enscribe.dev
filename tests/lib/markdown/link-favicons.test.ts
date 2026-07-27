import { describe, expect, test } from "bun:test"
import { markdownToHtml } from "satteri"
import { inlineAcronyms } from "@/lib/markdown/acronyms"
import { linkFavicons } from "@/lib/markdown/link-favicons"

const render = async (markdown: string) => {
  const result = await Promise.resolve(
    markdownToHtml(markdown, { hastPlugins: [linkFavicons] }),
  )
  return result.html
}

describe("inline link favicons", () => {
  test("renders an approved monochrome brand icon without remote fetching", async () => {
    const html = await render(
      "[Wikipedia](https://en.wikipedia.org/wiki/Example)",
    )

    expect(html).toContain('data-favicon-icon="simple-wikipedia.svg"')
    expect(html).toContain("/icons/favicons/simple-wikipedia.svg")
    expect(html).not.toContain("google.com/s2")
    expect(html).not.toContain("<img")
  })

  test("renders the generic external cue for an unknown hostname", async () => {
    const html = await render("[Example](https://unknown.example/path)")

    expect(html).toContain('data-favicon-icon="custom-external-link.svg"')
    expect(html).toContain("/icons/favicons/custom-external-link.svg")
  })

  test("glues the icon to trailing text", async () => {
    const textLink = await render("[Wikipedia](https://en.wikipedia.org)")

    expect(textLink).toContain("data-favicon-glue")
    expect(textLink).toMatch(
      /W<span[^>]+data-favicon-glue="">ikipedia<span[^>]+data-favicon/,
    )
    expect(textLink).toContain('data-favicon-position="after"')
    expect(textLink).toContain('data-linebreak-atom=""')
    expect(textLink).toContain('data-linebreak-decoration=""')
  })

  test("decorates trailing inline markup instead of atomizing it", async () => {
    const emphasizedLink = await render(
      "[*Wikipedia*](https://en.wikipedia.org)",
    )

    expect(emphasizedLink).not.toContain("data-favicon-glue")
    expect(emphasizedLink).not.toContain("data-linebreak-atom")
    expect(emphasizedLink).toMatch(
      /<em>Wikipedia<span[^>]+data-favicon[^>]*><\/span><\/em>/,
    )
    expect(emphasizedLink).toContain(
      'data-linebreak-decoration-position="after"',
    )
  })

  test("leaves internal and media links undecorated", async () => {
    const internal = await render("[Blog](/blog)")
    const media = await render(
      "[![Example image](https://example.com/image.png)](https://example.com)",
    )

    expect(internal).not.toContain("data-favicon")
    expect(media).not.toContain("data-favicon")
  })

  test("preserves acronyms through external-link favicon wrapping", async () => {
    const result = await Promise.resolve(
      markdownToHtml(
        "[SECCON](https://www.seccon.jp/) and [DEF CON](https://defcon.org/) on an [FR LH](https://example.com/) guitar",
        { hastPlugins: [linkFavicons, inlineAcronyms] },
      ),
    )

    for (const value of ["SECCON", "DEF", "CON", "FR", "LH"]) {
      expect(result.html).toContain(`<span data-acronym="">${value}</span>`)
    }
    expect(result.html).toMatch(
      /data-favicon-glue=""><span data-acronym="">SECCON<\/span>/,
    )
  })
})
