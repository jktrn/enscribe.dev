import { describe, expect, test } from "bun:test"
import { describeLink } from "@/lib/links"

const site = new URL("https://enscribe.dev")

describe("describeLink", () => {
  test("shows a link to this site as its path and keeps it in the tab", () => {
    const link = describeLink(
      "https://enscribe.dev/blog/japan-retrospective/",
      site,
    )
    expect(link.label).toBe("/blog/japan-retrospective")
    expect(link.href).toBe("/blog/japan-retrospective/")
    expect(link.external).toBe(false)
    expect(link.icon).toEndWith("/custom-enscribe.svg")
  })

  test("resolves a relative href against the site", () => {
    const link = describeLink("/blog/azusawas-gacha-world/", site)
    expect(link.label).toBe("/blog/azusawas-gacha-world")
    expect(link.external).toBe(false)
  })

  test("shows a profile on a handle host as its handle", () => {
    expect(
      describeLink("https://twitter.com/projectsekaictf", site).label,
    ).toBe("@projectsekaictf")
    expect(describeLink("https://x.com/es3n1n/", site).label).toBe("@es3n1n")
  })

  test("shows any other page on a handle host as the host", () => {
    expect(
      describeLink("https://twitter.com/es3n1n/status/1", site).label,
    ).toBe("twitter.com")
  })

  test("shows every other link as its host without www", () => {
    const link = describeLink("https://www.openai.com/index/evmbench/", site)
    expect(link.label).toBe("openai.com")
    expect(link.href).toBe("https://www.openai.com/index/evmbench/")
    expect(link.external).toBe(true)
  })
})
