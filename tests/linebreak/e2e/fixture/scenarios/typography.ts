import { createLinebreaker } from "@enscribe/linebreak"
import { byId } from "../dom"
import {
  maximumLineResidual,
  ownerSnapshot,
  resultSnapshot,
} from "../snapshots"

const exactRetriesDuring = <Result>(
  linebreaker: ReturnType<typeof createLinebreaker>,
  action: () => Result,
) => {
  const before = linebreaker.readMetrics().exactRetries
  const result = action()
  const exactRetries = linebreaker.readMetrics().exactRetries - before
  return { result, exactRetries }
}

const typographyCase = (name: string) => {
  const owner = byId(`typography-${name}-owner`)
  const linebreaker = createLinebreaker({ minimumWidth: 180 })
  try {
    const first = exactRetriesDuring(linebreaker, () =>
      linebreaker.typeset(owner),
    )
    linebreaker.restore(owner)
    const second = exactRetriesDuring(linebreaker, () =>
      linebreaker.typeset(owner),
    )
    linebreaker.invalidate(owner)
    const invalidated = exactRetriesDuring(linebreaker, () =>
      linebreaker.typeset(owner),
    )

    return {
      first: resultSnapshot(first.result),
      firstExactRetries: first.exactRetries,
      geometry: {
        ...ownerSnapshot(owner),
        maximumResidual: maximumLineResidual(owner),
      },
      second: resultSnapshot(second.result),
      secondExactRetries: second.exactRetries,
      invalidated: resultSnapshot(invalidated.result),
      invalidatedExactRetries: invalidated.exactRetries,
      remainingMeasurementHosts: owner.querySelectorAll("[data-kp-measurement]")
        .length,
    }
  } finally {
    linebreaker.destroy()
  }
}

export const typographyScenarios = {
  renderedLineReferences() {
    const owner = document.createElement("p")
    owner.dataset.lineReferenceTest = ""
    owner.style.cssText =
      "inline-size: 30rem; font-size: 18px; line-height: 30px"
    owner.textContent =
      "A width change after rendering forces stabilization to replace every generated line before validating the final geometry."
    document.body.appendChild(owner)

    const widthRule = document.createElement("style")
    widthRule.textContent =
      "[data-line-reference-test][data-kp-justified] { inline-size: 24rem !important; }"
    document.head.appendChild(widthRule)

    const linebreaker = createLinebreaker({ minimumWidth: 180 })
    const plan = linebreaker.plan(owner)
    const query = owner.querySelectorAll.bind(owner)
    const lineSelectors: string[] = []
    owner.querySelectorAll = ((selector: string) => {
      if (selector.includes(".kp-line")) lineSelectors.push(selector)
      return query(selector)
    }) as typeof owner.querySelectorAll

    const mutations = new MutationObserver(() => {})
    mutations.observe(owner, { childList: true })

    try {
      const result = resultSnapshot(linebreaker.commit(plan))
      const generatedLines = mutations
        .takeRecords()
        .flatMap((record) => [...record.addedNodes])
        .filter(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && node.classList.contains("kp-line"),
        )
      return {
        detachedLines: generatedLines.filter((line) => !line.isConnected)
          .length,
        finalLineCount: [...owner.children].filter((element) =>
          element.classList.contains("kp-line"),
        ).length,
        lineSelectors,
        overflow: Math.max(0, owner.scrollWidth - owner.clientWidth),
        result,
      }
    } finally {
      mutations.disconnect()
      linebreaker.destroy()
      widthRule.remove()
      owner.remove()
    }
  },
  typographyMeasurement() {
    return {
      plain: typographyCase("plain"),
      smallCaps: typographyCase("small-caps"),
      oldstyleNumerals: typographyCase("oldstyle"),
      disabledLigatures: typographyCase("no-ligatures"),
      stretch: typographyCase("stretch-condensed"),
      wordSpacing: typographyCase("word-spacing"),
      correctableWordSpacing: typographyCase("correctable-spacing"),
      uppercase: typographyCase("uppercase"),
    }
  },
}
