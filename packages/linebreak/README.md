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

## Four ways in

| Import | You get | DOM | Dependencies |
| --- | --- | --- | --- |
| `@enscribe/linebreak/auto` | Progressive enhancement with a lifetime | yes | — |
| `@enscribe/linebreak` | The DOM engine; bring your own scheduler | yes | `@chenglou/pretext` |
| `@enscribe/linebreak/text` | The compiler, fed by your own widths | no | none |
| `@enscribe/linebreak/layout` | The optimizer alone | no | none |

Import direction is strictly downward, so taking the optimizer does not drag
in the DOM code. The English pattern table is a fifth entry,
`@enscribe/linebreak/hyphenation`, and no other entry reaches it: a consumer
who does not hyphenate never parses it.

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

### Loading and first paint

Where the script tag goes decides how long a reader looks at the browser's own
justification, and it decides very little else. One long article of this site's
prose against a frozen build, Chromium, 6x CPU throttle, fast 3G, twenty cold
loads per variant, medians, timed from navigation start:

| Script tag | First contentful paint | First typeset | Unjustified window |
| --- | --- | --- | --- |
| End of `<body>`, as shipped | 3528 ms | 6782 ms | 3254 ms |
| End of `<body>`, `fetchpriority="low"` | 3208 ms | 8665 ms | 5457 ms |
| In `<head>`, plain | 3624 ms | 6193 ms | 2569 ms |
| In `<head>`, `blocking="render"` | 5378 ms | 5791 ms | 413 ms |
| No typesetter at all | 3204 ms | — | — |

`blocking="render"` buys the shortest unjustified window and pays 1850 ms of
first paint for it. It only does anything in `<head>`. The attribute holds up
rendering until the script has run, and a `type="module"` tag discovered at the
end of `<body>` has nothing left to hold up, so the same markup pasted into a
body-level component is a silent no-op that measures like the first row rather
than the fourth.
Layout shift is 0.000 in every variant measured, with the typesetter absent,
eager and deferred: the greedy paint and the justified one occupy the same box,
so the cost of a long unjustified window is that the text changes shape under
the reader, not that anything moves.

No placement makes the first justified paragraph arrive before the fonts do.
`start()` awaits `document.fonts.ready`, which resolved at 4520 ms in the cell
above, and that is a deliberate trade: canvas measurement in the fallback face
returns advances the real face will not honour, so a paragraph set early is set
to a break sequence the swap invalidates, and every line in it moves. justif
trades the other way — its own documentation says text in a font that is still
loading is justified in the fallback and re-justifies when the font arrives.
This library leaves the browser's greedy justification alone until it can
measure the face the reader will actually read, and then writes once.

