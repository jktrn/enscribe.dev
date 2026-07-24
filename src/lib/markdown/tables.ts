import type { Element } from "hast"
import { h } from "hastscript"
import type { Table } from "mdast"
import type {} from "mdast-util-to-hast"
import { defineHastPlugin, defineMdastPlugin } from "satteri"

type ColRole = "nowrap" | "wrap" | "fixed"

const COL_LENGTH = /^\d+(?:\.\d+)?(?:rem|em|px|ch|vw|vh|%)$/

const parseCol = (token: string): { role: ColRole; width?: string } => {
  const value = token.trim()
  if (value === "wrap" || /^\d*\.?\d*fr$/.test(value)) return { role: "wrap" }
  if (COL_LENGTH.test(value)) return { role: "fixed", width: value }
  return { role: "nowrap" }
}

const prop = (node: Readonly<Element>, name: string): string | undefined => {
  const camel = name.replace(/-([a-z])/g, (_, char: string) =>
    char.toUpperCase(),
  )
  const value = node.properties?.[name] ?? node.properties?.[camel]
  return typeof value === "string" ? value : undefined
}

const collectRows = (
  node: Readonly<Element>,
  rows: Element[] = [],
): Element[] => {
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue
    if (child.tagName === "tr") rows.push(child)
    else collectRows(child, rows)
  }
  return rows
}

export const tableDirective = defineMdastPlugin({
  name: "table-directive",
  containerDirective(node, ctx) {
    if (node.name !== "table") return
    const table = node.children?.find(
      (child): child is Table => child.type === "table",
    )
    if (!table) return
    ctx.setProperty(table, "data", {
      hProperties: {
        dataTableInner: "",
        dataTableCols: node.attributes?.cols ?? "",
      },
    })
    ctx.setProperty(node, "data", {
      hName: "table-scroll",
      hProperties: { dataScrollFadeX: "" },
    })
  },
})

export const tableScroll = defineHastPlugin({
  name: "table-scroll",
  element: {
    filter: ["table"],
    visit(table, ctx) {
      if (prop(table, "data-table-inner") === undefined) {
        ctx.wrapNode(table, h("table-scroll", { "data-scroll-fade-x": "" }))
        return
      }

      const cols = prop(table, "data-table-cols") ?? ""
      ctx.setProperty(table, "dataTableInner", null)
      ctx.setProperty(table, "dataTableCols", null)

      const specs = cols.split(/\s+/).filter(Boolean).map(parseCol)
      if (specs.length === 0) return

      ctx.prependChild(
        table,
        h(
          "colgroup",
          specs.map((spec) =>
            spec.role === "fixed" && spec.width
              ? h("col", { style: `width:${spec.width}` })
              : h("col"),
          ),
        ),
      )

      for (const row of collectRows(table)) {
        let column = 0
        for (const cell of row.children) {
          if (cell.type !== "element") continue
          if (cell.tagName !== "th" && cell.tagName !== "td") continue
          const spec = specs[column] ?? specs[specs.length - 1]
          ctx.setProperty(cell, "dataCol", spec.role)
          column++
        }
      }
    },
  },
})
