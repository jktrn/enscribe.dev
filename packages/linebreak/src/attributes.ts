/**
 * `@enscribe/linebreak/attributes` — the HTML contract, and nothing else.
 *
 * Imports nothing, touches no globals, and runs anywhere. Build-time
 * pipelines that emit `atom` or `decoration` markup should import from here
 * rather than hand-typing the strings, so a rename is a type error instead of
 * a silent regression in line quality.
 */
export const ATTRIBUTES = Object.freeze({
  /** Written to a typeset element. Value is the line count. */
  typeset: "data-linebreak-typeset",
  /** Written to each generated line. Value is what ended it. */
  line: "data-linebreak-line",
  /** Written to each copy of an inline wrapper split across lines. */
  fragment: "data-linebreak-fragment",
  fragmentStart: "data-linebreak-fragment-start",
  fragmentEnd: "data-linebreak-fragment-end",
  /** Read: measure this element as one indivisible inline object. */
  atom: "data-linebreak-atom",
  /** Read: a decorative child whose width counts but whose text does not. */
  decoration: "data-linebreak-decoration",
  decorationPosition: "data-linebreak-decoration-position",
  /** Read by `proseBlocks`: leave this subtree ragged. */
  skip: "data-linebreak-skip",
  /** Read by `createTypesetter`: look for paragraphs under here. */
  root: "data-linebreak-root",
})