What the entry costs before any of that is bytes, not evaluation. Bundled and
minified for a browser with dependencies inlined, the typesetter, the reporter
and the hyphenator together are 145,062 B, or 51,623 B gzipped. The typesetter
without the hyphenator is 95,104 B, or 32,292 B gzipped: the en-US pattern table
is 49,780 B of the total and 19,271 B of the gzipped total, a third of what the
page downloads. A reader who wants first paint back should drop the hyphenator
or lower the tag's fetch priority. Deferring the engine's evaluation instead
buys nothing, which is [measured below](#a-lazy-auto-entry).

## The engine

For a consumer who already owns a scheduler:

```ts
import { createLinebreaker, proseBlocks } from "@enscribe/linebreak"
import { englishHyphenator } from "@enscribe/linebreak/hyphenation"

const linebreaker = createLinebreaker({ hyphenate: englishHyphenator })
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
| `hyphenate` | — | A hyphenator. `englishHyphenator` is the one that ships; see below. |
| `protrude` | `true` | Character protrusion: punctuation hangs past the measure. |
| `expand` | `false` | Font expansion: glyphs take a share of the line's slack, if the font has a width axis. |
| `track` | `false` | Letterfit tracking: the inter-character space takes a share of the line's slack. |
| `lastLineMinWidth` | `0` | Least width a paragraph's final line may take, as a fraction of the measure. `0` is off. |
| `preserveImageAttributes` | `[]` | Copied between original and rebuilt images. |
| `policy` | TeX's | Tolerances, demerits, penalties. See below. |
| `glue` | `{ stretch: 1/2, shrink: 1/3 }` | Interword elasticity, as a fraction of the space. |
| `safetyMargin` | `0.5` | Sub-pixel pad against layout quantization. |
| `retries` | `3` | Re-solve rounds when a rendered line wraps anyway. |
| `maximumCharacters` | `3000` | Refuse paragraphs longer than this many collapsed characters. |
| `onOutcome` | — | Streams every outcome. |

### Hyphenation

`hyphenate` takes the hyphenator rather than a flag, because the pattern table
is the single most expensive thing this package can load and a flag would make
every consumer pay for it at import:

```ts
import { englishHyphenator } from "@enscribe/linebreak/hyphenation"

createTypesetter({ hyphenate: englishHyphenator })
```

`hyphen`'s `en-us` table is about 100 KB of patterns, and parsing it costs
around 8 ms in a cold process against 9 ms for the whole DOM engine. Behind
the option, that is 8 ms nobody spends by accident.

A hyphenator is `(word, locale) => readonly number[]`, returning the code-unit
offsets inside `word` where a break may go. `englishHyphenator` returns nothing
for words shorter than five characters and nothing at all when `locale` is not
English, so a `lang="fr"` paragraph is left alone rather than hyphenated with
English patterns.

`englishHyphenator` remembers what it has already worked out, keyed on the word
and the locale together. Prose repeats itself: over a 600,202-character corpus
the compiler asks for 104,330 words and only 18,175 of them are distinct, so
five calls in six are a repeat. The memo takes hyphenation from 61% of a build
to 38% of a build 40% smaller, and a whole pass over that corpus from 137 ms to
69 ms.

The cache holds at most 16,384 distinct words. That is about 0.9 MB, and about
three times what this site's entire prose asks for; the largest single document
in the corpus wants 6,627. Reaching the bound empties the cache and starts
again, which costs one recomputation per word and can never be worse than not
caching at all. There is no eviction policy beyond that on purpose: keeping an
LRU order would tax every hit to improve a case a page has to be several books
long to reach.

Because the results are shared, the array a hyphenator returns must be treated
as read-only. The type says so; nothing enforces it at runtime.

A hyphenator you supply is not memoized, because only a pure one can be. If
yours is pure, wrap it yourself.

### Soft hyphens

An authored `&shy;` is a break opportunity, and it is honoured whether or not
a hyphenator is supplied — `hyphenate` only adds dictionary points on top. U+00AD
compiles to a discretionary whose pre-break text is a hyphen, charged
`hyphenPenalty` rather than `exHyphenPenalty` because it prints something when
taken (tex.web §869), and flagged, so it pays the double- and final-hyphen
demerits like a dictionary point does.

The break sits after the character, so an unused soft hyphen stays inline at
zero width and a used one stays at the end of the line it was authored in.
That keeps the rendered text equal to the authored text, which is what restore,
copy and `textContent` compare against. A soft hyphen inside a
`text-wrap-mode: nowrap` range stays inert, like any other break opportunity
there.

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

Signs mean what they mean in TeX. A negative `pretolerance` skips the first
pass outright (tex.web §863) instead of opening it, and a negative `tolerance`
admits nothing, since badness is never negative. Both are closed bands. The
forcing pass still ranks its rescue candidates by how far each one misses the
band, so a negative threshold does not make it pick an overfull line over a
merely loose one.

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

### First-line indent

`text-indent` is read off the block and charged to the first line as TeX
charges `\parindent`: an empty box at the head of the paragraph. The optimizer
solves against one scalar measure, and the first line's natural width is its
content plus the indent, so the line that has less room is the line that gets
priced for less room. Percentages resolve against the content width, which is
what a browser does with them. A negative indent is the same arithmetic with
the sign flipped, so the classic first-line outdent gets its extra room
instead.

This is the whole of it — no per-line width vector, and none of the
`easy_line` bookkeeping one would need. `text-indent: … hanging` and
`text-indent: … each-line` move some line other than the first, which a
first-line scalar cannot express; both are declined `unmeasurable`.

Ignoring the property is not a neutral choice. Every typeset line is an inline
`nowrap` span in one block box, so the browser still indents the first line
box, and a first line the model sized for the full measure then pokes out of
it. Measured in Chromium at a 520px measure before this landed: a 48px indent
was caught by the overflow guard and cost three retries, each one narrowing
*every* line's target, and 0.7px still escaped; a 10% indent (52px) exceeded
the retry ladder's reach and reverted the paragraph outright; a −32px outdent
overflowed nothing, was caught by nothing, and silently rendered its first line
32px looser than the optimizer had priced it.

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

Nothing hangs out of a monospace run set inside another font's prose either.
The codes are advance-relative, and a monospace advance is a fixed cell much
wider than the ink standing in it: a mono `.` hangs its ink 3.12px past the
margin against the body font's 1.80px, and a mono `(` is displaced into the
margin while its ink never reaches it. The run is identified by its own
advances — `i` and `M` the same width — rather than by its tag, so `<kbd>`, a
themed `<span>` and a family named without the `monospace` keyword are all
caught. A paragraph set in a monospace font owns its own margin and still
protrudes.

`protrude: false` turns it off, and the layout is then identical to a build
without the feature. So does the engine: the whole feature rests on a negative
`margin-inline-end` shortening a line box's advance, so the first paragraph
typeset measures whether it does — two spans off-screen, one of them given a
-16px end margin, and the other has to move. An engine that does not honour it
would let the optimizer spend a credit the render cannot pay back, up to one
hang per line, so protrusion turns itself off there instead.

The table is derived from [microtype](https://ctan.org/pkg/microtype)
(R Schlicht), LPPL 1.3c.

### Font expansion

`expand: true` lets the glyphs take a share of what a line is short or long by,
so the spaces do not have to take all of it. This is microtype's `hz`. Like
protrusion it is an optimizer feature: each box earns a budget, the budgets are
prefix-summed and folded into the line's elasticity inside the dynamic program,
so `r = (W - L) / (Y + Yglyphs)` and the breaker picks different breaks.
Deciding the percentage only after the breaks are chosen is worth less where
the measure is hard: on the same corpus that is 164.7 badness per body line
against 48.9 at 320px and 10.1 against 9.6 at 480px. At 680px, where every
arrangement is already good, it is the other way round: 2.7 against 4.9.
Neither arm has an overfull line at any width.

Each line is then re-solved and set at one `font-stretch` percentage, quantized
to a rung the font actually honours.

It is off by default and gated on measurement, because a `wdth` percentage is
not a width ratio. pdfTeX's `hz` applies an affine horizontal scale; CSS
font-stretch interpolates between designed masters, and what a percentage point
buys depends on the font, and on the size, and on whether advances snap. So the
first paragraph in a given font calibrates: an off-screen span in that exact
font is measured at each rung, and the table that comes back holds only the
rungs that font answered distinctly. A font that does not move is declined, and
declined means the expansion path is never entered at all — not entered and
found empty. Two admission rules separate an axis from a face swap, which CSS
font matching will hand you instead: the advance must move monotonically with
the percentage, and no single point may move it more than 2%. The budget is a
ceiling, not a target: a rung that lands past it is left off the table, so a
staircase response cannot hand the optimizer more width than was asked for, and
a font whose first distinct rung on either side already overshoots contributes
nothing on that side.

A paragraph mixing two width axes does not expand, because one `font-stretch`
declaration goes on the line and it inherits. A run whose font has no axis is
fine to mix in: it contributes nothing and moves not at all. Nothing is budgeted
for an atom, for a materialized hyphen, or for a box that absorbed a wrapper's
padding, for the same reason nothing hangs out of them.

An authored `font-stretch` or a `wdth` in `font-variation-settings` declines the
paragraph outright. The computed `font` shorthand does not carry either one, so
the measurement would be taken at a width the render does not use, and the
per-line declaration would clobber the author's anyway.

What this is worth depends entirely on the font. Against an idealized affine
axis — ±2% of width, quantized to half a point, which is what justif's own
expansion model assumes — badness per body line over the 984-paragraph prose
corpus goes 297.0 to 48.9 at 320px, 25.9 to 9.6 at 480px, and 8.9 to 4.9 at
680px, with no overfull lines at any width. Real fonts deliver less: IBM Plex
Sans at 16px in Chromium moves about 0.56% of advance over two percentage
points, and its `wdth` axis tops out at the default width, so it can condense
and cannot widen.

### Letterfit tracking

`track: true` lets the inter-character space take a share of what a line is
short or long by, the way `expand` lets the glyphs take one. It is the third
optimizer feature and it works the same way: each box budgets 3% of its own set
width, the budgets are prefix-summed and folded into the line's elasticity
inside the dynamic program, so `r = (W - L) / (Y + Ytrack)` and the breaker
picks different breaks. 3% of a box's width spread over that box's characters
is about 15/1000 em at saturation, inside Bringhurst's tolerance for
letterspacing variation in justified text.

Unlike expansion it is exact in the optimizer. The width axis is quantized —
a line is set at one of the rungs the font honours, so the px it buys has to be
re-solved after the breaks are chosen — while letterfit is continuous and flexes
at the same ratio as the glue, which is why it can share the glue's pool
outright. Beyond ratio 1 it saturates at its budget and the spaces carry on
alone, so no line is letterspaced past what it was budgeted, not even on an
emergency pass. A paragraph ending never opens: its slack is parfillskip's, and
a letterspaced ragged line reads as a mistake. An ending too long for the
measure still closes, because that excess is real.

The two axes compose on one line. The quantized one spends first, and the
letterfit takes its proportional share of what is left against the continuous
pool alone, so the two never double-spend the same slack. Nothing is budgeted
for an atom, for a materialized hyphen, or for a box that absorbed a wrapper's
padding, for the same reason nothing hangs out of them — but unlike expansion,
a run whose font has no width axis still letterfits, because every face can be
letterspaced. That is the practical difference between the two: expansion needs
a variable font and tracking does not.

A paragraph whose runs do not share one `letter-spacing` does not letterfit, for
the reason a paragraph mixing two width axes does not expand: one declaration
goes on the line and it inherits, so it would have to overwrite a value some run
was measured at. Where they do share one, the line's declaration is the author's
value plus the letterfit, not the letterfit alone.

Against the same 3% budget on both sides, badness per body line over the
984-paragraph prose corpus goes 297.0 to 28.3 at 320px, 25.9 to 7.6 at 480px,
and 8.9 to 3.2 at 680px, with no overfull lines at any width. With the
idealized affine width axis on as well it reaches 14.3 / 5.2 / 1.7.

Three declarations end up on the same line span when all three features are on
— `letter-spacing`, `font-stretch` and a negative `margin-inline-end` — and that
composition is checked in headless Chromium against a font with a real response
to `font-stretch`: the justified right edge lands within 0.01px of the measure,
no line's ink passes the content box by more than its own hang, and restoring
gives back byte-identical markup.

Tracking costs break time, and the cost is not uniform. Measured over the
1007-paragraph corpus against the same configuration without it, break time
goes to 0.60x at 320px, 1.98x at 480px and 2.07x at 680px, 1.31x summed over
the three. Added on top of expansion it is a flat 1.55–1.61x at every measure.
The letterfit budget is a second prefix-sum pair on every candidate line inside
the dynamic program.

### Last-line minimum width

TeX's `\parfillskip` problem: `\parfillskip` is infinitely stretchable, so a
paragraph's final line costs nothing however short it is, and about a quarter
of prose paragraphs end on a line under a third of the measure. `lastLineMinWidth`
is a floor on that line, as a fraction of the measure. It ships off (`0`).

This is not eTeX's `\lastlinefit`, which is a different feature and is declined
below.

Two mechanisms, in order. A **strict rung** runs the pretolerance and tolerance
passes ahead of the classic ladder with final breaks below the floor rejected
outright, so the optimizer solves for the best body it can build among the
arrangements that satisfy the floor. When no arrangement does — the floor is
unreachable at any tolerance the paragraph will accept — the classic ladder runs
with a **continuous demerit** on the final break: `200 · u³` badness, where `u`
is the shortfall as a fraction of the floor, folded into the same
`(linePenalty + badness)²` every other line pays. The demerit alone is far
weaker than the rung (the DP keeps one candidate per fitness class, so a cost
levied only at the last breakpoint arrives after the alternatives were pruned),
and the rung alone leaves the hopeless paragraphs where it found them. Together:

984-paragraph prose corpus, multi-line paragraphs only, floor `0.33`. Left of
each arrow is the option off. `justif` 0.7.0, on the same corpus, the same
measure and the same policy, is in brackets.

| | ending under ⅓ | ending under 1/10 | badness per body line |
| --- | --- | --- | --- |
| 320px | 26.4% → 7.0% [26.3 → 9.1] | 2.8% → 0.5% [2.5 → 0.1] | 48.85 → 50.62 [48.67 → 50.41] |
| 480px | 26.8% → 4.1% [26.8 → 7.0] | 3.8% → 0.5% [4.0 → 0.0] | 9.61 → 11.79 [13.61 → 15.95] |
| 680px | 31.4% → 6.6% [31.7 → 9.8] | 5.8% → 0.1% [5.9 → 0.0] | 4.93 → 7.93 [5.74 → 9.64] |

That is with hyphenation, protrusion and expansion on. With tracking instead of
expansion — the arm that matters for a font with no width axis — it goes 26.1 →
3.3, 26.2 → 2.0 and 31.1 → 5.0 against justif's 6.3, 5.9 and 8.6, and with
everything on, 24.7 → 1.1, 25.7 → 0.2 and 30.8 → 3.3 against 4.2, 4.2 and 7.5.

Switching the floor ON costs nothing: the strict rung that succeeds replaces the
classic rung that would have run, and only the paragraphs it cannot satisfy pay
two wasted passes. Measured over the prose corpus, on/off came out between 0.85
and 1.05 across two runs — it straddles 1, which is this harness's noise.

HAVING the floor does cost, and it is charged whether or not anyone turns it on:
+4.9% break time over 24 configuration/measure cells, two runs each against
eight baseline runs. The floor is one comparison per candidate breakpoint in the
inner loop, and the inner loop is sensitive out of proportion to the arithmetic
— a variant that keeps every other part of the change and drops only that
comparison and the demerit measures +1.2%, and three different spellings of the
comparison all land within 0.3% of each other. Two designs that would avoid the
inner loop were measured and rejected: pricing the ending through a finite
`\parfillskip` makes the floor fuzzy by the ending's own glue and leaks a
changed `stretch` into font expansion, and a binary-searched descent through
sixteenths of the threshold (justif's shape) costs +4.2% for the same reason the
demerit does, since it still needs the per-candidate test.

There is no rectangle search. justif needs one — a binary-searched descent
through sixteenths of the requested threshold, plus a bounded-pressure fallback,
plus an explicit comparison against the option-off solution — because its strict
passes can reject every arrangement and it has to guarantee that turning the
option on never *shortens* an ending. Here that guarantee is free: the fallback
demerit is monotone in the shortfall and the optimizer minimizes body plus
ending, so a solution with a shorter ending than the option-off solution's would
have to beat it on body cost too, which it cannot, the option-off solution being
the body optimum. Measured over 984 paragraphs × 3 widths × 3 microtypography
configurations: zero paragraphs end shorter with the floor on.

The floor applies to the paragraph's own last line and no other. A line ending
at an authored `<br>` is ragged by design and is left alone.

Recommended for the DOM tier: `0.33`, matching justif's DOM default and the
usual typographic advice. It is off by default here so that the numbers above,
and every benchmark that produced them, stay comparable.

## The headless compiler

`@enscribe/linebreak/layout` takes items and returns breaks. Something has to
make the items: split the string into segments, measure them, decide where a
word may break, and turn protrusion, expansion and letterfit into per-item
budgets. In the browser that is `compileBlock`, fed by the DOM extractor. The
compiler itself never reads a node: widths arrive through a callback, offsets
index a plain string, and the two questions a `<code>` wrapper used to answer —
is this run code, and how wide are its inline edges — are callbacks the DOM
tier fills in. The benchmark harness has been driving it from a synthesized
block with no document for as long as gates 6, 7 and 8 have existed.

`@enscribe/linebreak/text` is the door to it, for callers that have advance
widths and no document: server-side rendering, canvas, PDF, and the harness
itself. Its runtime import graph is 13 files and zero packages, and a test
asserts that no file under `dom/` and no bare package can enter it.

### The surface

```ts
// @enscribe/linebreak/text — no DOM, no dependencies

export type Advance = (text: string) => number

export type SegmentKind =
  | "text"
  | "space"
  | "break-opportunity"
  | "soft-hyphen"
  | "other"

export type TextSegment = {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly kind: SegmentKind
}

export const segmentText: (text: string) => TextSegment[]

export const createMetrics: (options: {
  measure: Advance
  letterSpacing?: number
  font?: string
  segment?: (text: string) => readonly TextSegment[]
}) => FontMetrics

export type CompileTextOptions = {
  readonly locale?: string
  readonly hyphenate?: Hyphenator
  readonly code?: boolean
  readonly policy?: Partial<LayoutPolicy>
  readonly glue?: Partial<GlueElasticity>
  readonly protrude?: boolean
  readonly expand?: StretchScale
  readonly track?: number
}

export const compileText: (
  text: string,
  metrics: FontMetrics,
  options?: CompileTextOptions,
) => CompileResult
```

It also re-exports the types those signatures name — `FontMetrics`,
`MeasuredSegment`, `MeasuredParagraph`, `CompileResult`, `Hangs`, `Flex`,
`StretchScale`, `StretchStep`, `StretchProbe`, `Hyphenator`, `ComposeReason` —
and `calibrateStretch`, which is the only way to obtain a `StretchScale`.

`(text, metrics, options)` mirrors `breakParagraph(items, measure, options)`:
three positional parameters, options last, no overloads. `CompileResult` is the
same union the DOM tier already gets back, not a parallel shape.

```ts
import { breakParagraph } from "@enscribe/linebreak/layout"
import { compileText, createMetrics } from "@enscribe/linebreak/text"

const metrics = createMetrics({ measure: (text) => context.measureText(text).width })
const compiled = compileText("Some prose to set.", metrics)
if (compiled.ok) {
  const result = breakParagraph(compiled.items, 480)
}
```

### Measurement is synchronous, and has to be

`Advance` returns a number, not a promise. `measureRun` is called from inside
the compiler's inner loops — once per candidate break offset when a word is
hyphenated, once per edge character when protrusion is on — and through
`FontMetrics`, which the DOM tier implements too. Making it async would make
`compileBlock` async, and everything under it, and the DOM tier cannot be
async: it measures and writes inside one layout, and a suspension between the
two is a suspension during which the page's styles can change under it.
`breakParagraph` is synchronous for the same reason.

A caller whose widths come from somewhere asynchronous resolves them first.
`segmentText` is exported separately so this is possible: segment the string,
await widths for the pieces, then compile against a closure over the table.
That works when the compiler only ever asks about whole segments — no
`hyphenate`, no `code`, no `protrude`. Any of those three make it ask about
substrings and single characters it cannot predict, and then the caller needs a
width source that answers synchronously for arbitrary text. Canvas and an
opentype advance table both do.

### Segmentation

`createMetrics` ships a hand-rolled scanner: one pass, no dependency, no
`Intl.Segmenter`. It was measured against `@chenglou/pretext` over a
1010-paragraph corpus, scored on the 103,503 offsets where the compiler would
permit a break, against the best `Intl.Segmenter` arrangement the earlier
investigation could build:

| segmenter | extra breaks | missing | paragraphs differing | ms / corpus pass |
| --- | ---: | ---: | ---: | ---: |
| `Intl.Segmenter` word granularity, merged, with dash rules | 211 (0.20%) | 29 | 103 (10.2%) | 89–99 |
| the scanner | 15 (0.01%) | 28 | 18 (1.8%) | 59 |

Better on both axes and no ICU version in the surface, for about seventy lines
this package owns forever. All of that evidence is Latin prose. There is none
about Thai, Khmer or Lao, which need dictionary word breaking that neither a
scanner nor a browser's default segmenter provides, which is what the `segment`
seam is for. Pass an `Intl.Segmenter`-backed function, or a real dictionary
segmenter, and `createMetrics` measures whatever it returns.

Widths never come from `segment`. It says where the pieces are; `measure` says
how wide they are. A `segment` that does not tile the input exactly — offsets
out of order, a gap, an overlap — makes `measureParagraph` return null and the
compile declines `segmentation-mismatch` rather than silently mislaying text.

The input is expected to be whitespace-collapsed already, the way the DOM
extractor collapses before the compiler ever sees a string. `\n`, `\t`, `\f`
and `\r` are classified as space, so a stray one degrades to a space rather
than into the middle of a word, but it is not a forced break. Forced breaks
need more than one run.

This scanner is not the DOM path's segmenter and must not become it. The DOM
path goes through pretext, which is what the rendered output on this site was
measured against; unifying the two would change rendered pages to save a file.

### Protrusion, expansion, tracking

The three microtypography options in the browser each rest on a measurement the
browser makes for itself. A headless caller has to supply the equivalent, and
each one is different.

`protrude` stays a boolean. Nothing about it needs calibration: the amounts are
per-character permille of that character's own advance, and the advance comes
from `measure`. What the DOM tier's boolean additionally carries is
`honoursHangingMargins` — whether the rendering engine lets a negative inline
margin shorten a line box, which is a rendering capability, not a measurement.
Headless, that judgement is the caller's: pass `true` only if the renderer can
draw a glyph outside the measure.

`expand` takes a calibrated `StretchScale`, not a boolean. A scale is the
ladder of `font-stretch` percentages the font actually responds to, paired with
the width ratio each one produces, and it is a property of the font, not of the
option. `calibrateStretch(budget, probe)` builds one from any probe that can
report the width of a fixed string at a given percentage; the DOM tier's probe
sets `font-stretch` on an off-screen span, and a canvas caller's sets `wdth`.
A boolean would be worse than useless here: with no scale to hand the compiler
would have to allocate and populate the uncredited-box set for a font that
cannot expand at all, paying for a feature that then does nothing.

`track` takes the budget directly, as a fraction of each box's width — `0.03`
is the DOM tier's. There is nothing to calibrate; letterfit is a policy number.
What the DOM tier decides before passing it is eligibility — that letter
spacing is uniform across the runs — and with one run that is true by
construction.

`hyphenate` takes a `Hyphenator`, the same `(word, locale) => offsets`
function the DOM tier takes. Omitting it is how hyphenation is turned off;
there is no second boolean for it. `englishHyphenator` stays behind
`@enscribe/linebreak/hyphenation`, so this entry keeps its zero-package graph
whether or not a caller hyphenates.

`code` reroutes break opportunities from the hyphenator to the code table —
camelCase boundaries, path separators, operators, each with its own penalty —
and suppresses protrusion, matching what a `<code>` wrapper does in the DOM
tier. It is the one option in this list that the compiler cannot express today:
it decides the same question by looking for a `code` element among a run's
wrappers.

### What comes back

`CompileResult` is the existing union: `items` plus `hangs`, `expansion`,
`tracking`, `flex` and `scale`, each null unless the matching option was
passed. The item stream goes to `breakParagraph`, and the rest are budgets it
and the caller consume:

| field | what to do with it |
| --- | --- |
| `items` | `breakParagraph(items, measure, …)` |
| `hangs` | pass as `LayoutOptions.hangs`, or protrusion changes nothing |
| `flex` | pass as `LayoutOptions.flex`; it is `expansion` and `tracking` pooled |
| `expansion`, `scale` | `fitLines(lines, target, expansion, scale)` to get each line's percentage |
| `tracking` | `trackLines(lines, target, tracking, fits)` to get each line's letter spacing |

`fitLines` and `trackLines` are layout-tier functions and are exported from
`@enscribe/linebreak/layout` alongside `breakParagraph`, together with the
`Hangs` and `Flex` types that `LayoutOptions` already names but does not
currently export.

Everything in the result is plain numbers, strings and `Float64Array`. That is
not an accident of the current code and it is not allowed to become one: the
type is asserted to be structurally identical to a hand-written DOM-free
mirror, so a field typed `HTMLElement` cannot appear in it without a test
going red.

### What it declines

`compileText` returns `{ ok: false, reason }` with the same `ComposeReason`
union the DOM tier uses, but only three of its members are reachable without a
DOM:

| reason | when |
| --- | --- |
| `empty` | the text produced no items — an empty or all-collapsible string |
| `segmentation-mismatch` | a custom `segment` did not tile the input |
| `unmeasurable` | reserved; unreachable while one metrics object serves the whole string |

The others belong to tiers that do not exist here. `too-long`,
`unsupported-content`, `unsupported-direction` and `unsupported-writing-mode`
are the DOM extractor declining an element; `single-line`, `too-narrow` and
`already-typeset` are the engine deciding not to typeset one; `render-failed`
and the rest are what happens after a write. The union is shared rather than
narrowed on purpose: a narrower one would have to be widened later, and
widening a returned union breaks every exhaustive switch over it.

The 3,000-character limit is not applied. It exists because the DOM tier
re-renders what it typesets; a caller that only wants items pays no such cost.

### What is not in v1

One run. One font, one size, one language, no inline elements, no images, no
`<br>`, no nowrap groups, no `text-indent`. Those need `compileRuns`, which is
deliberately not in this freeze: deciding how a nowrap group spans runs when
there is no element tree to read it from is a design question, and answering it
badly in order to ship a first version is how an API acquires a shape it cannot
lose.

CJK, right-to-left text and non-English hyphenation are out of scope for this
entry as they are for the rest of the package.

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

An expanded line carries its `font-stretch` percentage, and is measured once
after the write. A percentage is not a width ratio, and one probe string's
ratio does not transfer to every line where advances snap to whole pixels, so
whatever a line ends up reaching past the measure by is charged to that line's
own spaces as negative `word-spacing`. Lines the optimizer left at 100% are
never measured, so a font with no width axis costs no layout read at all.

A letterspaced line carries one `letter-spacing`: the whole letterfit the
optimizer assigned it, divided by the units the line renders — its trimmed text
by code point, plus the drawn hyphen, which inherits the declaration through the
`::after`. The total is therefore exact, and the browser's own justification
absorbs the fact that the spaces get the increment too. Letterspacing suppresses
common ligatures, and the advances were measured with them on; that costs
nothing measurable, so no ligature guard is written. Asking for `"liga"` back
would be worse than the disease: a re-formed ligature glyph takes one spacing
where its characters would have taken two or three, which is the one thing that
does move the line off the model. Lines the letterfit left alone are never
measured after the write.

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
`text-transform` other than `none`, an authored `font-stretch` or `wdth`, a
`text-indent` carrying `hanging` or `each-line`, more than 3,000 collapsed
characters, and a run whose document has no element that can host a
measurement probe.

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

Canvas `measureText` cannot express `font-variant-caps`,
`font-variant-numeric`, `font-variant-position`, `font-variant-ligatures`,
`font-variant-alternates`, `font-variant-east-asian` or
`font-feature-settings`: glyph substitutions such as small caps and old-style
figures change advance widths without changing the font canvas resolves. A run
carrying any of them is measured through an off-screen probe span instead,
which is the rendering engine measuring itself — worst error 0.008px against
Chromium's own layout across 336 declaration/family/text combinations, against
101px for canvas on the same rows. The probe costs one batched layout per
paragraph, and runs without those declarations never reach it.

An authored `font-stretch` or `wdth` is still declined: that width is the
author's, not ours.

An element whose width depends on its own content — a shrink-to-fit flex item,
a float, `width: fit-content` — usually resolves to the space available, and
inline segments preserve the paragraph's `max-content`, so typesetting does not
change the measure. Where `max-content` genuinely governs, protrusion's
negative margins do change it; the element is then restored and reported as
`unstable-width`. If a layout moves after a write for any other reason, the
same thing happens.

## Measured and declined

Five features were prototyped against this library as it ships, measured, and
not built. The numbers are recorded so the work is not repeated.

### Hanging-punctuation modes

justif layers a hang policy over the protrusion table — line ends only in its
DOM default, plus first-line-and-line-ends and all-line-edges — and keeps a
separate first-line table. Protrusion here is microtype's amounts, the same on
every line and every edge.

Prototyped by raising justif's Latin hang set to 1000 on the right edge and then
on both edges, over 984 prose paragraphs at 320, 480 and 680px with hyphenation,
protrusion and expansion on: badness per body line moves by at most 1.5% and in
both directions, mean `|r|` by at most 0.6% and in both directions, and
containment does not move — zero overfull prose lines in every mode at every
width. About a tenth of body lines end in an eligible mark and gain about
1.85px of hang each. Across the corpus that is 11 lines saved out of roughly
12,500, or 0.09%. Break time does not move either; its sign flips across widths.

The same rig priced the 19 letter and digit codes that `tools/gen-protrusion.mjs`
drops from microtype's blocks. Restoring them raises badness per body line by
1.1% and 0.8% at two widths and ties at the third, so they stay dropped.

### `spacing.pull` and `spacing.boundaryShrink`

justif's two extra interword-glue knobs: `pull` presses a secondary font's wider
space toward the base font's width, and `boundaryShrink` scales the shrink of a
space sitting at a font-family boundary, such as the gaps around inline code.
This library prices a word space by the run's own font, TeX-style, and applies
no boundary rule.

Neither knob has a TeX antecedent. TeX's rigidity is a property of the run's own
font and never of a boundary: `cmr10`'s space stretches by half and shrinks by a
third, exactly the `defaultGlue` here, and `cmtt10`'s is rigid at 1.575x the
`cmr10` width — TeX leaves that wide space alone rather than pulling it toward
the body font.

The damage they would repair was measured on this site's own faces, where a
space is 3.000px in the body face and 8.000px in the code face at 0.9em, against
a shrink cap of 1.000px. Over the chip-bearing paragraphs, 59 of 303 lines shrink
at all, the worst rendered gap collapses to 2.797px against 4.000px natural, and
only 2 of 303 lines come within 90% of the shrink cap. Chromium itself never
renders a justified space below its natural width — 77 spaces over 8 measures.
No published benchmark number depends on either knob: the harness sets
`boundaryShrink: 1` and builds a single run.

### `lastLineFit` (eTeX `\lastlinefit`)

Distinct from `lastLineMinWidth` above. eTeX's `\lastlinefit` makes a
paragraph's final line adopt *f* times the preceding line's set ratio, clamped
at full justification, priced inside the dynamic program and applied when the
line is set. It is a ratio rule, symmetric and blind to width;
`lastLineMinWidth` is a width floor, asymmetric and charged only at break time.
justif's own default for it is 0.

Prototyped here: break time goes up 16.9% with the feature on, quality moves
between −3.4% and +0.6% across six cells with mixed sign, and short endings do
not move at all — 23.7 to 23.2%, 11.7 to 11.7%, 3.3 to 3.3%. Short endings are
the floor's job, and the floor already does it: 26.1% to 3.3% on the same
corpus. The active node here already carries the line's ratio, so eTeX's two
extra node words are unnecessary; carrying them costs 9–10% of break time with
the feature turned off, and because eTeX folds `\emergencystretch` into
`active_glue`, the ratio already on the node is the faithful reading anyway.

### Replacing `@chenglou/pretext` with `Intl.Segmenter`

pretext is the largest thing this package ships and loads: 38,409 B minified and
12.8 kB gzipped, 45% of the browser bundle, and 5.9 ms of the DOM entry's 8.8 ms
cold import. Its segmenter is `Intl.Segmenter` plus about 570 lines of
correction, so the substitution looks free.

It is not. The best `Intl.Segmenter` prototype of the three that were built
disagrees with pretext about where a line may end on 0.454% of this site's prose
break opportunities — 91 breaks pretext refuses and 12 it allows, over 20,030 —
and on 17.98% of the opportunities in code-bearing paragraphs, 103 against 573.
That moves 18.6% of the site's prose paragraphs and 69.6% of its code
paragraphs. The 4.6 ms it would return sits behind `document.fonts.ready`, where
nothing is waiting on it. Declined, not deferred.

### A lazy `auto` entry

`auto` imports the engine statically, and the engine is what pulls pretext in.
Moving that import inside `start()`, behind the `document.fonts.ready` await it
already performs, would take the engine half of the entry's cold import — about
7.5 ms in a fresh process — out of module evaluation. The premise is that those
7.5 ms sit in front of first paint. They do not.

Measured on the rig behind
[Loading and first paint](#loading-and-first-paint): the tag is
`type="module"` at the end of `<body>`, and evaluation of the module finishes
110.6 ms after first contentful paint on an unthrottled CPU and 2841 ms after it
at 6x. It is never in front of paint. `document.fonts.ready` resolved before
module evaluation ended in twenty runs of twenty at 1x, at 4x and at 6x, by a
margin that grows from 35.5 ms to 1840.9 ms — the import is the later of the two
gates, so putting it behind the earlier one changes nothing.

The change was prototyped rather than argued about. Deferring exactly the
evaluation it would defer, while leaving the fetch where it is, moves first
paint by 0 ms and time-to-first-typeset by 33 ms at 6x on fast 3G, both inside
run-to-run noise. Deferring the bytes as well is the only version that moves
anything, and it moves them the wrong way for a reader: 320 ms of first paint
bought for 2386 ms of extra delay before the first justified paragraph, and
nothing outside noise at 1x or 4x. The `fetchpriority="low"` row of that table
buys the same first paint for 503 ms less typeset delay, with no code.

The price for that nothing is a permanently nullable engine on the object every
verb reaches through, a synchronous public `typeset()` taught to throw before
`start()` resolves, a new way for `start()` to reject that a fire-and-forget
caller swallows, `settled` semantics to redecide, and a second chunk whose
bundler treatment is outside this package's hands. On this site it would defer
64% of the bytes it names anyway, because the hyphenator is passed as a
construction option and loads eagerly whatever the engine does.

## Development

```sh
bun run build          # tsdown, publint, arethetypeswrong
bun run typecheck
bun test               # from the repo root
```

`@chenglou/pretext` is a pre-1.0 dependency. Pin it. It is also the single most
expensive thing on the DOM entry's import graph: 5.9 ms of `dist/index.js`'s
8.8 ms cold import in a fresh bun process, median of twelve. `dist/layout.js`
reaches none of it and costs 2.6 ms.

Three fields of a prepared paragraph are read — `segments`, `widths`, `kinds` —
and the prepared value is assigned to a structural type naming exactly those
three. There is no cast, deliberately: if a pretext release renames one of them,
`bun run typecheck` fails. Do not repair such a failure with a cast, which would
turn it back into a silent `segmentation-mismatch` decline at runtime. A soft
hyphen's line-end width is the hyphen advance plus twice the letter-spacing,
computed here rather than read from pretext's `lineEndFitAdvances`;
`tests/linebreak/unit/pretext-contract.test.ts` holds that identity against the
pinned version.

MIT.
