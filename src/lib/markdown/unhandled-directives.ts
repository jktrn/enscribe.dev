import type { Data } from "mdast"
import type {} from "mdast-util-to-hast"
import { defineMdastPlugin } from "satteri"

const handled = (node: { data?: Data | undefined }) => !!node.data?.hName

const warn = (syntax: string, name: string, fileURL: URL | undefined) => {
  console.warn(
    `[markdown] unhandled directive ${syntax}${name} dropped from output (${fileURL?.pathname ?? "unknown file"})`,
  )
}

export const unhandledDirectives = defineMdastPlugin({
  name: "unhandled-directives",
  containerDirective(node, ctx) {
    if (!handled(node)) warn(":::", node.name, ctx.fileURL)
  },
  leafDirective(node, ctx) {
    if (!handled(node)) warn("::", node.name, ctx.fileURL)
  },
  textDirective(node, ctx) {
    if (!handled(node)) warn(":", node.name, ctx.fileURL)
  },
})
