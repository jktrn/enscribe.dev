import { describe, expect, test } from "bun:test"
import { renderInline } from "@/lib/markdown/inline-markdown"

const acronym = (value: string) => `<span data-acronym="">${value}</span>`

describe("renderInline acronym wrapping", () => {
  test("wraps a bare acronym", async () => {
    expect(await renderInline("the CTF scene")).toContain(acronym("CTF"))
  })

  test("wraps two-letter acronyms", async () => {
    const html = await renderInline("AI research on a FR LH guitar")
    expect(html).toContain(acronym("AI"))
    expect(html).toContain(acronym("FR"))
    expect(html).toContain(acronym("LH"))
  })

  test("wraps the capital run inside a mixed-case word", async () => {
    const html = await renderInline("the picoCTF 2022 event")
    expect(html).toContain(`pico${acronym("CTF")}`)
  })

  test("leaves a plural s outside the span", async () => {
    expect(await renderInline("several CTFs happened")).toContain(
      `${acronym("CTF")}s happened`,
    )
  })

  test("donates the last capital to a following camel word", async () => {
    expect(await renderInline("the JSONParser type")).toContain(
      `${acronym("JSON")}Parser`,
    )
  })

  test("keeps trailing digits inside the span", async () => {
    expect(await renderInline("a SHA256 digest")).toContain(acronym("SHA256"))
  })

  test("wraps acronyms inside link text", async () => {
    const html = await renderInline(
      "[Project Sekai CTF](https://ctf.sekai.team)",
    )
    expect(html).toContain(acronym("CTF"))
    expect(html).toContain("<a href")
  })

  test("wraps acronyms inside emphasis", async () => {
    expect(await renderInline("truly *OSINT* work")).toContain(
      `<em>${acronym("OSINT")}</em>`,
    )
  })

  test("does not style acronyms inside code", async () => {
    const html = await renderInline("`SECCON` beside SECCON")
    expect(html.match(/data-acronym/g)).toHaveLength(1)
    expect(html).toContain("<code")
  })

  test("leaves Roman numerals as capitals", async () => {
    const html = await renderInline("Rocky IV and Louis XVI in DC")
    expect(html).not.toContain("data-acronym")
  })

  test("leaves ordinary words untouched", async () => {
    const html = await renderInline("It was I who did it")
    expect(html).not.toContain("data-acronym")
  })
})
