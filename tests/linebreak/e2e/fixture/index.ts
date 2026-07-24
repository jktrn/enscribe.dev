import "@enscribe/linebreak/styles.css"
import "./styles.css"
import { contentScenarios } from "./scenarios/content"
import { layoutScenarios } from "./scenarios/layout"
import { lifecycleScenarios } from "./scenarios/lifecycle"
import { planningScenarios } from "./scenarios/planning"
import { typographyScenarios } from "./scenarios/typography"

const fixtureApi = {
  ...contentScenarios,
  ...planningScenarios,
  ...layoutScenarios,
  ...lifecycleScenarios,
  ...typographyScenarios,
}

export type FixtureApi = typeof fixtureApi

window.linebreakFixture = fixtureApi

declare global {
  interface Window {
    linebreakFixture: FixtureApi
  }
}
