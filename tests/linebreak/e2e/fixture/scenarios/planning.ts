import { createLinebreaker } from "@enscribe/linebreak"
import { authored, elements, errors, linebreaker, plans } from "../state"
import {
  maximumLineResidual,
  ownerSnapshot,
  resultSnapshot,
} from "../snapshots"

export const planningScenarios = {
  snapshot() {
    return {
      cachedParagraphs: linebreaker.readMetrics().cachedParagraphs,
      errors: [...errors],
      japanese: ownerSnapshot(elements.japanese),
      rich: ownerSnapshot(elements.rich),
      richHtmlMatches: elements.rich.innerHTML === authored.richHtml,
      richLinkIdentity:
        document.getElementById("semantic-link") === authored.link,
    }
  },
  planBatch() {
    plans.batch = [
      linebreaker.plan(elements.rich),
      linebreaker.plan(elements.japanese),
    ]
    return plans.batch.length
  },
  commitBatch() {
    return linebreaker.commit(plans.batch).map(resultSnapshot)
  },
  planStale() {
    plans.stale = linebreaker.plan(elements.stale)
    elements.stale.style.inlineSize = "16rem"
    return { html: elements.stale.innerHTML }
  },
  commitStale() {
    if (!plans.stale) throw new Error("Call planStale first")
    const result = resultSnapshot(linebreaker.commit(plans.stale))
    return {
      authored: elements.stale.innerHTML === authored.staleHtml,
      result,
      ...ownerSnapshot(elements.stale),
    }
  },
  replanStale() {
    return resultSnapshot(linebreaker.typeset(elements.stale))
  },
  generationStale() {
    const invalidatedPlan = linebreaker.plan(elements.stale)
    linebreaker.invalidate(elements.stale)
    const invalidatedResult = linebreaker.commit(invalidatedPlan)
    const destroyedPlan = linebreaker.plan(elements.rich)
    linebreaker.destroy()
    return [invalidatedResult, linebreaker.commit(destroyedPlan)].map(
      resultSnapshot,
    )
  },
  foreignPlan() {
    const first = createLinebreaker({ minimumWidth: 180 })
    const second = createLinebreaker({ minimumWidth: 180 })
    const html = elements.foreign.innerHTML
    try {
      const result = resultSnapshot(second.commit(first.plan(elements.foreign)))
      return {
        authored: elements.foreign.innerHTML === html,
        result,
        ...ownerSnapshot(elements.foreign),
      }
    } finally {
      first.destroy()
      second.destroy()
    }
  },
  duplicateBatch() {
    const duplicateLinebreaker = createLinebreaker({ minimumWidth: 180 })
    try {
      const results = duplicateLinebreaker
        .typeset([elements.duplicate, elements.duplicate])
        .map(resultSnapshot)
      return {
        maximumResidual: maximumLineResidual(elements.duplicate),
        results,
        ...ownerSnapshot(elements.duplicate),
      }
    } finally {
      duplicateLinebreaker.destroy()
    }
  },
}
