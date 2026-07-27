# @enscribe/linebreak

`@enscribe/linebreak` chooses line breaks for justified browser text with the
Knuth–Plass algorithm. It measures the text and inline content in an element,
selects breaks for the paragraph as a whole, and rebuilds the element with one
span per line.

This is a private workspace package for enscribe.dev and is not published to npm.

## Basic use

Import the JavaScript API and its stylesheet:

```ts
import { cleanCopiedLinebreaks, createLinebreaker } from "@enscribe/linebreak"
import "@enscribe/linebreak/styles.css"

const linebreaker = createLinebreaker({
  locale: document.documentElement.lang,
  minimumWidth: 240,
  hyphenate: true,
  preserveImageAttributes: ["data-loaded"],
  onDiagnostic: (diagnostic) => {
    console.warn(diagnostic.kind, diagnostic.element)
  },
})

const blocks = [...document.querySelectorAll<HTMLElement>(".prose p")]
const plans = blocks.map((block) => linebreaker.plan(block))
const results = linebreaker.commit(plans)

document.addEventListener("copy", cleanCopiedLinebreaks)
```

Create every plan in a batch before calling `commit`. Planning reads layout;
committing rewrites the elements and checks the result. Keeping those phases
separate avoids alternating a layout read and DOM write for every paragraph.

For one element, `typeset(element)` is shorthand for
`commit(plan(element))`. Both methods also accept an iterable:

```ts
const results = linebreaker.typeset(blocks)

for (const result of results) {
  if (result.state === "typeset") {
    console.log(result.lineCount)
  } else {
    console.log(result.reason)
  }
}
```

## Site block discovery

The enscribe.dev integration discovers prose below each
`[data-typeset-root]`. It uses computed `display` values to find leaf blocks, so
flex containers can make normally inline children eligible for typesetting. For
example, a title link becomes a block when it is a flex item.

Add `data-typeset-skip` to an element that should remain ragged. The collector
skips that element and its descendants.

## Options

| Option | Default | Behavior |
| --- | --- | --- |
| `locale` | `<html lang>`, then `en-US` | Sets the fallback locale for segmentation. The nearest `lang` attribute on each element takes precedence. |
| `minimumWidth` | `0` | Returns `insufficient-width` and leaves the element unchanged when its content box is narrower than this value. |
| `hyphenate` | `false` | Allows dictionary-based breaks inside English words. |
| `preserveImageAttributes` | `[]` | Copies the named attributes between original and rebuilt images at the same DOM index when their counts match. |
| `onDiagnostic` | none | Receives failures that need attention. Expected native outcomes are filtered out. |

Dictionary hyphenation is limited to English locale tags. Text inside `<code>`
uses separate break rules for paths, operators, identifiers, and letter-number
boundaries whether or not dictionary hyphenation is enabled.

## Results

A successful result includes the number of rendered lines:

```ts
type LinebreakResult =
  | {
      element: HTMLElement
      state: "typeset"
      lineCount: number
    }
  | {
      element: HTMLElement
      state: "native"
      reason: DiagnosticKind
    }
```

`native` means the plan did not create a new set of line spans. Authored content
stays in place if the element has not been typeset. If it has, a native result
may leave the generated lines in place. Call `restore()` or `invalidate()` before
planning when you need to start from the authored content.

A plan returns `native` when the element does not need typesetting, uses
unsupported content, cannot be rendered reliably, or refers to a cached
measurement that is no longer current.

## Lifecycle

`restore(element)` replaces generated lines with the captured authored content.
It also accepts an iterable.

`invalidate(element)` restores the element and removes its cached measurement.
Call it after changing the element's content or any style that affects
measurement. With no argument, `invalidate()` restores every cached element and
clears the typography cache.

An outstanding plan becomes stale when its cached measurement is discarded or
replaced. `invalidate()` and `destroy()` discard measurements; a later `plan()`
replaces one when the element's locale, font, or letter spacing has changed.
Committing a stale plan returns `stale-plan` without changing the element. Use a
new plan after `invalidate()`, or the replacement plan after a typography
change. `restore()` keeps the measurement, so existing plans remain valid.

`readMetrics()` returns the current cache sizes:

```ts
const {
  cachedParagraphs,
  cachedTypographies,
} = linebreaker.readMetrics()
```

`destroy()` restores every cached element, clears both caches, and disables the
instance. Create another linebreaker before typesetting again.

## Supported content

The package supports left-to-right elements whose text uses normal CSS
whitespace collapsing. It reads computed styles, so the element must be
connected to the document and its fonts must be loaded before planning.

Text can contain ordinary inline HTML, `<br>`, `<wbr>`, images, inline math,
ruby, disabled inputs, and elements whose display creates an atomic inline box.
The package clones inline wrappers when a break crosses them.

These attributes describe content that needs special treatment:

| Attribute | Use |
| --- | --- |
| `data-linebreak-atom` | Measures the element as one indivisible inline object. |
| `data-linebreak-decoration` with `aria-hidden="true"` | Excludes a direct decorative child from text while including its width with the surrounding wrapper. |
| `data-linebreak-decoration-position="after"` | Assigns that decoration to the wrapper's trailing edge. Without it, the decoration belongs to the leading edge. |

`text-wrap-mode: nowrap` prevents automatic breaks inside its range. An authored
`<br>` or `<wbr>` still applies.

A plan returns `native` when the element contains layout the package cannot
model. This includes:

