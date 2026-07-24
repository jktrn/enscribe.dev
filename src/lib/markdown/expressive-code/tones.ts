import {
  type AnnotationRenderOptions,
  AttachedPluginData,
  definePlugin,
  ExpressiveCodeAnnotation,
  type ExpressiveCodePlugin,
} from "satteri-expressive-code"
import { type Element, h, type Parents } from "satteri-expressive-code/hast"
import { parseCodeToneRanges, toneProperties } from "../code-annotations"

function stripElementSyntaxStyles(node: Element): Element {
  const {
    class: _class,
    className: _className,
    style: _style,
    ...properties
  } = node.properties ?? {}
  return {
    ...node,
    properties,
    children: node.children.map((child) =>
      child.type === "element" ? stripElementSyntaxStyles(child) : child,
    ),
  }
}

class CodeToneAnnotation extends ExpressiveCodeAnnotation {
  readonly name = "code-tone"
  private readonly tone: string

  constructor(tone: string, start: number, end: number) {
    super({
      inlineRange: { columnStart: start, columnEnd: end },
      renderPhase: "latest",
    })
    this.tone = tone
  }

  render({ nodesToTransform }: AnnotationRenderOptions): Parents[] {
    return nodesToTransform.map((node) =>
      h(
        "span",
        toneProperties(this.tone),
        node.type === "element" ? stripElementSyntaxStyles(node) : node,
      ),
    )
  }
}

export const codeToneData = new AttachedPluginData<{
  tonedLines: Set<number>
}>(() => ({ tonedLines: new Set<number>() }))

export function pluginCodeTones(): ExpressiveCodePlugin {
  return definePlugin({
    name: "Code Tones",
    hooks: {
      preprocessCode: ({ codeBlock }) => {
        if (codeBlock.metaOptions.getBoolean("tones") === false) return
        codeBlock.getLines().forEach((line, index) => {
          const parsed = parseCodeToneRanges(line.text)
          if (!parsed) return

          codeToneData.getOrCreateFor(codeBlock).tonedLines.add(index)
          line.editText(0, line.text.length, parsed.text)
          for (const range of parsed.ranges) {
            line.addAnnotation(
              new CodeToneAnnotation(range.tone, range.start, range.end),
            )
          }
        })
      },
    },
  })
}
