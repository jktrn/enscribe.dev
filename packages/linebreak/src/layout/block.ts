import type { SourceRange } from "../text/source"

type RunBase = {
  readonly text: string
  readonly start: number
  readonly end: number
}

export type CompiledRun =
  | (RunBase & { readonly kind: "text"; readonly hyphenates: boolean })
  | (RunBase & { readonly kind: "atom" })
  | (RunBase & {
      readonly kind: "anchor"
      readonly affinity: "previous" | "next"
    })
  | (RunBase & { readonly kind: "break"; readonly forced: boolean })

export type CompiledBlock = {
  readonly text: string
  readonly runs: readonly CompiledRun[]
  readonly breakRestrictions: readonly SourceRange[]
}
