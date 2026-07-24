import { createLinebreaker } from "@enscribe/linebreak"
import { extractBlock } from "../../../../../packages/linebreak/src/dom/extract"
import { createBlockTemplate } from "../../../../../packages/linebreak/src/dom/template"
import { byId } from "../dom"
import { resultSnapshot } from "../snapshots"

const templateOwner = () => {
  const owner = document.createElement("p")
  owner.style.inlineSize = "30rem"
  owner.style.fontSize = "18px"
  owner.style.lineHeight = "30px"
  owner.innerHTML = `
    Careful typography keeps direct text and
    <span data-template-wrapper>
      decorated context<span
        aria-hidden="true"
        data-linebreak-decoration
        data-linebreak-decoration-position="after"
      >◆</span>
    </span>, preserves <code>inlineCode()</code>, and measures
    <span data-linebreak-atom role="img" aria-label="blue diamond">◆</span>
    as one object across several optimized lines without retaining the authored
    descendants after rendering.
  `
  document.body.appendChild(owner)
  return owner
}

const extractedReferences = (
  extracted: NonNullable<ReturnType<typeof extractBlock>>,
) => {
  const references: Element[] = []
  for (const item of extracted.items) {
    references.push(item.sourceElement, ...item.wrappers)
  }
  for (const [wrapper, info] of extracted.wrappers) {
    references.push(wrapper, ...info.leading.nodes, ...info.trailing.nodes)
  }
  return references
}

const removedWrappers = (records: MutationRecord[]) => {
  const wrappers = new Set<Element>()
  for (const record of records) {
    for (const node of record.removedNodes) {
      if (!(node instanceof Element)) continue
      if (node.matches("[data-template-wrapper]")) wrappers.add(node)
      for (const wrapper of node.querySelectorAll("[data-template-wrapper]")) {
        wrappers.add(wrapper)
      }
    }
  }
  return [...wrappers]
}

export const contentScenarios = {
  nowrapExtraction() {
    const snapshot = (id: string) => {
      const extracted = extractBlock(byId(id))
      if (!extracted) throw new Error(`Could not extract #${id}`)
      return {
        text: extracted.text,
        items: extracted.items.map(({ kind, start, end }) => ({
          kind,
          start,
          end,
        })),
        breakRestrictions: extracted.breakRestrictions,
      }
    }

    return {
      collapsed: snapshot("nowrap-collapsed-owner"),
      trailingSpace: snapshot("nowrap-space-owner"),
      emptyInline: snapshot("nowrap-empty-inline-owner"),
    }
  },
  styleReads() {
    const owner = templateOwner()
    const linebreaker = createLinebreaker({ minimumWidth: 180 })
    const originalGetComputedStyle = window.getComputedStyle
    const reads = new Map<Element, number>()
    window.getComputedStyle = ((element, pseudoElement) => {
      reads.set(element, (reads.get(element) ?? 0) + 1)
      return originalGetComputedStyle(element, pseudoElement)
    }) as typeof window.getComputedStyle

    try {
      linebreaker.plan(owner)
      const counts = [...reads.values()]
      return {
        cachedParagraphs: linebreaker.readMetrics().cachedParagraphs,
        total: counts.reduce((sum, count) => sum + count, 0),
        unique: counts.length,
        repeated: counts.filter((count) => count > 1).length,
        maximum: Math.max(...counts),
      }
    } finally {
      window.getComputedStyle = originalGetComputedStyle
      linebreaker.destroy()
      owner.remove()
    }
  },
  classifyInlineContent() {
    const owners = {
      hidden: byId("hidden-inline-owner"),
      contents: byId("contents-owner"),
      inlineBoxes: byId("inline-box-owner"),
      blockLink: byId("block-link-owner"),
      input: byId("input-owner"),
      customInline: byId("custom-inline-owner"),
      nativeImage: byId("native-image-owner"),
      nativeRenderers: byId("native-renderers-owner"),
      nbsp: byId("nbsp-owner"),
    }
    return Object.fromEntries(
      Object.entries(owners).map(([name, owner]) => {
        const extracted = extractBlock(owner)
        return [
          name,
          extracted && {
            text: extracted.text,
            boxTags: extracted.items.flatMap((item) =>
              item.kind === "box" ? [item.sourceElement.localName] : [],
            ),
            wrapperTags: [...extracted.wrappers.keys()].map(
              (wrapper) => wrapper.localName,
            ),
          },
        ]
      }),
    )
  },
  templateOwnership() {
    const owner = templateOwner()
    const linebreaker = createLinebreaker({ minimumWidth: 180 })
    try {
      const extracted = extractBlock(owner)
      if (!extracted) throw new Error("Template fixture could not be extracted")
      const template = createBlockTemplate(owner, extracted)
      const sourceElements = new Set([owner, ...owner.querySelectorAll("*")])
      const templateElements = new Set([
        template.root,
        ...template.root.querySelectorAll("*"),
      ])
      const references = extractedReferences(template.extracted)
      const authoredHtml = owner.innerHTML
      const observer = new MutationObserver(() => {})
      observer.observe(owner, { childList: true, subtree: true })
      const firstResult = resultSnapshot(linebreaker.typeset(owner))
      const detachedWrappers = removedWrappers(observer.takeRecords())
      observer.disconnect()
      const rendered = owner.hasAttribute("data-kp-justified")
      for (const wrapper of detachedWrappers) {
        wrapper.setAttribute("data-detached-mutation", "")
      }
      linebreaker.restore(owner)
      const secondResult = resultSnapshot(linebreaker.typeset(owner))
      const detachedMutationExcluded = !owner.querySelector(
        "[data-detached-mutation]",
      )
      linebreaker.restore(owner)

      return {
        ownership: {
          cloneMatchesSource: template.root.isEqualNode(owner),
          distinctRoots: template.root !== owner,
          everyReferenceUsesTemplate: references.every((reference) =>
            templateElements.has(reference),
          ),
          noReferenceUsesSource: references.every(
            (reference) => !sourceElements.has(reference),
          ),
          wrappersResolve: template.extracted.items.every((item) =>
            item.wrappers.every((wrapper) =>
              template.extracted.wrappers.has(wrapper),
            ),
          ),
          directTextUsesTemplateRoot: template.extracted.items.some(
            (item) =>
              item.kind === "text" && item.sourceElement === template.root,
          ),
        },
        behavior: {
          firstResult,
          secondResult,
          rendered,
          detachedWrapperCount: detachedWrappers.length,
          detachedWrappersRemainDetached: detachedWrappers.every(
            (wrapper) => !wrapper.isConnected,
          ),
          detachedMutationExcluded,
          restoredExactly: owner.innerHTML === authoredHtml,
        },
      }
    } finally {
      linebreaker.destroy()
      owner.remove()
    }
  },
}
