# @enscribe/linebreak

Knuth–Plass line breaking for justified web text.

The browser breaks paragraphs one line at a time, taking as much as fits and
moving on. TeX considers the paragraph as a whole and picks the set of breaks
with the lowest total cost, which is why justified TeX has even word spacing
and justified HTML has rivers. This package does what TeX does: it measures an
element, solves for the whole paragraph, and rebuilds it with one span per
line.

```sh
npm install @enscribe/linebreak
```

## Three ways in

| Import | You get | DOM | Dependencies |
| --- | --- | --- | --- |
| `@enscribe/linebreak/auto` | Progressive enhancement with a lifetime | yes | — |
| `@enscribe/linebreak` | The DOM engine; bring your own scheduler | yes | `@chenglou/pretext` |
| `@enscribe/linebreak/layout` | The optimizer alone | no | none |

Import direction is strictly downward, so taking the optimizer does not drag
in the DOM code.

## Zero config

```ts
import { createTypesetter } from "@enscribe/linebreak/auto"
import "@enscribe/linebreak/styles.css"

createTypesetter().start()
```

```html
<article data-linebreak-root>
  <p>Prose here.</p>
</article>
```

That is the whole thing. Discovery, waiting for fonts, viewport laziness,
frame-budgeted batching, reflow on resize, print, and clipboard repair are all
on by default. Without JavaScript the browser justifies the same paragraphs
greedily, so the page degrades cleanly.

`start()` resolves once fonts have settled and the first blocks are written.
`settled` resolves whenever the queue drains, which is what a screenshot test
wants:

```ts
const typesetter = createTypesetter()
await typesetter.start()
await typesetter.settled
```

### Options

| Option | Default | Behaviour |
| --- | --- | --- |
| `roots` | `[data-linebreak-root]`, else `<body>` | Where to look for paragraphs. |
| `skip` | — | Extra selector to leave ragged, on top of the built-in list. |
| `filter` | — | Final say per candidate paragraph. |
| `blocks` | — | Replace discovery entirely. |
| `lazy` | `true` | Typeset near the viewport first. `{ margin }` to tune. |
| `budget` | 12 blocks / 6 ms | Per-frame work budget. |
| `fonts` | `true` | Wait for fonts, and re-measure when more arrive. |
| `resize` | `true` | Reflow when a paragraph's width changes. |
| `print` | `true` | Restore authored content while printing. |
| `copy` | `true` | Register the `copy` handler on `document`. |
| `beforeWrite` / `afterWrite` | — | Bracket every DOM-mutating phase, restores included. |
| `signal` | — | Aborting disposes the typesetter. |

