import { compileBlock, type CompileResult } from "../layout/compile"
import { prepareParagraph } from "../layout/breaker/prepared"
import {
  codeWrapper,
  extractBlock,
  type ExtractedBlock,
  type InlineRun,
  outerWidth,
  runEdgeWidths,
} from "../dom/extract"
import { configureLocale, invalidateMeasurements } from "../text/measure"
import type { FontMetrics } from "../text/segments"
import { engineDefaults } from "../policy"
import type { StretchScale } from "../text/stretch"
import { invalidateStretchScales, stretchScaleFor } from "../dom/stretch"
import { currentAdvance, metricsForStyle, primeFontMetrics } from "../dom/measure-dom"
import { hasSplitGrapheme } from "../dom/tracking"
import { TYPESET_ATTRIBUTE } from "../dom/render"
import { captureAuthored } from "../dom/restore"
import {
  computedFont,
  createStyleReader,
  cssPixels,
  type StyleReader,
  uniformLetterSpacing,
  unmodellableProperty,
  variantKey,
} from "../dom/style"
import type { ComposeReason, Hyphenator } from "../types"
import type { GlueElasticity, LayoutPolicy } from "../layout/policy"
import type { Measurement, MeasurementBasis } from "./state"

type MeasurementOptions = {
  maximumCharacters: number
  hyphenate?: Hyphenator
  expand: boolean
  track: boolean
  policy: LayoutPolicy
  glue: GlueElasticity
}

const WITNESS_CHARACTERS = 64

const WITNESS_EPSILON = 0.01

type Witness = {
  readonly font: string
  readonly characters: Set<string>
  width: number
}

type DocumentFonts = {
  readonly metrics: Map<string, FontMetrics>
  readonly witnesses: Map<string, Witness>
}

const witnessText = (witness: Witness) => [...witness.characters].join("")

export class BrowserMeasurements {
  private readonly documents = new Map<Document, DocumentFonts>()

  constructor(private readonly options: MeasurementOptions) {}

  get size() {
    let count = 0
    for (const fonts of this.documents.values()) count += fonts.metrics.size
    return count
  }

  clear() {
    this.documents.clear()
  }

  invalidate() {
    this.clear()
    invalidateMeasurements()
    invalidateStretchScales()
  }

  fontsMoved(document: Document) {
    const fonts = this.documents.get(document)
    if (!fonts) return false
    for (const witness of fonts.witnesses.values()) {
      if (witness.characters.size === 0) continue
      const now = currentAdvance(document, witness.font, witnessText(witness))
      if (now !== null && Math.abs(now - witness.width) > WITNESS_EPSILON) {
        return true
      }
    }
    return false
  }

  private fontsFor(document: Document) {
    let fonts = this.documents.get(document)
    if (!fonts) {
      fonts = { metrics: new Map(), witnesses: new Map() }
      this.documents.set(document, fonts)
    }
    return fonts
  }

  private expandsWith(
    element: HTMLElement,
    reader: StyleReader,
    basis: MeasurementBasis,
  ):
    | ((run: Extract<InlineRun, { kind: "text" }>) => StretchScale | null)
    | null {
    if (!this.options.expand) return null
    const document = element.ownerDocument
    const budget = engineDefaults.expansionBudget
    if (!stretchScaleFor(document, basis.font, basis.letterSpacing, budget)) {
      return null
    }
    return (run) => {
      const style = reader(run.sourceElement)
      return stretchScaleFor(
        document,
        computedFont(style),
        cssPixels(style.letterSpacing),
        budget,
      )
    }
  }

  private tracksWith(
    block: ExtractedBlock,
    reader: StyleReader,
    basis: MeasurementBasis,
  ) {
    if (!this.options.track || hasSplitGrapheme(block)) return null
    const elements = block.runs.map((run) => run.sourceElement)
    if (!uniformLetterSpacing(elements, reader, basis.letterSpacing))
      return null
    return engineDefaults.trackingBudget
  }

