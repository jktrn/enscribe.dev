import type { Element, ElementContent, Root } from "hast"
import { defineHastPlugin, type HastVisitorContext } from "satteri"
import { plainText } from "./hast-text"

const WORDS_PER_MINUTE = 220
const CODE_STUDIED_LINES = 10
const CODE_STUDIED_SECONDS = 1.5
const CODE_SKIMMED_SECONDS = 0.4
const CODE_OUTPUT_SECONDS = 0.25
const CODE_BLOCK_MAX_SECONDS = 45
const IMAGE_STUDIED_COUNT = 10
const IMAGE_FIRST_SECONDS = 12
const IMAGE_FLOOR_SECONDS = 3
const IMAGE_SKIMMED_SECONDS = 2
const DISPLAY_MATH_SECONDS = 8
const INLINE_MATH_SECONDS = 1.5

const WORDLIKE = /[\p{L}\p{N}]/u
const SHELL_PROMPT = /^\s*\$ /
const TAG = /<[^>]*>/g

type Tally = { seconds: number; words: number; images: number }

const countWords = (value: string) =>
  value.split(/\s+/).filter((token) => WORDLIKE.test(token)).length

const isCodeBlock = (node: Readonly<Element>) =>
  node.tagName === "pre" &&
  node.children.some(
    (child) => child.type === "element" && child.tagName === "code",
  )

const codeSeconds = (code: string) => {
  const lines = code.replace(/\n+$/, "").split("\n")
  const transcript = lines.some((line) => SHELL_PROMPT.test(line))
  let seconds = 0
  let studied = 0
  for (const line of lines) {
    if (transcript && !SHELL_PROMPT.test(line)) {
      seconds += CODE_OUTPUT_SECONDS
      continue
    }
    seconds +=
      studied < CODE_STUDIED_LINES ? CODE_STUDIED_SECONDS : CODE_SKIMMED_SECONDS
    studied += 1
  }
  return Math.min(seconds, CODE_BLOCK_MAX_SECONDS)
}

const imageSeconds = (seen: number) =>
  seen < IMAGE_STUDIED_COUNT
    ? Math.max(IMAGE_FLOOR_SECONDS, IMAGE_FIRST_SECONDS - seen)
    : IMAGE_SKIMMED_SECONDS

function addRaw(value: string, tally: Tally) {
  if (value.includes("<math-display")) tally.seconds += DISPLAY_MATH_SECONDS
  else if (value.includes("<math")) tally.seconds += INLINE_MATH_SECONDS
  else tally.words += countWords(value.replace(TAG, " "))
}

function addElement(node: Readonly<Element>, tally: Tally) {
  if (node.tagName === "svg") return
  if (node.tagName === "img") {
    tally.seconds += imageSeconds(tally.images)
    tally.images += 1
    return
  }
  if (isCodeBlock(node)) {
    tally.seconds += codeSeconds(plainText(node))
    return
  }
  walk(node.children, tally)
}

function walk(nodes: readonly ElementContent[], tally: Tally) {
  for (const node of nodes) {
    if (node.type === "text") tally.words += countWords(node.value)
    else if (node.type === "raw") addRaw(node.value, tally)
    else if (node.type === "element") addElement(node, tally)
  }
}

export function readingMinutes(nodes: readonly ElementContent[]): number {
  const tally: Tally = { seconds: 0, words: 0, images: 0 }
  walk(nodes, tally)
  const minutes = tally.seconds / 60 + tally.words / WORDS_PER_MINUTE
  return Math.max(1, Math.round(minutes))
}

export const readingTime = defineHastPlugin({
  name: "reading-time",
  before(root: Readonly<Root>, ctx: HastVisitorContext) {
    const frontmatter = (
      ctx.data.astro as { frontmatter?: Record<string, unknown> } | undefined
    )?.frontmatter
    if (!frontmatter) return
    frontmatter.readingMinutes = readingMinutes(
      root.children as ElementContent[],
    )
  },
})
