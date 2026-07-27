import { expect, test } from "bun:test"
import manifest from "@linebreak/../package.json" with { type: "json" }
import {
  type Diagnostic,
  type DiagnosticKind,
  createDiagnosticEmitter,
  isExpectedOutcome,
} from "@linebreak/diagnostics"

const element = () => ({}) as HTMLElement
const node = () => ({}) as Element

const describeDiagnostic = (diagnostic: Diagnostic): DiagnosticKind => {
  switch (diagnostic.kind) {
    case "unsupported-element":
      return diagnostic.node && diagnostic.detail
        ? diagnostic.kind
        : "empty-content"
    case "unsupported-direction":
      return diagnostic.direction ? diagnostic.kind : "empty-content"
    case "insufficient-width":
      return diagnostic.width < diagnostic.minimum
        ? diagnostic.kind
        : "empty-content"
    case "empty-content":
      return diagnostic.kind
    case "single-line":
      return diagnostic.kind
    case "content-too-long":
      return diagnostic.length > diagnostic.maximum
        ? diagnostic.kind
        : "empty-content"
    case "segmentation-mismatch":
      return diagnostic.detail ? diagnostic.kind : "empty-content"
    case "measurement-unavailable":
      return diagnostic.property ? diagnostic.kind : "empty-content"
    case "stale-plan":
      return diagnostic.element ? diagnostic.kind : "empty-content"
    case "no-feasible-breaking":
      return Number.isFinite(diagnostic.width)
        ? diagnostic.kind
        : "empty-content"
    case "line-wrapped":
      return diagnostic.renderedHeight >
        diagnostic.expectedLines * diagnostic.lineHeight
        ? diagnostic.kind
        : "empty-content"
    case "line-height-unresolved":
      return diagnostic.value ? diagnostic.kind : "empty-content"
    case "render-failed":
      return diagnostic.cause === undefined ? "empty-content" : diagnostic.kind
    default: {
      const unreachable: never = diagnostic
      return unreachable
    }
  }
}

test("every diagnostic variant narrows to its own kind", () => {
  const variants: Diagnostic[] = [
    {
      kind: "unsupported-element",
      element: element(),
      node: node(),
      detail: "br",
    },
    { kind: "unsupported-direction", element: element(), direction: "rtl" },
    {
      kind: "insufficient-width",
      element: element(),
      width: 100,
      minimum: 240,
    },
    { kind: "empty-content", element: element() },
    { kind: "single-line", element: element() },
    {
      kind: "content-too-long",
      element: element(),
      length: 4000,
      maximum: 3000,
    },
    {
      kind: "segmentation-mismatch",
      element: element(),
      detail: "offset drift",
    },
    {
      kind: "measurement-unavailable",
      element: element(),
      node: node(),
      property: "font-feature-settings",
    },
    { kind: "no-feasible-breaking", element: element(), width: 320 },
    {
      kind: "line-wrapped",
      element: element(),
      expectedLines: 3,
      renderedHeight: 96,
      lineHeight: 24,
    },
    { kind: "line-height-unresolved", element: element(), value: "normal" },
    { kind: "render-failed", element: element(), cause: new Error("boom") },
  ]

  for (const variant of variants) {
    expect(describeDiagnostic(variant)).toBe(variant.kind)
  }
})

test("emitting without a sink is a no-op", () => {
  const emit = createDiagnosticEmitter()
  expect(() =>
    emit({ kind: "empty-content", element: element() }),
  ).not.toThrow()
})

test("a sink receives a diagnostic that reports a real failure", () => {
  const received: Diagnostic[] = []
  const emit = createDiagnosticEmitter((diagnostic) =>
    received.push(diagnostic),
  )
  const diagnostic: Diagnostic = {
    kind: "render-failed",
    element: element(),
    cause: new Error("boom"),
  }

  emit(diagnostic)

  expect(received).toEqual([diagnostic])
})

test("ordinary outcomes never reach the sink", () => {
  const received: Diagnostic[] = []
  const emit = createDiagnosticEmitter((diagnostic) =>
    received.push(diagnostic),
  )

  emit({ kind: "empty-content", element: element() })
  emit({ kind: "single-line", element: element() })
  emit({
    kind: "insufficient-width",
    element: element(),
    width: 53,
    minimum: 240,
  })
  emit({ kind: "unsupported-direction", element: element(), direction: "rtl" })

  expect(received).toEqual([])
})

test("only genuine failures are classified as reportable", () => {
  expect(isExpectedOutcome("single-line")).toBe(true)
  expect(isExpectedOutcome("insufficient-width")).toBe(true)
  expect(isExpectedOutcome("segmentation-mismatch")).toBe(false)
  expect(isExpectedOutcome("line-wrapped")).toBe(false)
  expect(isExpectedOutcome("no-feasible-breaking")).toBe(false)
  expect(isExpectedOutcome("render-failed")).toBe(false)
})

test("a throwing sink does not propagate to the caller", () => {
  const emit = createDiagnosticEmitter(() => {
    throw new Error("sink is broken")
  })

  expect(() =>
    emit({ kind: "empty-content", element: element() }),
  ).not.toThrow()
})

test("the manifest declares no publish surface", () => {
  expect(manifest.private).toBe(true)
  expect(manifest).not.toHaveProperty("publishConfig")
  expect(manifest).not.toHaveProperty("keywords")
  expect(manifest.files).toEqual(["dist"])
})
