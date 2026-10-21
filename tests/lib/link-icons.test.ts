import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import {
  DEFAULT_LINK_ICON,
  linkIconAssetPath,
  linkIconAssets,
  linkIconForHost,
} from "@/lib/link-icons"

describe("inline link icons", () => {
  test("uses a custom icon for a mapped hostname", () => {
    expect(linkIconForHost("bandcamp.com")).toBe("simple-bandcamp.svg")
    expect(linkIconForHost("whirrband.bandcamp.com")).toBe(
      "simple-bandcamp.svg",
    )
    expect(linkIconForHost("en.wikipedia.org")).toBe("simple-wikipedia.svg")
    expect(linkIconForHost("github.com")).toBe("phosphor-github-logo.svg")
    expect(linkIconForHost("instagram.com")).toBe("phosphor-instagram-logo.svg")
    expect(linkIconForHost("sekai.team")).toBe("custom-sekai.svg")
    expect(linkIconForHost("openai.com")).toBe("simple-openai.svg")
    expect(linkIconForHost("v12.sh")).toBe("custom-v12.svg")
    expect(linkIconForHost("zellic.io")).toBe("custom-zellic.svg")
  })

  test("covers subdomains of a mapped domain", () => {
    expect(linkIconForHost("demo.rctf.osec.io")).toBe("custom-ottersec.svg")
    expect(linkIconForHost("2026.ctf.sekai.team")).toBe("custom-sekai.svg")
    expect(linkIconForHost("2025.ctf.mt")).toBe("custom-maltactf.svg")
    expect(linkIconForHost("ctf.mt")).toBe("custom-maltactf.svg")
  })

  test("normalizes www, casing, and a trailing dot", () => {
    expect(linkIconForHost("WWW.YouTube.com.")).toBe(
      "phosphor-youtube-logo.svg",
    )
  })

  test("uses the generic external-link icon for every unmapped hostname", () => {
    expect(linkIconForHost("networkx.org")).toBe(DEFAULT_LINK_ICON)
    expect(linkIconForHost("unknown.example")).toBe(DEFAULT_LINK_ICON)
  })

  test("has every referenced SVG vendored", () => {
    expect(linkIconAssets).toHaveLength(36)
    for (const asset of linkIconAssets) {
      expect(existsSync(linkIconAssetPath(asset))).toBe(true)
    }
  })
})