Plus every [engine option](#engine-options).

`beforeWrite`/`afterWrite` exist because rewriting a paragraph changes its
height. Whatever they return is threaded through, so a reading anchor is:

```ts
createTypesetter({ beforeWrite: captureAnchor, afterWrite: restoreAnchor })
```

### Verbs

`start` and `stop` toggle the whole thing. `refresh` re-solves at a new measure
while keeping measurements — the right response to a layout mode change.
`rescan` re-runs discovery after content changes. `typeset` forces work through
immediately, ignoring laziness. `dispose` tears everything down and restores.

## The engine

For a consumer who already owns a scheduler:

```ts
import { createLinebreaker, proseBlocks } from "@enscribe/linebreak"

const linebreaker = createLinebreaker({ hyphenate: true })
const outcomes = linebreaker.typeset(proseBlocks(article))
```

`typeset` is `compose` then `apply`, batched. Splitting them lets you inspect
before writing — `compose` performs layout reads and never touches the DOM,
`apply` writes:

```ts
const compositions = linebreaker.compose(blocks)
const worthIt = compositions.filter((c) => c.status === "ready" && c.lines >= 4)
linebreaker.apply(worthIt)
```

Keep the phases separate. Interleaving a read and a write per paragraph forces
a synchronous layout flush per paragraph; batching costs one.

Every method takes an iterable. A single element is `typeset([element])`.

### Outcomes

Content never throws. Each element comes back with a status, and the invariant
is simple: **anything that is not `typeset` was left in browser line breaking.**

```ts
type Outcome =
  | { element: HTMLElement; status: "typeset"; lines: number; retries: number }
  | { element: HTMLElement; status: "skipped"; reason: SkipReason }
  | { element: HTMLElement; status: "declined"; reason: DeclineReason }
  | { element: HTMLElement; status: "failed"; reason: FailureReason; cause?: unknown }
```

`skipped` is routine and expected — `single-line`, `empty`, `too-narrow`,
`already-typeset`. `declined` means the content cannot be modelled:
`unsupported-content`, `unsupported-direction`, `unsupported-writing-mode`,
`too-long`, `unmeasurable`, `segmentation-mismatch`, `no-feasible-breaking`.
`failed` means it was written and reverted: `layout-mismatch`, `unstable-width`,
`line-height-unresolved`, `render-failed`. The three reason sets are disjoint,
so an element that is remembered from an earlier pass replays under the same
status it first reported.

`isExpected(outcome)` is true for successes and skips. `consoleReporter()`
reports declines and failures and stays quiet about skips, which on a long page
are most paragraphs.

Programmer errors do throw: using a disposed instance, applying a composition
twice, or applying one from another instance.

### Engine options

| Option | Default | Behaviour |
| --- | --- | --- |
| `locale` | nearest `lang`, then `<html lang>`, then `en-US` | Segmentation locale. |
| `minimumWidth` | `240` | Leave narrower elements alone. |
| `hyphenate` | `false` | Dictionary hyphenation. English only. |
| `protrude` | `true` | Character protrusion: punctuation hangs past the measure. |
| `preserveImageAttributes` | `[]` | Copied between original and rebuilt images. |
| `policy` | TeX's | Tolerances, demerits, penalties. See below. |
| `glue` | `{ stretch: 1/2, shrink: 1/3 }` | Interword elasticity, as a fraction of the space. |
| `safetyMargin` | `0.5` | Sub-pixel pad against layout quantization. |
| `retries` | `3` | Re-solve rounds when a rendered line wraps anyway. |
| `maximumCharacters` | `3000` | Refuse paragraphs longer than this many collapsed characters. |
| `onOutcome` | — | Streams every outcome. |

## The optimizer

`@enscribe/linebreak/layout` has no DOM and no dependencies. Give it items with
widths and a measure:

```ts
import { box, breakParagraph, glue, paragraphEnd } from "@enscribe/linebreak/layout"

const items = [box(40), glue(4, 2, 1.33), box(55), ...paragraphEnd()]
const result = breakParagraph(items, 380)

if (result.ok) {
  for (const line of result.lines) draw(line)
}
```

Items are boxes, glue, penalties, and discretionaries, as in the paper.
`lineBreak()` builds TeX's `\nobreak\hfil\break`; `paragraphEnd()` builds
`\parfillskip` plus `\penalty-10000`, and every paragraph must end with it.

`breakParagraph` runs TeX's full ladder and reports which pass succeeded.
`breakParagraphOnce` is a single pass at an explicit tolerance, for
differential testing against `\tracingparagraphs=1`.

### Fidelity

This follows TeX82 rather than the 1981 paper wherever the two disagree, since
every constant it ships comes from `plain.tex`. Most visibly, demerits for a
positive penalty are `(linepenalty + badness)² + penalty²` (tex.web §859), not
the paper's `(1 + badness + penalty)²`.

`texDefaults` is `plain.tex` verbatim, frozen:

| | | |
| --- | --- | --- |
| `pretolerance` | 100 | first-pass badness threshold |
| `tolerance` | 200 | threshold for later passes |
| `linePenalty` | 10 | `\linepenalty` |
| `hyphenPenalty` | 50 | `\hyphenpenalty` |
| `exHyphenPenalty` | 50 | `\exhyphenpenalty` |
| `adjDemerits` | 10000 | `\adjdemerits` |
| `doubleHyphenDemerits` | 10000 | `\doublehyphendemerits` |
| `finalHyphenDemerits` | 5000 | `\finalhyphendemerits` |

Tolerances are badness values, as in TeX, so `\tolerance=400` transfers
directly. The four passes are `\pretolerance`, `\tolerance`,
`\emergencystretch`, then artificial demerits. Emergency stretch goes into the
badness denominator rather than being added as real glue, matching
`background[2] := background[2] + emergency_stretch`.

Known divergences: `\looseness` is not implemented, and hyphenation points are
compiled once and stay live in every pass, where tex.web §863 suppresses them
in the first one.

That second divergence is deliberate and should stay. A first pass that cannot
see hyphens can still succeed, and when it does the paragraph never reaches the
pass that would have hyphenated it, so §863 locks in the worse layout whenever
an unhyphenated break sequence happens to land inside `pretolerance`. Measured
against a §863-faithful engine over a 1,007-paragraph prose corpus at 680px
with hyphenation on: that engine settles 879 paragraphs in pass 1, this one
981. Over the 984-paragraph prose subset of the same run, this engine scores
10.9 badness per line against the other's 14.6. Skipping pass 1 on both sides
closes the gap exactly — 10.9 against 10.9 — which is what identifies pass 1 as
the whole of the difference. With hyphenation off there are no discretionaries
to disagree about, and both engines settle the same 879 paragraphs in pass 1.

The cost is that pass 1 here carries every discretionary, so a paragraph a §863
engine rejects cheaply is more expensive to reject, which is where this engine
loses its one break-time cell to that comparison. Restoring §863 would buy back
that cell and give up the badness difference. The behaviour is pinned by
`tests/linebreak/unit/pass-one-hyphenation.test.ts`.

### Character protrusion

Punctuation at a line edge leaves the margin looking ragged: a line ending in a
comma reads as short, and one opening with a quote reads as indented.
Protrusion hangs the offending glyph slightly outside the measure so the
optical edge is flush. The amounts are microtype's, in thousandths of the
glyph's own advance, extracted from `microtype.dtx` by
`tools/gen-protrusion.mjs`. Only punctuation and symbols are in the table:
ablating it by character class showed letters and digits earn nothing and cost
something.

It is an optimizer feature, not a rendering one. The credit comes off a
candidate line's width inside the dynamic program, so the breaker chooses
different breaks. Hanging the glyphs after the breaks are chosen is worse than
not hanging them at all, because the hang shortens an already-loose line and it
stretches further.

Over a 984-paragraph prose corpus with hyphenation on, badness per body line
goes 312.7 to 297.0 at 320px, 28.7 to 25.9 at 480px, and 10.9 to 8.9 at 680px.

Nothing hangs out of a `<code>` run, out of an atom, or out of a box that
absorbed an inline wrapper's padding or border, because in those cases the
glyph is not the outermost painted thing on the line.

`protrude: false` turns it off, and the layout is then identical to a build
without the feature. So does the engine: the whole feature rests on a negative
`margin-inline-end` shortening a line box's advance, so the first paragraph
typeset measures whether it does — two spans off-screen, one of them given a
-16px end margin, and the other has to move. An engine that does not honour it
would let the optimizer spend a credit the render cannot pay back, up to one
hang per line, so protrusion turns itself off there instead.

The table is derived from [microtype](https://ctan.org/pkg/microtype)
(R Schlicht), LPPL 1.3c.

## The rendered DOM

```html
<p data-linebreak-typeset="3">
  <span data-linebreak-line="space">First line</span>
  <span data-linebreak-line="hyphen">Second li</span><wbr>
  <span data-linebreak-line="end">ne and the rest.</span>
</p>
```

The paragraph stays a single inline formatting context. Each line is an inline
span that cannot wrap internally, and the break opportunity sits between spans:
a space where the break consumed one, `<wbr>` where it consumed nothing, and a
real `<br>` for an authored break. The browser then places one span per line,
and `text-align: justify` on the paragraph stretches each line to the measure.

`data-linebreak-line` records what ended the line: `space` (the break consumed
an inter-word space), `hyphen` (a word was split and the stylesheet draws the
hyphen), `forced` (an authored `<br>`), `none` (no character was consumed), and
`end` (the paragraph's last line).

Rendering this way rather than as one block per line matters for two reasons.

The paragraph keeps its intrinsic size. A stack of block lines reports a
`max-content` width of its longest line, which is narrower than the measure it
was solved against — by exactly the amount justification stretches. Any
container sized by its contents then shrinks, which changes the measure, which
invalidates the lines. Inline segments report the same `max-content` as the
authored text, so nothing moves.

And the text stays one run. Block lines segment the rendered text, so
find-in-page, scroll-to-text fragments, translation and `textContent` all break
at every line boundary. Verified in Chromium: searching a phrase that spans a
line break succeeds here and fails under block-per-line.

A protruding line carries a negative `margin-inline-start` or
`margin-inline-end` equal to its hang, which is what makes the glyph sit
outside the measure in the browser as well as in the model, and what lets
`text-align: justify` stretch the line to the measure the optimizer solved for
rather than to the box.

Those margins are part of every line span's intrinsic contribution, so they do
reduce the paragraph's `max-content`, by the sum of the hangs. That is
invisible whenever the available width decides the measure, which is the
ordinary case: a paragraph whose `max-content` is below the space available is
one line long, and one-line paragraphs are skipped. It is visible when authored
`<br>`s hold a paragraph to several lines that are each narrower than the space
available — then `max-content` really does govern, the box moves by the hangs
after the write, and the element is restored and reported as `unstable-width`.
`protrude: false` typesets it.

When a break cuts through an inline wrapper, each copy gets
`data-linebreak-fragment`, and the outermost copies also get
`-fragment-start` / `-fragment-end`. Only the first fragment keeps the `id`.

Import the stylesheet. It ships two cascade layers: `linebreak.core` holds
rules the output is not correct without, and `linebreak.theme` holds
presentation you are meant to override. Both are layered, so unlayered CSS in
your own project wins without `!important`. The hyphen is
`var(--linebreak-hyphen, "\2010")`.

## Attributes it reads

Import them from `@enscribe/linebreak/attributes` — a subpath with no imports
at all, so a build-time pipeline can share the contract with the runtime.

| Attribute | Use |
| --- | --- |
| `data-linebreak-root` | Look for paragraphs under here. |
| `data-linebreak-skip` | Leave this subtree ragged. |
| `data-linebreak-atom` | Measure as one indivisible inline object. |
| `data-linebreak-decoration` with `aria-hidden="true"` | A decorative child whose width counts but whose text does not. |
| `data-linebreak-decoration-position="after"` | Assign that decoration to the trailing edge. |

`text-wrap-mode: nowrap` prevents automatic breaks inside its range; an
authored `<br>` or `<wbr>` still applies.

## Copying

One span per line changes how the browser serializes a selection. Register the
handler and copied text comes out as authored:

```ts
import { handleCopy } from "@enscribe/linebreak"
document.addEventListener("copy", handleCopy, { signal })
```

`createTypesetter` does this for you unless you pass `copy: false`. A selection
containing no generated lines is left alone.

## What it will not do

Left-to-right, horizontal writing mode, and normal whitespace collapsing only.
Elements are declined for right-to-left direction, vertical writing modes,
nested block layout, enabled `<input>`s, nonzero `word-spacing`, a
`text-transform` other than `none`, and more than 3,000 collapsed characters.

The element must be in the document with fonts loaded before it is measured;
`createTypesetter` handles the waiting.

An ancestor with `overflow: hidden` or `clip` cuts a protruding glyph off
mid-stroke. Nothing inside the library can see that ancestor; set
`protrude: false` for such a subtree.

A materialized hyphen is modelled as U+002D while the stylesheet draws
`var(--linebreak-hyphen, "\2010")`. Overriding that custom property with a
glyph of a different width makes both the measured width and the hang wrong.

Rendering clones inline elements, so event listeners and arbitrary object state
on them are not preserved. `preserveImageAttributes` covers attributes that
change after load.

Canvas `measureText` cannot express `font-variant-caps`, `font-variant-numeric`
or `font-feature-settings`, so glyph substitutions such as small caps and
old-style figures change advance widths without changing the font canvas
resolves — measurement is then wrong with no error. Bake those features into
the served font files.

An element whose width depends on its own content — a shrink-to-fit flex item,
a float, `width: fit-content` — usually resolves to the space available, and
inline segments preserve the paragraph's `max-content`, so typesetting does not
change the measure. Where `max-content` genuinely governs, protrusion's
negative margins do change it; the element is then restored and reported as
`unstable-width`. If a layout moves after a write for any other reason, the
same thing happens.

## Development

```sh
bun run build          # tsdown, publint, arethetypeswrong
bun run typecheck
bun test               # from the repo root
```

`@chenglou/pretext` is a pre-1.0 dependency reached through non-public types.
Pin it.

MIT.
