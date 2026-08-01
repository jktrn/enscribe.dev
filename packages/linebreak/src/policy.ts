/**
 * Defaults for the DOM engine. Typographic constants live in
 * `layout/policy.ts`; these are the browser-specific ones.
 */
export const engineDefaults = Object.freeze({
  /**
   * Content box width below which an element is left to the browser. Zero
   * would let `display: none` elements through and burn a full measure.
   */
  minimumWidth: 240,
  /**
   * Sub-pixel pad against browser layout quantization. Canvas returns
   * unquantized doubles while layout quantizes to 1/64 px (Blink, WebKit) or
   * 1/60 px (Gecko), so the measure is shaved slightly.
   */
  safetyMargin: 0.5,
  /** Re-solve rounds when a rendered line wraps anyway: 1%, 3%, 9%. */
  retries: 3,
  retryReduction: 0.01,
  /** Refuse paragraphs longer than this; the search is superlinear in breaks. */
  maximumCharacters: 3_000,
})
