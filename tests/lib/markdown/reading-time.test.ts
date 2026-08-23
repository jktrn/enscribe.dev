import { describe, expect, test } from "bun:test"
import { markdownToHtml } from "satteri"
import { temmlMath } from "@/lib/markdown/math"
import { readingTime } from "@/lib/markdown/reading-time"

const minutes = (source: string): number => {
  const astro = {
    frontmatter: {} as Record<string, unknown>,
    headings: [],
    localImagePaths: new Set<string>(),
    remoteImagePaths: new Set<string>(),
  }
  markdownToHtml(source, {
    features: { math: true, smartPunctuation: true },
    mdastPlugins: [temmlMath],
    hastPlugins: [readingTime],
    data: { astro },
  })
  return astro.frontmatter.readingMinutes as number
}

const words = (count: number) => Array(count).fill("word").join(" ")

const fence = (lines: number, language = "python") =>
  `\`\`\`${language}\n${Array(lines).fill("value = 1").join("\n")}\n\`\`\``

const blocks = (count: number, block: string) =>
  Array(count).fill(block).join("\n\n")

describe("readingTime prose", () => {
  test("reads 220 words per minute", () => {
    expect(minutes(words(220))).toBe(1)
    expect(minutes(words(2200))).toBe(10)
  })

  test("never reports less than a minute", () => {
    expect(minutes("hi")).toBe(1)
    expect(minutes("")).toBe(1)
  })

  test("ignores markup that carries no prose", () => {
    expect(minutes(`${words(440)}\n\n:svg[icons/code/rust]`)).toBe(2)
  })
})

describe("readingTime code", () => {
  test("charges more for the first lines of a block than the rest", () => {
    const base = minutes(words(220))
    const head = minutes(blocks(20, fence(10)))
    const tail = minutes(blocks(20, fence(20)))
    expect(head).toBeGreaterThan(base)
    expect(tail - head).toBeLessThan(head - base)
  })

  test("caps a single block at 45 seconds", () => {
    expect(minutes(fence(200))).toBe(minutes(fence(2000)))
  })

  test("caps each block independently", () => {
    const one = minutes(fence(200))
    const two = minutes(`${fence(200)}\n\n${fence(200)}`)
    expect(two).toBeGreaterThan(one)
  })

  test("skims terminal output faster than commands", () => {
    const transcript = ["```bash", "$ whoami", ...Array(40).fill("root"), "```"]
    const commands = ["```bash", ...Array(41).fill("$ whoami"), "```"]
    expect(minutes(blocks(20, transcript.join("\n")))).toBeLessThan(
      minutes(blocks(20, commands.join("\n"))),
    )
  })

  test("does not count code as prose", () => {
    expect(minutes(fence(1))).toBe(1)
    expect(minutes(fence(500))).toBe(1)
  })
})

describe("readingTime media", () => {
  test("charges less attention to each successive image", () => {
    const image = "![alt](./a.png)"
    const base = minutes(words(220))
    const few = minutes(`${words(220)}\n\n${blocks(5, image)}`)
    const many = minutes(`${words(220)}\n\n${blocks(30, image)}`)
    expect(few).toBeGreaterThan(base)
    expect(many - few).toBeLessThan(25 * (few - base))
  })

  test("charges a fixed cost for display math", () => {
    const equations = Array(15).fill("$$\na = b\n$$").join("\n\n")
    expect(minutes(`${words(220)}\n\n${equations}`)).toBe(3)
  })
})
