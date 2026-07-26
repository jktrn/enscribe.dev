# @enscribe/linebreak

Knuth and Plass line breaking for prose in a browser.

The browser breaks lines greedily: it fills each line as far as it will go and
moves on. That is fast and it is why justified text on the web has rivers of
white running down it. This package chooses the breaks for a whole paragraph at
once, minimising a sum of squared costs so no single line has to be terrible.

It only chooses the breaks. Once the lines are decided the paragraph is rewritten
as one element per line, each carrying `text-align: justify` and
`text-align-last: justify`, and the browser distributes the inter-word space
itself. Nothing here authors letter-spacing, and the only word-spacing it writes
is the negative amount described under [Shrink](#shrink-and-what-css-will-not-do).

## Contents

- [Using it](#using-it)
- [Pipeline](#pipeline)
- [The model](#the-model)
- [Reading a paragraph out of the DOM](#reading-a-paragraph-out-of-the-dom)
- [Measurement](#measurement)
- [The optimizer](#the-optimizer)
- [Rendering](#rendering)
- [Verification and re-setting](#verification-and-re-setting)
- [Text fidelity](#text-fidelity)
- [Policy](#policy)
- [Diagnostics](#diagnostics)
- [Known limits](#known-limits)

## Using it

```ts
import { cleanCopiedLinebreaks, createLinebreaker } from "@enscribe/linebreak"
import "@enscribe/linebreak/styles.css"

const linebreaker = createLinebreaker({
  locale: document.documentElement.lang,
  minimumWidth: 240,
  hyphenate: true,
  preserveImageAttributes: ["data-loaded"],
  onDiagnostic: (d) => console.warn(d.kind, d.element),
})

// One read pass, then one write pass.
const plans = blocks.map((block) => linebreaker.plan(block))
for (const result of linebreaker.commit(plans)) {
  if (result.state === "typeset") done.add(result.element)
}

document.addEventListener("copy", cleanCopiedLinebreaks)
```

`plan` and `commit` are separate because the split is what keeps the cost flat.
`plan` only reads the DOM and `commit` only writes it, so a batch of paragraphs
costs one round of reads and one round of writes. Interleaving them forces the
browser to lay the page out again between every pair, which turns a batch of N
into N synchronous layouts.

`typeset` is the convenience form for a single paragraph, and does both.

### Options

| Option | Default | What it does |
| --- | --- | --- |
| `locale` | `<html lang>`, then `en-US` | Fallback only. A paragraph inside an element with its own `lang` uses that instead, because the locale decides how text is segmented. |
| `minimumWidth` | `0` | Paragraphs narrower than this are left alone. |
| `hyphenate` | `false` | See [Hyphenation](#hyphenation-and-the-trade-it-makes). |
| `preserveImageAttributes` | `[]` | Attributes copied forward onto matching images when a paragraph is rebuilt, so state the page set after load survives. |
| `onDiagnostic` | none | Called for every paragraph that could not be set. See [Diagnostics](#diagnostics). |

### Lifecycle

`restore(elements)` puts paragraphs back to the markup the author wrote.
`invalidate(elements)` does that and also drops their cached measurement; with no
argument it drops everything, including cached typography. `destroy()` restores
everything and makes the instance inert.

The order inside `invalidate` matters and is not an implementation detail. A
paragraph's authored markup is stored inside its measurement, so dropping the
measurement while the paragraph is still rendered as lines throws away the only
copy. The paragraph would be stranded: `restore` and `destroy` could no longer
reach it, and the next `plan` would try to read back the line elements this
package wrote instead of the author's markup.

`readMetrics()` reports `cachedParagraphs` and `cachedTypographies`. A page of
prose is two or three typographies across hundreds of paragraphs, so a
`cachedTypographies` number near the paragraph count means the cache has stopped
being shared.

## Pipeline

```
src/
  index.ts          public surface
  linebreaker.ts    plan / commit, caches, the verify loop
  policy.ts         every tunable number
  types.ts          public types
  diagnostics.ts    why a paragraph was not set

  dom/extract.ts    DOM  ->  text + runs + break restrictions
  text/measure.ts   text  ->  widths
  layout/compile.ts runs  ->  items
  layout/breaker.ts items ->  lines
  dom/render.ts     lines ->  DOM

  dom/style.ts      computed style reading
  dom/restore.ts    the authored snapshot
  dom/clipboard.ts  the copy event
  text/hyphenate.ts hyphenation points
  text/code-breaks.ts  where a long identifier or path may wrap
  layout/items.ts   the box, glue and penalty model
```

Everything after `dom/extract.ts` is free of the DOM. That is deliberate: the
optimizer works on numbers and offsets, and can be tested without a browser.

## The model

A paragraph is a stream of four kinds of item.

**Box.** Something of fixed width that is never broken. A word, or an inline
object such as an image.

**Glue.** Adjustable space. It carries a natural width plus how much it may
stretch and shrink, as widths rather than ratios. The ratios they come from are
in `policy.glue`.

**Penalty.** A place a line may end, and what ending there costs. A penalty at or
above `FORBIDDEN_PENALTY` (1000) is not a breakpoint at all; one at or below
`FORCED_PENALTY` (-1000) demands a break.

**Discretionary.** An optional break inside a word, carrying three widths,
because the text differs by whether the break is taken. A line passing through
uses `noBreakWidth`, the word measured whole. Breaking uses `preWidth` on the
line that ends and `postWidth` on the line that starts.

Three widths rather than two is the important part. Kerning makes a word measured
whole narrower than its halves measured separately, so `preWidth + postWidth` is
never a substitute for `noBreakWidth`. Substituting it makes every hyphenatable
word slightly too wide on every line it appears on.

Every item carries a `source` range into the paragraph's collapsed text. That is
what lets the renderer rebuild a line's content from a pair of breakpoints while
the optimizer knows nothing about the DOM.

### Forced breaks

A forced break is three items: a forbidden penalty, glue that can stretch without
limit, then a forced penalty. The forbidden penalty stops the optimizer breaking
at the fill glue, which would end the line one breakpoint early and leave the
next one holding nothing. The fill glue absorbs whatever slack the line has, so a
short line costs nothing.

A paragraph's end is a forced break like any other. That is why the last line
needs no special case in the cost function: the fill glue makes it free.

## Reading a paragraph out of the DOM

`extractBlock` produces four things: the paragraph's text collapsed as CSS would
collapse it, the runs that text is made of, the ranges no break may fall inside,
and the width each inline wrapper's edges occupy.

### Whitespace

Whitespace is collapsed across element boundaries, not per node. A run of
whitespace anywhere in the subtree becomes one space, and a space at an element
boundary belongs to whichever side reaches it first. Spaces are therefore
buffered rather than trimmed: until the next node arrives there is no way to know
whether a space is interior, leading, or about to be swallowed by a line break.

A space at the start of the block, or straight after a `<br>`, sits at the start
of a line and is not rendered. A space before a `<br>` sits at the end of one and
is not rendered either. Both are dropped, but any wrapper edges they carried
survive as anchors.

### Runs

**Text.** A stretch of text sharing one computed typography.

**Atom.** An inline object measured whole: an image, math, a favicon, a chip. It
occupies one object-replacement character in the text.

**Anchor.** A position with no text that carries a wrapper's edge width. A
wrapper holding nothing but whitespace still occupies its padding and border, and
without a run there would be nowhere to attach that width.

**Break.** A `<br>` or a `<wbr>`. A `<br>` is forced and occupies a newline in the
text, which is what the browser reports for it in `innerText`. Using the same
character means the authored text and the typeset text agree without either side
special-casing the other. A `<wbr>` is only offered and occupies nothing. Neither
answers to nowrap ranges, because a nowrap element cannot overrule a break the
author wrote inside it.

A break with nothing on one side is dropped at compile time. It describes a line
holding nothing, which a renderer making one element per line cannot express, and
two breaks in a row describe that same empty line between them. A trailing `<br>`
is the common case; `<br><br>` used as a paragraph gap is the other.

### What is not modelled

An element is rejected when its computed display is not something this package
can lay out, or when its `white-space-collapse` is not `collapse`. An `<input>`
is an atom when it is disabled and rejected otherwise: it is a fixed-size box the
model can measure, but rebuilding a line clones its element, and a clone loses
the value the reader typed and the focus they had. A disabled control, such as a
Markdown task-list checkbox, has neither to lose.

## Measurement

`text/measure.ts` wraps [`@chenglou/pretext`](https://www.npmjs.com/package/@chenglou/pretext),
which segments and measures text for one typography.

Text is prepared with `whiteSpace: "pre-wrap"` because extraction has already
applied CSS whitespace collapsing across inline boundaries. Pretext's default
mode would normalize the text a second time, and its segments would then describe
a string that is not the one being laid out. It also keeps leading and trailing
spaces measurable, which under the collapsing mode would report zero.

If the segmenter does not reproduce the text exactly, the paragraph is declined
rather than laid out against offsets that do not line up.

Metrics are cached by typography, not by element: locale, letter-spacing and the
resolved font shorthand. A page of prose is two or three of those across hundreds
of paragraphs.

### The hyphen

The width of a hyphen is `measureRun("-")`, not pretext's
`discretionaryHyphenWidth`, which reports roughly a third of it. The renderer
draws a literal `-` as generated content, so what a line has to fit is that
glyph's advance. Under-charging it makes every hyphenated line a few pixels wider
than the width it was fitted to, which is enough for the browser to wrap it.

## The optimizer

`layout/breaker.ts` is the Knuth and Plass dynamic program. Each node of the
active list is a breakpoint the paragraph can reach, holding the cheapest way
found to reach it. Reaching a breakpoint from a node whose line would be too long
retires that node, because no later breakpoint can rescue it.

### Cost

A line's badness is `100 * |r|³`, where `r` is the adjustment ratio: how far the
line moved from natural width as a fraction of what its spaces can give. Positive
stretches, negative tightens, and -1 means the spaces have given everything they
have.

Demerits are `(1 + badness + penalty)²`. The square is the point. Minimising a sum
of squares also minimises the worst line, so the optimizer spreads a problem out
rather than dumping it on one line. The leading 1 breaks ties towards fewer lines.

Two more costs come from TeX. `consecutiveFlagged` is added when two lines in a
row both end at a hyphen. `fitnessJump` is added when neighbouring lines differ by
more than one fitness class, so a very tight line never sits directly against a
very loose one. Fitness is four bands of adjustment ratio.

### The three passes

`breakParagraphWithFallback` runs up to three times, following TeX.

1. Tight typesetting, at `policy.fit.tolerance`.
2. Looser lines, at `policy.fit.relaxedTolerance`.
3. The same tolerance, plus forcing.

Forcing is TeX's final pass. When a breakpoint would retire the last active node
without admitting anything, the optimizer breaks there anyway with artificial
demerits rather than giving up. The line is overfull and the renderer compresses
it to fit. Giving up instead drops the paragraph to ragged wrapping among
justified neighbours, and one tight line reads far better than that.

Tolerance bounds looseness only. How tight a line may be is bounded by the
adjustment ratio reaching -1.

### Why breaks are not always where they look

Two things about a breakpoint are easy to get wrong.

A break consumes its own item. Glue at a break is dropped, and a broken word's
whole-word width is replaced by its two halves. Glue and penalties following the
break are skipped too, which is what stops a line starting with the space that
ended the last one. A discretionary is the exception: its post-break text is
content on the new line, so the line has already begun and nothing after it is
discardable.

What a break did to the text is not a property of the break item alone. Breaking
at a penalty discards the glue after it, so a zero-width breakpoint sitting just
before a space eats that space as surely as breaking on it would have.

## Rendering

`renderLines` replaces a paragraph's children with one `<span class="lb-line">`
per line, cloning the inline wrappers each line passes through.

A wrapper cut by a break becomes several elements. It is marked
`data-linebreak-fragment`, plus `-start` and `-end` on the fragments that hold the
wrapper's real edges, and the stylesheet suppresses padding, border and radius on
the cut sides. Without that a `<code>` span grows a second set of rounded ends
mid-word.

Only the fragment a wrapper starts on keeps the wrapper's `id`, so a link to it
still lands where the author put it. Stripping the id from every fragment breaks
footnote backrefs, which is the common case.

A line that ends a run of text is set flush rather than stretched: the
paragraph's last line, and any line a `<br>` ended. It carries
`lb-line-flush`, whose only rule is `text-align-last: start`.

`white-space: nowrap` cannot be used on a line, because it would disable
justification. So an over-wide line wraps rather than overflowing, which is why
verification measures height and not `scrollWidth`.

### Shrink, and what CSS will not do

CSS justification only ever grows spaces. A line the optimizer chose to set
tighter than natural cannot be produced by justification alone, so the renderer
gives it exactly enough negative `word-spacing` to fit and lets justification
fill the rest. Over-shrinking is harmless, because justification stretches it
back, which is why this needs no measurement of the rendered result.

The count of spaces that shrink is spread across excludes any glue with no text
behind it, such as a paragraph's fill glue. Counting it spreads the shrink one
space thinner than the browser will apply it, which leaves the last line of a
tight paragraph one word-spacing unit too wide. That is enough to wrap.

## Verification and re-setting

After writing, each paragraph is read back. A block taller than its line count
means the browser wrapped a line, which means something on that line was measured
more narrowly than it renders.

That is evidence, not a dead end. The paragraph is set again against a measure
reduced by 1%, then 3%, then 9%, which spends a little inter-word space to keep it
justified. Nothing measures rendered output and patches styles; each attempt is an
ordinary solve.

The block-height check is one read for the whole paragraph and is right almost
always, but "taller than expected" and "a line wrapped" are not the same claim. A
tall inline, such as math or a raised footnote marker, makes a block taller
without any line wrapping, and narrowing the measure cannot make an atom shorter.
So a paragraph that fails the cheap check is asked the exact question, by grouping
its text's client rects into rows, before its lines are thrown away.

## Text fidelity

One element per line means a line break is a real element boundary, and the
browser reports it as a newline. Whether that is correct depends on what the break
consumed, so every line records it.

| `breakKind` | What the break did | What rejoining puts back |
| --- | --- | --- |
| `space` | Ate an interword space | a space |
| `hyphen` | Drew a hyphen | nothing; the hyphen is generated content |
| `forced` | A `<br>` | a newline |
| `none` | Took nothing, drew nothing | nothing |

The `copy` handler rewrites both clipboard flavours from this. The plain-text
flavour cannot come from `textContent`, which concatenates text nodes and nothing
else: a `<br>` contributes the empty string, and two paragraphs run together.
`innerText` would be right but only reports what is rendered, and the copied
fragment is detached, so the boundaries are walked explicitly.

### Hyphenation, and the trade it makes

Hyphenation is off unless a caller asks for it, and the reason is not
typographic.

A visual line break is also a text boundary. When the break fell on a space that
is right, because the space was consumed. When it fell inside a word it is not:
`feasible` split across two lines reads back as `fea sible`, so find-in-page stops
matching the word. Drawing the hyphen as generated content keeps that character
out of the text, but nothing can remove the boundary.

The trade is real in both directions. Without hyphenation there is nowhere to
break inside a long word, so the optimizer stretches spaces instead and the
paragraph rivers. This site opts in.

### Code

Text inside `<code>` gets break points from structure rather than a dictionary:
after separators and closing delimiters, after operators, at `_` and `-`, at
camelCase and acronym boundaries, at letter and digit boundaries, and, for an
identifier of five or more characters with none of the above, two interior points
so a long unbroken token has somewhere to go.

Every one of those prices stays below `FORBIDDEN_PENALTY`. A price at or above it
is not an expensive break, it is no break at all, and the emergency rule would
have nothing to do.

## Policy

`policy.ts` holds every tunable number. Some are Knuth and Plass's, some were
measured against real pages, and the rest are judgement calls.

| Name | Value | Where it comes from |
| --- | --- | --- |
| `glue.stretch` | `1/2` | TeX pairs a 1/3 em space with 1/6 em of stretch. A ratio rather than an em value keeps it correct for any font. |
| `glue.shrink` | `0.6` | TeX's is 1/3. Higher because TeX's costs are asymmetric: the same deviation costs more tightening than loosening, so TeX's numbers set prose systematically loose. Measured across one article, 1/3 left the median line stretched 8%; 0.6 centres it on natural spacing. |
| `fit.tolerance` | `1` | TeX's `\tolerance`. |
| `fit.relaxedTolerance` | `2.5` | The second pass. Prefer tight typesetting, accept loose over giving up. |
| `fit.safetyMarginPx` | `0.5` | Width held back so rounding cannot push a line past the container. Not the main guard, and not free: a full pixel cost 14% in average gap deviation across one article, because every line gives it up. |
| `fit.rewrapAttempts` | `3` | How many times a wrapped paragraph is set again before being given up on. |
| `fit.rewrapReduction` | `0.01` | Width given up on the first re-set, tripling each attempt. Measured shortfalls on this site ran 0.7% to 5% of the measure. |
| `demerits.consecutiveFlagged` | `3000` | TeX's alpha. |
| `demerits.fitnessJump` | `3000` | TeX's gamma. |
| `penalty.hyphen` | `50` | TeX's default. |
| `limits.maximumCharacters` | `3000` | Bounds the worst case on article-length prose. |
| `limits.minimumHyphenatedWordLength` | `6` | The shortest word offered to the hyphenator. |

## Diagnostics

Every paragraph that is not typeset says why, through `onDiagnostic`. One variant
per cause, so "this paragraph stopped justifying" is always answerable.

Four outcomes are ordinary rather than failures and never reach the sink:
`empty-content`, `single-line`, `insufficient-width` and `unsupported-direction`.
A block that fits on one line is not a paragraph, because there is no break to
choose, and page chrome reaches this package the same way prose does.

The rest are worth knowing about: `unsupported-element`, `measurement-unavailable`,
`segmentation-mismatch`, `content-too-long`, `no-feasible-breaking`,
`line-wrapped`, `line-height-unresolved` and `render-failed`.

The sink is called inside a `try`, and a throwing sink is swallowed, because a
consumer's logging should not be able to break typesetting.

## Known limits

- Right-to-left text is not supported.
- Rendering clones elements, so an inline element carrying live JavaScript state
  loses it. Images are handled through `preserveImageAttributes`; nothing else is.
- The plain-text clipboard walk uses a fixed list of block-level tag names.
  A selection crossing a boundary made block-level by CSS alone loses that
  newline, because the copied fragment is detached and has no computed style to
  read.
- Hyphenation is English only.
