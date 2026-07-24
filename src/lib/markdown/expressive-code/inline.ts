import type { ElementContent, Properties } from "hast"
import { select } from "hast-util-select"
import { h } from "hastscript"
import type {} from "mdast-util-to-hast"
import { defineMdastPlugin } from "satteri"
import {
  type ExpressiveCode,
  ExpressiveCodeBlock,
  type ExpressiveCodeTheme,
} from "satteri-expressive-code"
import {
  parseCodeAnnotations,
  stripCodeAnnotationTags,
} from "../code-annotations"
import { loadIcon } from "../../assets/icons"
import { ecRenderer } from "./config"

const ANNOTATION = /^(.+?)\{:([^}]+)\}$/
const PLACEHOLDER = /<[a-z][a-z0-9_-]*>/g

type Annotation =
  | { kind: "lang"; code: string; lang: string }
  | { kind: "scope"; code: string; scope: string }
  | { kind: "path"; code: string; path: "folder" | "file" }

export type RenderedInlineCode = {
  value: string
  copy?: string
  command: boolean
  properties: Properties
  children: ElementContent[]
}

function parseAnnotation(value: string): Annotation | null {
  const match = ANNOTATION.exec(value)
  if (!match) return null
  const [, code, tag] = match
  if (!code || tag === ".") return null
  if (tag === "dir" || tag === "file")
    return { kind: "path", code, path: tag === "dir" ? "folder" : "file" }
  return tag.startsWith(".")
    ? { kind: "scope", code, scope: tag.slice(1) }
    : { kind: "lang", code, lang: tag }
}

const raw = (value: string): ElementContent => ({ type: "raw", value })

export function plainCodeValue(value: string): string {
  const code = stripCodeAnnotationTags(value.replace(/\{:[^}]+\}$/, ""))
  return code.startsWith("$ ") && code.length > 2 ? code.slice(2) : code
}

const pathIcons: Record<string, string> = {
  folder: loadIcon("code/folder"),
  file: loadIcon("code/file"),
}

function pathChildren(code: string, kind: "folder" | "file"): ElementContent[] {
  const pieces: ElementContent[] = []
  let last = 0
  for (const match of code.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0
    if (start > last)
      pieces.push({ type: "text", value: code.slice(last, start) })
    pieces.push(h("span", { className: ["code-placeholder"] }, match[0]))
    last = start + match[0].length
  }
  if (last < code.length) pieces.push({ type: "text", value: code.slice(last) })

  const icon = raw(pathIcons[kind])
  const first = pieces[0]
  const prefix =
    first?.type === "text" ? /^\S{1,8}/.exec(first.value)?.[0] : undefined
  if (first?.type === "text" && prefix) {
    const remainder = first.value.slice(prefix.length)
    const glue: ElementContent = {
      type: "element",
      tagName: "span",
      properties: { dataCodePathGlue: "" },
      children: [icon, { type: "text", value: prefix }],
    }
    const rest = pieces.slice(1)
    return remainder
      ? [glue, { type: "text", value: remainder }, ...rest]
      : [glue, ...rest]
  }
  return [icon, ...pieces]
}

async function highlightLanguage(
  ec: ExpressiveCode,
  code: string,
  lang: string,
): Promise<ElementContent[]> {
  const block = new ExpressiveCodeBlock({ code, language: lang })
  const { renderedGroupAst } = await ec.render(block)
  const tokens = select(".ec-line .code", renderedGroupAst)?.children
  return tokens ?? [{ type: "text", value: code }]
}

function highlightScope(
  ec: ExpressiveCode,
  code: string,
  scope: string,
): ElementContent[] {
  const [light, dark] = ec.styleVariants
  const c0 = resolveScopeColor(light.theme, scope)
  const c1 = resolveScopeColor(dark.theme, scope)
  return [h("span", { style: `--0:${c0};--1:${c1}` }, code)]
}

function resolveScopeColor(theme: ExpressiveCodeTheme, scope: string): string {
  const best = (theme.settings ?? [])
    .flatMap((rule) =>
      (rule.scope ?? []).map((s) => ({ s, fg: rule.settings.foreground })),
    )
    .filter(({ s, fg }) => fg && (scope === s || scope.startsWith(`${s}.`)))
    .sort((a, b) => b.s.length - a.s.length)[0]
  return best?.fg ?? theme.fg
}

export async function renderInlineCodeValue(
  value: string,
): Promise<RenderedInlineCode | null> {
  const annotation = parseAnnotation(value)
  let code = annotation?.code ?? value
  const command = code.startsWith("$ ") && code.length > 2
  if (command) code = code.slice(2)
  const tones = parseCodeAnnotations(code)

  if (!annotation && !command && !tones) return null

  const properties: Properties = {}
  let children: ElementContent[]

  if (tones) {
    children = tones
  } else if (annotation?.kind === "path") {
    children = pathChildren(code, annotation.path)
    properties.dataCodePath = annotation.path
  } else if (annotation?.kind === "lang") {
    const { ec } = await ecRenderer
    children = await highlightLanguage(ec, code, annotation.lang)
    properties.dataEc = ""
    properties.dataLanguage = annotation.lang
  } else if (annotation?.kind === "scope") {
    const { ec } = await ecRenderer
    children = highlightScope(ec, code, annotation.scope)
    properties.dataEc = ""
  } else {
    children = [{ type: "text", value: code }]
  }

  const plain = tones ? stripCodeAnnotationTags(code) : code
  return {
    value: plain,
    copy: command ? stripCodeAnnotationTags(code) : undefined,
    command,
    properties,
    children,
  }
}

export const inlineExpressiveCode = defineMdastPlugin({
  name: "inline-expressive-code",
  async inlineCode(node, ctx) {
    try {
      const rendered = await renderInlineCodeValue(node.value)
      if (!rendered) return

      if (rendered.command) {
        const copy = rendered.copy ?? rendered.value
        ctx.setProperty(node, "value", copy)
        ctx.setProperty(node, "data", {
          hName: "copy-command",
          hProperties: {
            role: "button",
            tabIndex: 0,
            dataCopy: copy,
            title: `Copy: ${copy}`,
            ariaLabel: `Copy command: ${copy}`,
          },
          hChildren: [
            h("code", rendered.properties, [
              h("span", { className: ["shell-prompt"], ariaHidden: "true" }),
              ...rendered.children,
            ]),
          ],
        })
        return
      }

      ctx.setProperty(node, "value", rendered.value)
      ctx.setProperty(node, "data", {
        hName: "code",
        hProperties: rendered.properties,
        hChildren: rendered.children,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      ctx.report({
        message: `inline-expressive-code: failed on \`${node.value}\`: ${reason}`,
        node,
        severity: "warning",
      })
    }
  },
})