- right-to-left direction;
- non-collapsing whitespace;
- nested block layout;
- enabled `<input>` elements;
- nonzero `word-spacing`;
- a `text-transform` value other than `none`;
- more than 3,000 collapsed characters.

Rendering clones inline elements, so it cannot preserve their event listeners or
arbitrary object state. `preserveImageAttributes` covers image attributes that
change after load.

## Rendered DOM

Typesetting replaces the element's children and adds
`data-linebreak-typeset="<line count>"`. Each direct child is a line span:

```html
<p data-linebreak-typeset="3">
  <span data-linebreak-break="space">First line</span>
  <span data-linebreak-break="hyphen">Second line</span>
  <span data-linebreak-break="forced">Third line</span>
</p>
```

The value of `data-linebreak-break` records what ended the line:

| Value | Meaning |
| --- | --- |
| `space` | The break consumed an inter-word space. |
| `hyphen` | The break split a word and the stylesheet draws a hyphen. |
| `forced` | An authored `<br>` ended the line. |
| `none` | The break consumed no character, as with a code break or `<wbr>`. |

The stylesheet makes each line a block and justifies it. The last line and lines
ended by `<br>` remain ragged. A hyphen is generated with `::after`, so it does
not enter copied text or `textContent`.

When a line break cuts through an inline wrapper, each copy receives
`data-linebreak-fragment`. The copies at the original start and end also receive
`data-linebreak-fragment-start` and `data-linebreak-fragment-end`. The stylesheet
removes padding, borders, margins, and corner radii from the cut edges. Only the
first fragment keeps the original `id`.

## Copying text

One span per line changes the browser's normal text extraction. A visual break
may stand for a consumed space, an authored newline, or no character at all.

Register `cleanCopiedLinebreaks` on `document` to correct both clipboard formats:

```ts
const controller = new AbortController()

document.addEventListener("copy", cleanCopiedLinebreaks, {
  signal: controller.signal,
})

controller.abort()
```

The handler only intercepts a selection that contains generated line spans. It
reconstructs plain text from the live range, restores spaces and `<br>` elements
where the break kind requires them, removes generated line wrappers, and strips
`data-linebreak-*` attributes from the HTML copy.

A hyphenated break creates a real DOM boundary inside a word. Generated hyphens
stay out of the text, and copying rejoins the word, but browser find-in-page may
treat the two fragments as separate text.

## Diagnostics

`onDiagnostic` reports unsupported content, stale plans, and layout failures:

| Kind | Meaning |
| --- | --- |
| `unsupported-element` | The element contains layout the extractor cannot represent. |
| `content-too-long` | Collapsed text exceeds the 3,000-character limit. |
| `segmentation-mismatch` | Measured segments do not reproduce the extracted text. |
| `measurement-unavailable` | A required width or typography could not be measured. |
| `stale-plan` | The plan refers to a cached measurement that was discarded or replaced. The element is unchanged. |
| `no-feasible-breaking` | The optimizer could not cover the paragraph at the requested width. |
| `line-wrapped` | A generated line wrapped inside its own span after retries. |
| `line-height-unresolved` | Verification could not determine a numeric line height. |
| `render-failed` | Rebuilding the DOM failed. |

The following native outcomes do not call the diagnostic handler:
`empty-content`, `single-line`, `insufficient-width`, and
`unsupported-direction`. They still appear as the `reason` on a native result.

Exceptions thrown by the diagnostic handler are ignored so a reporting failure
cannot stop typesetting.

## How layout works

The implementation has five stages:

1. DOM extraction collapses whitespace across inline boundaries and records
   text, atomic content, authored breaks, wrapper edges, and no-wrap ranges.
2. `@chenglou/pretext` measures the text for each computed typography.
3. Compilation converts the measured runs into boxes, adjustable spaces, and
   break penalties.
4. The Knuth–Plass search chooses a complete set of breaks. It first uses the
   normal tolerance, then a relaxed tolerance, then a forced fallback.
5. Rendering rebuilds the inline DOM and verifies that every generated line
   stayed on one browser row.

If verification finds a wrapped line, the package solves the paragraph again at
measures reduced by 1%, 3%, and 9%. If all retries fail, it restores the authored
content and returns a native result.

Measurements are cached per element. Font metrics are shared by locale, resolved
font, and letter spacing. Planning at a new width reuses those measurements and
runs the line search again.

## Source map

| Path | Purpose |
| --- | --- |
| `src/linebreaker.ts` | Public lifecycle, caches, batching, retries, and restoration. |
| `src/dom` | DOM extraction, style reads, rendering, clipboard cleanup, and authored snapshots. |
| `src/text` | Text measurement, English hyphenation, and code break opportunities. |
| `src/layout` | Item compilation and Knuth–Plass line search. |
| `src/policy.ts` | Tolerances, penalties, limits, and spacing ratios. |
| `tests/linebreak/unit` | Optimizer, hyphenation, diagnostics, and code-break tests. |
| `tests/linebreak/e2e` | Chromium, Firefox, and WebKit checks against the built site. |
| `tests/linebreak/package` | Packed-package and consumer checks. |

## Development

Run commands from the repository root:

```sh
bun run linebreak:build
bun run --cwd tests/linebreak test:unit
bun run --cwd tests/linebreak test:package
bun run --cwd tests/linebreak test:e2e
bun run linebreak:check
```

The E2E command builds the site before starting Playwright. The full
`linebreak:check` command type-checks and builds the package, runs unit and
package-consumer tests, builds the site, and runs the browser suite.
