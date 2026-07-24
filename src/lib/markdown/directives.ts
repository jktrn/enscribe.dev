import type { ElementContent } from "hast"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import type { List, ListItem, Paragraph, PhrasingContent } from "mdast"
import type {} from "mdast-util-to-hast"
import { defineMdastPlugin } from "satteri"
import { loadIcon } from "../assets/icons"

const icons: Record<string, string> = {
  folder: loadIcon("code/folder"),
  file: loadIcon("code/file"),
}

const raw = (value: string): ElementContent => ({ type: "raw", value })

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

type DirectiveNode = {
  name: string
  attributes?: Record<string, string | null | undefined> | null
  children?: Array<{ type: string; data?: unknown; children?: unknown[] }>
}

const directiveLabel = (node: DirectiveNode): Paragraph | null => {
  const first = node.children?.[0]
  const isLabel =
    first?.type === "paragraph" &&
    (first.data as { directiveLabel?: boolean } | undefined)?.directiveLabel ===
      true
  return isLabel ? (first as unknown as Paragraph) : null
}

const mdastText = (node: unknown): string => {
  const n = node as { value?: string; children?: unknown[] }
  if (typeof n.value === "string") return n.value
  return (n.children ?? []).map(mdastText).join("")
}

function inlineToHast(nodes: PhrasingContent[]): ElementContent[] {
  return nodes.flatMap((node): ElementContent[] => {
    switch (node.type) {
      case "text":
        return [{ type: "text", value: node.value }]
      case "inlineCode":
        return [h("code", node.value)]
      case "emphasis":
        return [h("em", inlineToHast(node.children))]
      case "strong":
        return [h("strong", inlineToHast(node.children))]
      default:
        return [{ type: "text", value: mdastText(node) }]
    }
  })
}

type TreeEntry = {
  name: string
  highlighted: boolean
  placeholder: boolean
  directory: boolean
  comment: ElementContent[]
  children: List | null
}

function parseTreeItem(item: ListItem): TreeEntry | null {
  const blocks = item.children ?? []
  const paragraph = blocks.find((child) => child.type === "paragraph") as
    | Paragraph
    | undefined
  const nested = (blocks.find((child) => child.type === "list") as List) ?? null
  const inline = paragraph?.children ?? []
  const first = inline[0]
  if (!first) return null

  let name = ""
  let highlighted = false
  const rest: PhrasingContent[] = inline.slice(1)

  if (first.type === "strong" || first.type === "inlineCode") {
    name = mdastText(first).trim()
    highlighted = first.type === "strong"
  } else if (first.type === "text") {
    name = first.value.trim()
    if (!name) return null
  } else {
    return null
  }

  return {
    name,
    highlighted,
    placeholder: name === "..." || name === "…",
    directory: name.endsWith("/") || nested !== null,
    comment: inlineToHast(rest).filter(
      (node) => !(node.type === "text" && !node.value.trim()),
    ),
    children: nested,
  }
}

function treeList(list: List): ElementContent {
  const items = (list.children ?? []).flatMap((item): ElementContent[] => {
    const entry = parseTreeItem(item)
    if (!entry) return []

    if (entry.placeholder) {
      return [h("li", [h("span", { className: ["tree-placeholder"] }, "…")])]
    }

    const row = [
      raw(icons[entry.directory ? "folder" : "file"]),
      h(
        "span",
        {
          className: entry.highlighted
            ? ["tree-name", "is-highlighted"]
            : ["tree-name"],
        },
        entry.name,
      ),
      ...(entry.comment.length > 0
        ? [h("span", { className: ["tree-comment"] }, entry.comment)]
        : []),
    ]

    if (entry.directory && entry.children) {
      return [
        h("li", [
          h("details", { open: true }, [
            h("summary", row),
            treeList(entry.children),
          ]),
        ]),
      ]
    }
    return [h("li", [h("span", { className: ["tree-entry"] }, row)])]
  })
  return h("ul", items)
}

const fileStem = (fileURL?: URL): string => {
  const segments = (fileURL?.pathname ?? "").split("/").filter(Boolean)
  const file = (segments.pop() ?? "").replace(/\.mdx?$/, "")
  const stem = file && file !== "index" ? file : (segments.pop() ?? "doc")
  return stem.replace(/[^a-zA-Z0-9-]/g, "-").replace(/^-+/, "")
}