  private metricsFor(
    style: CSSStyleDeclaration,
    locale: string,
    document: Document,
    sample: string,
    pending: Set<Witness>,
  ) {
    const font = computedFont(style)
    const letterSpacing = cssPixels(style.letterSpacing)
    const key = `${locale}|${letterSpacing}|${variantKey(style)}|${font}`
    const fonts = this.fontsFor(document)
    let metrics = fonts.metrics.get(key)
    if (!metrics) {
      const measured = metricsForStyle(document, style, font, letterSpacing)
      if (!measured) return null
      metrics = measured
      fonts.metrics.set(key, metrics)
    }
    this.witness(fonts.witnesses, key, font, sample, pending)
    return metrics
  }

  private witness(
    witnesses: Map<string, Witness>,
    key: string,
    font: string,
    sample: string,
    pending: Set<Witness>,
  ) {
    let witness = witnesses.get(key)
    if (!witness) {
      witness = { font, characters: new Set<string>(), width: 0 }
      witnesses.set(key, witness)
    }

    const before = witness.characters.size
    for (const character of sample) {
      if (witness.characters.size >= WITNESS_CHARACTERS) break
      if (character.trim() !== "") witness.characters.add(character)
    }
    if (witness.characters.size === before) return

    pending.add(witness)
  }

  build(
    element: HTMLElement,
    style: CSSStyleDeclaration,
    basis: MeasurementBasis,
    protrudes: boolean,
  ):
    | { ok: true; measurement: Measurement }
    | { ok: false; reason: ComposeReason } {
    if (element.hasAttribute(TYPESET_ATTRIBUTE)) {
      return { ok: false, reason: "already-typeset" }
    }

    const reader = createStyleReader(element, style)
    const extracted = extractBlock(
      element,
      reader,
      this.options.maximumCharacters,
    )
    if (!extracted.ok) return { ok: false, reason: extracted.reason }

    configureLocale(basis.locale)

    if (extracted.block.runs.length > 1) {
      const primed = primeFontMetrics(element.ownerDocument, () => {
        const elements = new Set(extracted.block.runs.filter(run => run.kind === "text").map(run => run.sourceElement))
        return [...elements].map(reader)
      })
      for (const { suffix, metrics } of primed)
        this.fontsFor(element.ownerDocument).metrics.set(`${basis.locale}|${suffix}`, metrics)
    }

    const pendingWitnesses = new Set<Witness>()
    const metricsFor = (
      run: Extract<InlineRun, { kind: "text" }>,
    ): FontMetrics | null => {
      const runStyle = reader(run.sourceElement)
      return unmodellableProperty(runStyle)
        ? null
        : this.metricsFor(
            runStyle,
            basis.locale,
            element.ownerDocument,
            run.text,
            pendingWitnesses,
          )
    }

    const authored = captureAuthored(element)
    const scaleFor = this.expandsWith(element, reader, basis)
    const track = this.tracksWith(extracted.block, reader, basis)
    let compiled: CompileResult
    try {
      compiled = compileBlock({
      block: extracted.block,
      metricsFor,
      baseFont: basis.font,
      atomWidth: (run: InlineRun) => outerWidth(run.sourceElement, reader),
      locale: basis.locale,
      isCode: (run: InlineRun) => codeWrapper(run) !== undefined,
      edgesFor: (run: InlineRun) => runEdgeWidths(extracted.block, run),
      protrude: protrudes,
      ...(track ? { track } : {}),
      policy: this.options.policy,
      glue: this.options.glue,
      ...(this.options.hyphenate ? { hyphenate: this.options.hyphenate } : {}),
      ...(scaleFor ? { scaleFor } : {}),
      })
    } finally {
      for (const witness of pendingWitnesses)
        witness.width = currentAdvance(element.ownerDocument, witness.font, witnessText(witness)) ?? 0
    }
    if (!compiled.ok) return { ok: false, reason: compiled.reason }

    return {
      ok: true,
      measurement: {
        block: extracted.block,
        breakRuns: compiled.breakRuns,
        prepared: prepareParagraph(compiled.items, {
          hangs: compiled.hangs ?? undefined,
          flex: compiled.flex ?? undefined,
        }),
        expansion: compiled.expansion
          ? { flex: compiled.expansion, scale: compiled.scale }
          : null,
        tracking: compiled.tracking,
        authored,
        under: basis,
      },
    }
  }
}
