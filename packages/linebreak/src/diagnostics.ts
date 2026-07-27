export type Diagnostic =
  | {
      kind: "unsupported-element"
      element: HTMLElement
      node: Element
      detail: string
    }
  | { kind: "unsupported-direction"; element: HTMLElement; direction: string }
  | {
      kind: "insufficient-width"
      element: HTMLElement
      width: number
      minimum: number
    }
  | { kind: "empty-content"; element: HTMLElement }
  | { kind: "single-line"; element: HTMLElement }
  | {
      kind: "content-too-long"
      element: HTMLElement
      length: number
      maximum: number
    }
  | { kind: "segmentation-mismatch"; element: HTMLElement; detail: string }
  | {
      kind: "measurement-unavailable"
      element: HTMLElement
      node: Element
      property: string
    }
  | { kind: "stale-plan"; element: HTMLElement }
  | { kind: "no-feasible-breaking"; element: HTMLElement; width: number }
  | {
      kind: "line-wrapped"
      element: HTMLElement
      expectedLines: number
      renderedHeight: number
      lineHeight: number
    }
  | { kind: "line-height-unresolved"; element: HTMLElement; value: string }
  | { kind: "render-failed"; element: HTMLElement; cause: unknown }

export type DiagnosticKind = Diagnostic["kind"]

export type DiagnosticSink = (diagnostic: Diagnostic) => void

const EXPECTED: ReadonlySet<DiagnosticKind> = new Set([
  "empty-content",
  "single-line",
  "insufficient-width",
  "unsupported-direction",
])

export const isExpectedOutcome = (kind: DiagnosticKind) => EXPECTED.has(kind)

export const createDiagnosticEmitter = (sink?: DiagnosticSink) => {
  if (!sink) return () => {}
  return (diagnostic: Diagnostic) => {
    if (isExpectedOutcome(diagnostic.kind)) return
    try {
      sink(diagnostic)
    } catch {}
  }
}

export type EmitDiagnostic = ReturnType<typeof createDiagnosticEmitter>