export function contentDirectives() {
  let tabGroups = 0
  return defineMdastPlugin({
    name: "content-directives",
    containerDirective(node, ctx) {
      switch (node.name) {
        case "steps": {
          ctx.setProperty(node, "data", { hName: "step-list" })
          return
        }

        case "aside": {
          ctx.setProperty(node, "data", {
            hName: "aside",
            hProperties: { dataAside: "" },
          })
          return
        }

        case "details": {
          const open = !!node.attributes && "open" in node.attributes
          const label = directiveLabel(node as unknown as DirectiveNode)
          if (label) {
            ctx.setProperty(label, "data", { hName: "summary" })
          } else {
            ctx.prependChild(node, {
              type: "html",
              value: "<summary>Details</summary>",
            })
          }
          ctx.setProperty(node, "data", {
            hName: "details",
            hProperties: { open },
          })
          return
        }

        case "card-grid": {
          ctx.setProperty(node, "data", { hName: "card-grid" })
          return
        }

        case "card": {
          const href = node.attributes?.href
          const label = directiveLabel(node as unknown as DirectiveNode)
          if (label) {
            ctx.setProperty(label, "data", {
              hName: "p",
              hProperties: { dataCardTitle: "" },
            })
          }
          ctx.setProperty(node, "data", {
            hName: href ? "a" : "article",
            hProperties: { dataCard: "", ...(href ? { href } : {}) },
          })
          return
        }

        case "file-tree": {
          const list = node.children?.find((child) => child.type === "list") as
            | List
            | undefined
          if (!list) return
          return {
            type: "html",
            value: toHtml(h("file-tree", [treeList(list)]), {
              allowDangerousHtml: true,
            }),
          }
        }

        case "tabs": {
          const tabs = (node.children ?? []).filter(
            (child) =>
              child.type === "containerDirective" &&
              (child as unknown as DirectiveNode).name === "tab",
          )
          if (tabs.length === 0) return

          const prefix = `${fileStem(ctx.fileURL)}-tabs-${tabGroups++}`
          const buttons = tabs
            .map((tab, i) => {
              const label = directiveLabel(tab as unknown as DirectiveNode)
              const text = label ? mdastText(label) : `Tab ${i + 1}`
              const syncId = (tab as unknown as DirectiveNode).attributes
                ?.syncId
              return [
                `<button role="tab" id="${prefix}-tab-${i}"`,
                ` aria-controls="${prefix}-panel-${i}"`,
                ` aria-selected="${i === 0}"`,
                syncId ? ` data-sync-id="${escapeHtml(syncId)}"` : "",
                i === 0 ? "" : ' tabindex="-1"',
                `>${escapeHtml(text)}</button>`,
              ].join("")
            })
            .join("")

          ctx.prependChild(node, {
            type: "html",
            value: `<div role="tablist">${buttons}</div>`,
          })
          tabs.forEach((tab, i) => {
            const label = directiveLabel(tab as unknown as DirectiveNode)
            if (label) ctx.removeNode(label)
            ctx.setProperty(tab, "data", {
              hName: "section",
              hProperties: {
                role: "tabpanel",
                id: `${prefix}-panel-${i}`,
                ariaLabelledby: `${prefix}-tab-${i}`,
                tabIndex: 0,
                ...(i > 0 ? { hidden: true } : {}),
              },
            })
          })

          const flag = (name: string) => {
            const value = node.attributes?.[name]
            return value === "" || value === "true" || value === null
          }
          const sync = node.attributes?.sync
          const codeTabs = flag("code") || flag("codeTabs")
          ctx.setProperty(node, "data", {
            hName: "tab-group",
            hProperties: {
              ...(sync ? { dataSync: sync } : {}),
              ...(codeTabs ? { dataCodeTabs: "" } : {}),
            },
          })
          return
        }

        case "tab":
          return
      }
    },
    leafDirective(node, ctx) {
      if (node.name !== "card") return
      const href = node.attributes?.href
      ctx.prependChild(node, { type: "html", value: "<p data-card-title>" })
      ctx.appendChild(node, { type: "html", value: "</p>" })
      ctx.setProperty(node, "data", {
        hName: href ? "a" : "article",
        hProperties: { dataCard: "", ...(href ? { href } : {}) },
      })
    },
  })
}
