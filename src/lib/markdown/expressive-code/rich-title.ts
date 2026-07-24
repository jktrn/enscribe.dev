import type { ElementContent } from "hast"
import { select } from "hast-util-select"
import { definePlugin } from "satteri-expressive-code"
import { plainInline, renderInline } from "../inline-markdown"

const FRAME_TITLE_SELECTOR = ".frame .header .title"

export const pluginFrameRichTitle = () =>
  definePlugin({
    name: "FrameRichTitle",
    hooks: {
      async postprocessRenderedBlock({ codeBlock, renderData }) {
        const title = codeBlock.props.title
        if (!title) return

        const titleNode = select(FRAME_TITLE_SELECTOR, renderData.blockAst)
        if (!titleNode) return

        titleNode.children = [
          { type: "raw", value: await renderInline(title) } as ElementContent,
        ]
        titleNode.properties["data-rich-title"] = ""
        titleNode.properties["data-rich-inline"] = ""
        titleNode.properties["aria-label"] = plainInline(title)
      },
    },
  })
