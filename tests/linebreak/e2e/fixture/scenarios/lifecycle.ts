import { createLinebreaker } from "@enscribe/linebreak"
import { authored, elements, linebreaker } from "../state"
import { resultSnapshot } from "../snapshots"

export const lifecycleScenarios = {
  languageChangeRestoresBeforeMeasurement() {
    const owner = document.createElement("p")
    owner.lang = "en"
    owner.dataset.languageMetric = ""
    owner.style.cssText =
      "inline-size: 30rem; font-size: 18px; line-height: 30px"
    owner.textContent =
      "Changing a paragraph language must restore its authored state before measuring it again."
    document.body.appendChild(owner)

    const metricStyle = document.createElement("style")
    metricStyle.textContent =
      "[data-language-metric][data-kp-justified] { font-size: 31px !important; }"
    document.head.appendChild(metricStyle)

    const ownerLinebreaker = createLinebreaker({ minimumWidth: 180 })
    const originalGetComputedStyle = window.getComputedStyle
    const rootReads: Array<{ fontSize: string; justified: boolean }> = []
    try {
      ownerLinebreaker.plan(owner)
      owner.dataset.kpJustified = ""
      owner.lang = "fr"
      window.getComputedStyle = ((element, pseudoElement) => {
        const style = originalGetComputedStyle(element, pseudoElement)
        if (element === owner) {
          rootReads.push({
            fontSize: style.fontSize,
            justified: owner.hasAttribute("data-kp-justified"),
          })
        }
        return style
      }) as typeof window.getComputedStyle

      ownerLinebreaker.plan(owner)
      return rootReads
    } finally {
      window.getComputedStyle = originalGetComputedStyle
      ownerLinebreaker.destroy()
      metricStyle.remove()
      owner.remove()
    }
  },
  planLifecycle() {
    const owner = createLinebreaker({ minimumWidth: 180 })
    const foreign = createLinebreaker({ minimumWidth: 180 })
    const batchOwner = createLinebreaker({ minimumWidth: 180 })
    const destroyedOwner = createLinebreaker({ minimumWidth: 180 })
    try {
      const plan = owner.plan(elements.foreign)
      const foreignResult = foreign.commit(plan)
      const ownerResult = owner.commit(plan)
      const ownerSnapshot = resultSnapshot(ownerResult)
      const replayResult = owner.commit(plan)

      const duplicatePlan = batchOwner.plan(elements.duplicate)
      const duplicateResults = batchOwner.commit([duplicatePlan, duplicatePlan])

      destroyedOwner.destroy()
      const destroyedPlan = destroyedOwner.plan(elements.stale)
      const destroyedResult = destroyedOwner.commit(destroyedPlan)

      return {
        publicKeys: Reflect.ownKeys(plan).map(String),
        foreign: resultSnapshot(foreignResult),
        owner: ownerSnapshot,
        replay: resultSnapshot(replayResult),
        freshResults: {
          owner: ownerResult !== plan,
          replay: ownerResult !== replayResult,
          batch: duplicateResults[0] !== duplicateResults[1],
          postDestroy: destroyedResult !== destroyedPlan,
        },
        samePlanBatch: duplicateResults.map(resultSnapshot),
        postDestroy: resultSnapshot(destroyedResult),
      }
    } finally {
      owner.destroy()
      foreign.destroy()
      batchOwner.destroy()
      destroyedOwner.destroy()
    }
  },
  imageLifecycle() {
    const imageStates = () =>
      [...elements.imageOwner.querySelectorAll<HTMLImageElement>("img")].map(
        (image) => image.getAttribute("data-loaded"),
      )
    const result = resultSnapshot(linebreaker.typeset(elements.imageOwner))
    const rendered = imageStates()
    const images = elements.imageOwner.querySelectorAll<HTMLImageElement>("img")
    images[0]?.setAttribute("data-loaded", "rendered-first")
    images[1]?.setAttribute("data-loaded", "rendered-second")
    linebreaker.restore(elements.imageOwner)
    return { rendered, restored: imageStates(), result }
  },
  lifecycle() {
    linebreaker.typeset(elements.rich)
    const beforeRestoreCache = linebreaker.readMetrics().cachedParagraphs
    linebreaker.restore(elements.rich)
    const restored = {
      cache: linebreaker.readMetrics().cachedParagraphs,
      html: elements.rich.innerHTML,
      identity: document.getElementById("semantic-link") === authored.link,
    }
    linebreaker.invalidate(elements.rich)
    elements.rich.innerHTML =
      'Updated authored text with a <a id="updated-link" href="#updated">new semantic link</a> that still spans several optimized lines without stale cached content.'
    const updatedHtml = elements.rich.innerHTML
    const updatedResult = resultSnapshot(linebreaker.typeset(elements.rich))
    linebreaker.destroy()
    const destroyed = {
      cache: linebreaker.readMetrics().cachedParagraphs,
      html: elements.rich.innerHTML,
      result: resultSnapshot(linebreaker.typeset(elements.rich)),
    }
    linebreaker.destroy()
    return {
      beforeRestoreCache,
      authoredHtml: authored.richHtml,
      restored,
      updatedHtml,
      updatedResult,
      destroyed,
    }
  },
  batchLifecycle() {
    const owner = createLinebreaker({ minimumWidth: 180 })
    const restored = [elements.rich, elements.japanese]
    const retained = elements.foreign
    const authoredHtml = restored.map((element) => element.innerHTML)
    try {
      const emptyRestorePlan = owner.plan(retained)
      owner.restore([])
      const emptyRestore = resultSnapshot(owner.commit(emptyRestorePlan))
      const emptyInvalidatePlan = owner.plan(retained)
      owner.invalidate(new Set<HTMLElement>())
      const emptyInvalidate = resultSnapshot(owner.commit(emptyInvalidatePlan))

      owner.typeset([...restored, retained])
      const pending = owner.plan(retained)
      owner.restore(
        (function* () {
          yield restored[0]
          yield restored[0]
          yield restored[1]
        })(),
      )
      const afterRestore = {
        authored: restored.every(
          (element, index) => element.innerHTML === authoredHtml[index],
        ),
        cache: owner.readMetrics().cachedParagraphs,
        pending: resultSnapshot(owner.commit(pending)),
      }

      owner.typeset(restored)
      const pendingInvalidation = owner.plan(retained)
      owner.invalidate(restored)
      const afterInvalidate = {
        authored: restored.every(
          (element, index) => element.innerHTML === authoredHtml[index],
        ),
        cache: owner.readMetrics().cachedParagraphs,
        pending: resultSnapshot(owner.commit(pendingInvalidation)),
      }
      const fresh = owner.typeset(restored).map(resultSnapshot)

      return {
        afterInvalidate,
        afterRestore,
        emptyInvalidate,
        emptyRestore,
        fresh,
      }
    } finally {
      owner.destroy()
    }
  },
  batchLifecycleFailure() {
    const owner = createLinebreaker({ minimumWidth: 180 })
    const processed = elements.rich
    const failing = elements.japanese
    const authoredHtml = [processed.innerHTML, failing.innerHTML]
    let iteratorClosed = false
    try {
      owner.typeset([processed, failing])
      const pending = owner.plan(failing)
      Object.defineProperty(failing, "replaceChildren", {
        configurable: true,
        value: () => {
          throw new Error("forced restoration failure")
        },
      })

      let error = ""
      try {
        owner.invalidate(
          (function* () {
            try {
              yield processed
              yield failing
            } finally {
              iteratorClosed = true
            }
          })(),
        )
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause)
      } finally {
        Reflect.deleteProperty(failing, "replaceChildren")
      }

      const afterFailure = {
        cache: owner.readMetrics().cachedParagraphs,
        error,
        failingTypeset: failing.dataset.kpJustified !== undefined,
        iteratorClosed,
        pending: resultSnapshot(owner.commit(pending)),
        processedAuthored: processed.innerHTML === authoredHtml[0],
      }
      owner.invalidate(failing)
      const afterRetry = {
        authored:
          processed.innerHTML === authoredHtml[0] &&
          failing.innerHTML === authoredHtml[1],
        cache: owner.readMetrics().cachedParagraphs,
      }
      return { afterFailure, afterRetry }
    } finally {
      Reflect.deleteProperty(failing, "replaceChildren")
      owner.destroy()
    }
  },
}
