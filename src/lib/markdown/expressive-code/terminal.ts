import {
  AttachedPluginData,
  definePlugin,
  ExpressiveCodeBlock,
  type ExpressiveCodePlugin,
} from "satteri-expressive-code"
import {
  type Element,
  type ElementContent,
  h,
  select,
  selectAll,
} from "satteri-expressive-code/hast"
import { ecRenderer } from "./config"
import { codeToneData } from "./tones"

const TERMINAL_LANGUAGES = new Set([
  "ansi",
  "bash",
  "sh",
  "shell",
  "shellscript",
  "shellsession",
  "zsh",
  "console",
])

const isTerminalLanguage = (language: string) =>
  TERMINAL_LANGUAGES.has(language)

interface ShellPromptData {
  promptLines: Set<number>
}

const shellPromptData = new AttachedPluginData<ShellPromptData>(() => ({
  promptLines: new Set<number>(),
}))

export function pluginShellPrompts(): ExpressiveCodePlugin {
  return definePlugin({
    name: "Shell Prompts",
    baseStyles: `
      .shell-prompt {
        margin-inline-end: 1ch;
        color: var(--muted-foreground);
        font-weight: var(--font-weight-medium);
        user-select: none;
        -webkit-user-select: none;
      }
      .shell-prompt::before {
        content: "$";
      }
    `,
    hooks: {
      preprocessCode: ({ codeBlock }) => {
        if (
          codeBlock.props.frame !== "terminal" &&
          !isTerminalLanguage(codeBlock.language)
        )
          return

        const data = shellPromptData.getOrCreateFor(codeBlock)
        codeBlock.getLines().forEach((line, idx) => {
          if (line.text.startsWith("$ ")) {
            line.editText(0, 2, "")
            data.promptLines.add(idx)
          }
        })
      },
      postprocessRenderedLine: ({ codeBlock, lineIndex, renderData }) => {
        const data = shellPromptData.getOrCreateFor(codeBlock)
        if (!data.promptLines.has(lineIndex)) return

        const codeNode = select("div.code", renderData.lineAst)
        if (!codeNode) return
        codeNode.children.unshift(
          h("span", { class: "shell-prompt", "aria-hidden": "true" }),
        )
      },
    },
  })
}

function addClass(node: Element, className: string): void {
  const classes = node.properties?.className
  const arr = Array.isArray(classes) ? [...classes] : []
  if (!arr.includes(className)) arr.push(className)
  node.properties = { ...node.properties, className: arr }
}

function extractText(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element" || !node.children) return ""
  return node.children.map(extractText).join("")
}

function extractCommandText(codeNode: Element): string {
  const parts: string[] = []
  for (const child of codeNode.children) {
    if (
      child.type === "element" &&
      Array.isArray(child.properties?.className) &&
      child.properties.className.includes("shell-prompt")
    )
      continue
    parts.push(extractText(child))
  }
  return parts.join("")
}

async function highlightLines(
  lines: Element[],
  targets: number[],
  skip: Set<number>,
  language: string,
  keepPrompt: boolean,
): Promise<void> {
  const indices = targets.filter((index) => !skip.has(index))
  if (indices.length === 0) return

  const texts = indices.map((index) => {
    const codeNode = select("div.code", lines[index])
    return codeNode ? extractCommandText(codeNode) : ""
  })

  const { ec } = await ecRenderer
  const block = new ExpressiveCodeBlock({ code: texts.join("\n"), language })
  const { renderedGroupAst } = await ec.render(block)
  const rendered = selectAll(".ec-line div.code", renderedGroupAst)

  indices.forEach((index, i) => {
    const codeNode = select("div.code", lines[index])
    const tokens = rendered[i]
    if (!codeNode || !tokens) return
    const prompt = keepPrompt
      ? codeNode.children.find(
          (child) =>
            child.type === "element" &&
            Array.isArray(child.properties?.className) &&
            child.properties.className.includes("shell-prompt"),
        )
      : undefined
    codeNode.children = [...(prompt ? [prompt] : []), ...tokens.children]
  })
}

export function pluginOutputSeparators(): ExpressiveCodePlugin {
  return definePlugin({
    name: "Output Separators",
    baseStyles: `
      .ec-line.ec-cmd + .ec-line.ec-out,
      .ec-line.ec-out + .ec-line.ec-cmd {
        border-top: 2px solid color-mix(in oklab, var(--border) 75%, transparent);
        margin-top: var(--space-2xs);
        padding-top: var(--space-2xs);
      }
    `,
    hooks: {
      postprocessRenderedBlock: async ({ codeBlock, renderData }) => {
        if (!isTerminalLanguage(codeBlock.language)) return

        const lines = selectAll("div.ec-line", renderData.blockAst)
        if (lines.length === 0) return

        const commands: string[] = []
        const cmdLines: number[] = []
        const outLines: number[] = []
        let inContinuation = false

        lines.forEach((line, index) => {
          const codeNode = select("div.code", line)
          const hasPrompt = !!select("span.shell-prompt", line)
          const isCmd = hasPrompt || inContinuation

          if (isCmd) {
            addClass(line, "ec-cmd")
            cmdLines.push(index)
            const text = codeNode ? extractCommandText(codeNode) : ""
            if (hasPrompt || commands.length === 0) {
              commands.push(text)
            } else {
              commands[commands.length - 1] += `\n${text}`
            }
            inContinuation = /\\\s*$/.test(text)
          } else {
            addClass(line, "ec-out")
            outLines.push(index)
            inContinuation = false
          }
        })

        const toned = codeToneData.getOrCreateFor(codeBlock).tonedLines
        const cmdLang = codeBlock.metaOptions.getString("cmd")
        const outLang = codeBlock.metaOptions.getString("output")
        if (cmdLang) {
          await highlightLines(lines, cmdLines, toned, cmdLang, true)
        }
        if (outLang) {
          await highlightLines(lines, outLines, toned, outLang, false)
        }

        if (cmdLines.length === 0 || outLines.length === 0) return

        const copyButton = select(".copy button", renderData.blockAst)
        if (copyButton) {
          copyButton.properties = {
            ...copyButton.properties,
            dataCode: commands.join("\u007F"),
          }
        }
      },
    },
  })
}
