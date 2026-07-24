## Inline code

Plain `code`, highlighted `const x: number = 1{:ts}`, and a TextMate scope
`anything{:.string}`.

Tones: `<red>error</red>`, `<green>ok</green>`, `<yellow>warn</yellow>`,
`<blue>info</blue>`, `<magenta>magenta</magenta>`, `<cyan>cyan</cyan>`,
`<white>white</white>`, `<black>black</black>`, and nesting
`<blue>info <dim>(quiet)</dim></blue>`.

Routes: `<route>GET /api/users/:id</route>`,
`<route>POST/PUT /api/challenges</route>`, `<route>DELETE</route>`, and a bare
path `<route>/api/leaderboard/now</route>`.

Responses: `<response>200 goodLeaderboard</response>`,
`<response>404 badChallenge</response>`, `<response>5XX</response>`.

Paths: `src/lib/assets/icons.ts{:file}`, `src/assets/icons/{:dir}`, and placeholders
`src/content/<collection>/index.md{:file}`.

Commands: `$ bun install`, highlighted `$ bun add satteri{:sh}`, with tags
`$ git push <dim>origin main</dim>`.

### Inline code (limits)

Broken tone markup stays literal: `<red>unclosed`, a stray close `</red>`,
crossed nesting `<red><blue>crossed</red></blue>`, an unknown tag
`<purple>nope</purple>`, and an empty pair `<red></red>x`.

Adjacent and deep: `<red>a</red><green>b</green>` with no gap between them,
`<blue><dim><dim>doubly dim</dim></dim></blue>`, a span that is entirely toned
`<magenta>every character</magenta>`, and dim with no color `<dim>just dim</dim>`.

Precedence traps: tones beat language `<red>tones win</red>{:ts}`, tones beat
paths `src/<red>hot</red>/index.ts{:file}`, an empty annotation `code{:}`, a
dot-only annotation `code{:.}`, and an unknown language `let x = 1{:zzz}`.

Escaping: `<script>alert("xss")</script>`, comparisons `a < b && b > c`,
entities `&amp; &lt; &copy;`, a lone backtick `` ` ``, a space-only span ` `,
and every bracket `{curly} [square] (paren) "double" 'single'`.

Routes and responses (limits): an unsupported method `<route>TRACE /teapot</route>`,
a triple method `<route>GET/POST/DELETE /multi</route>`, an invalid status
`<response>999</response>`, and a wildcard `<response>2XX</response>`.

Command edges: a bare `$ `, no space `$x`, tones with a language at once
`$ FLAG=<red>1</red> bun test{:sh}`, and a very long one
`$ docker run --rm --interactive --tty --volume "$(pwd)":/workspace --workdir /workspace --env NODE_ENV=production --publish 4321:4321 node:22-alpine bun run build --verbose --concurrency 8`.

Overflow: `averyveryverylongunbrokenidentifierthatshouldforcethecodechiptowrapacrosslinesbecausenothinginitbreaksnaturally_and_it_keeps_going_and_going_until_it_definitely_overflows_the_measure`
mid-prose, and a long highlighted span
`const result = await fetch("https://api.example.com/v2/leaderboard?offset=0&limit=100&division=open&bracket=undergraduate").then((response) => response.json()){:ts}`.

## Headings

### With `inline code{:ts}` inside

### With `<red>tones</red> and <green>nesting</green>` inside

### With a `$ bun run dev` command inside

### With a path `src/lib/assets/icons.ts{:file}` inside

#### Fourth level

##### Fifth level

### Headings (limits)

### `<red>nothing</red> <green>but</green> <blue>code</blue>`

### Ends with `code{:ts}`

### `$ bun run dev`

### Duplicate heading

### Duplicate heading

### A [link with `code`](/docs) in a heading

### Math $e^{i\pi} + 1 = 0$ in a heading

### $\alpha$

###

### Drag & drop, a < b, and `Array<T>` generics

### Ünïcödé, 中文字符, emoji 🎉, dashes—everywhere… and "smart" 'quotes'

### 404 numbers first

### A heading so long that it has to wrap in both the article and the table of contents because nothing about it is short, with `inline code{:ts}` buried in the middle, a tone `<cyan>somewhere</cyan>` near the end, and prose that keeps going well past any reasonable measure

## Callouts

:::note
The five GitHub alert variants, unchanged.
:::

:::tip[A label with **bold** and `code`]
Labels render in parentheses after the variant name, with full inline
markdown.
:::

:::warning
Warning body.
:::

:::caution
Caution body.
:::

:::important{closed}
This one starts collapsed via `{closed}`.
:::

:::definition[Continuity]
A function $f$ is continuous at $a$ if
$\lim_{x \to a} f(x) = f(a)$.
:::

:::notation
$\mathbb{R}$ denotes the real numbers.
:::

:::theorem[**Pythagoras**, _ca._ 570 BC]
For a right triangle, $a^2 + b^2 = c^2$.
:::

:::proposition
A proposition body.
:::

:::lemma
A lemma body.
:::

:::corollary
A corollary body.
:::

:::axiom
An axiom body.
:::

:::conjecture
A conjecture body.
:::

:::proof
Left as an exercise. $\blacksquare$
:::

:::remark
A remark body.
:::

:::explanation
An explanation body.
:::

:::intuition
An intuition body.
:::

:::recall
Recall `getPosts(){:ts}` filters drafts.
:::

:::example
An example with a code block:

```ts
const answer = 42
```
:::

:::exercise
An exercise body.
:::

:::problem
A problem body.
:::

:::answer
An answer body.
:::

:::solution[Spoiler]{closed}
A solution with a label, collapsed by default.
:::

:::summary
A neutral summary callout.
:::

### Titles (limit)

:::tip[**Bold**, _em_, and `code` in the title]
Bold and code should take the callout's accent color, dimmed — not the
default foreground.
:::

:::theorem[Pythagoras: $a^2 + b^2 = c^2$]
Inline math in a title.
:::

:::definition[A map $f\colon X \to Y$ is **continuous**]
Inline math next to bold in a title.
:::

:::notation[The set $\{\, x \in \mathbb{R} : x > 0 \,\}$, denoted $\mathbb{R}_{>0}$]
Two inline-math spans with braces and subscripts.
:::

:::warning[A [link](/docs), a `path/to/file{:file}`, and a <red>tone</red>]
Links inherit the color; tones keep their own; the file pill keeps its icon.
:::

:::important[Sink: **bold** `code() => 3{:ts}` $\sum_{i=0}^{n} i$ [link](/) _em_ <green>ok</green>]
Every inline construct at once inside one title.
:::

:::caution[A deliberately long title that runs well past the width of the callout bar so we can see how the summary wraps the label onto a second and even a third line without breaking the icon or the chevron alignment]
Overflow and wrapping in the title.
:::

:::note[Leading **bold** word]
Bold at the start.
:::

:::note[Trailing word **bold**]
Bold at the end.
:::

### Structure (limits)

:::note
:::

:::tip[Only a label, no body]
:::

::::warning[Outer callout]
With a nested callout inside:

:::note[Inner callout]
The inner body.
:::
::::

:::note[A fence containing `:::` inside a callout]
```text
:::tip
not a callout, just text in a fence
:::
```
:::

:::important
### A heading inside a callout

Does it get an anchor and a table-of-contents entry pointing into the
callout?
:::

:::bogus[An unknown variant]
This should warn at build time and be dropped from the output.
:::

## Block code

```ts title="example.ts" {4} ins={5} del={6}
import { defineMdastPlugin } from "satteri"

export const demo = defineMdastPlugin({
  name: "demo",
  inserted: true,
  removed: false,
})
```

```bash
$ bun install
bun install v1.2.0 (6a363a38)
+ satteri@0.6.3
$ bun run build \
    --verbose
done in 1.2s
```

```text
status: <green>passing</green> <dim>(34 checks)</dim>
errors: <red>2 failed</red>
note:   <cyan>cached</cyan> <orange>3 slow</orange>
```

```sh output="json"
$ curl localhost:4321/api/leaderboard/now
{"kind":"goodLeaderboard","data":{"leaderboard":[],"total":0}}
$ curl localhost:4321/api/missing
<red>404 page not found</red>
```

```ts collapse={1-4}
// these lines are
// collapsed by
// default via
// the collapse prop
export const visible = true
```

### Block code (limits)

```ts wrap=false
const horizontal = "this line is intentionally far longer than any reasonable container width so that wrap=false forces horizontal scrolling inside the frame rather than soft-wrapping onto the next line, which is the configured default everywhere else in these fixtures"
```

```ts
const wrapped = "the same situation with the default wrap=true: a single logical line long enough to soft-wrap several times inside the frame, testing hanging indent, line-number alignment, and selection behavior across visual rows of one logical line"
```

```text
multi-line tones cannot exist: <red>this opening tag
never closes on its own line</red> so both lines stay literal
```

```text tones=false
status: <green>literal tags</green> <dim>(kept verbatim via tones=false)</dim>
```

````md
A four-backtick fence holding a three-backtick fence:

```ts
const nested = true
```
````

```zzz
an unknown language falls back to plain text
```

```ts
```

```ts {1} ins={2} del={3} collapse={5-6} title="kitchen — sink.ts" showLineNumbers
const marked = 1
const inserted = 2
const removed = 3
const visible = 4
const collapsedA = 5
const collapsedB = 6
```

    an indented code block with no fence, no language, and no frame

## Directive components

:::steps
1. A step with prose and `code`.

   A second paragraph inside the step.
2. Another step with a block:

   ```sh
   $ bun run build
   ```
3. The last step has no connector below.
:::

::::tabs{sync=pkg}
:::tab[bun]
Use `$ bun add satteri`.
:::
:::tab[npm]
Use `$ npm install satteri`.
:::
::::

::::tabs{sync=pkg}
:::tab[bun]
Synced sibling: bun.
:::
:::tab[npm]
Synced sibling: npm.
:::
::::

::::card-grid
:::card[Linked card]{href=/docs}
With a description body and a `code` span.
:::
:::card[Static card]
No link on this one.
:::
::::

::card[Leaf card]{href=/fixtures}

:::file-tree
- src/
  - components/
    - **Sidebar.astro** the important one
    - `TabGroups.astro`
  - styles/
- package.json
- ...
:::

:::details[A closed disclosure]
Hidden until opened.
:::

:::details[An open disclosure]{open}
Visible immediately.
:::

### Directives (limits)

::::steps
1. A step containing a callout:

   :::note[Inside a step]
   A callout nested in an ordered step.
   :::

2. A step containing a table:

   | a | b |
   | - | - |
   | 1 | 2 |

3. A step whose text is long enough to wrap: this sentence keeps going well past the measure so the connector line, the number bubble, and the hanging indent all get exercised by a multi-line step body.
::::

:::::tabs{sync=limits}
::::tab[with a fence]
```sh
$ echo nested
```
::::
::::tab[with a heading]
#### A heading hidden inside a tab

Does the table of contents link to content inside an unselected tab?
::::
::::tab[with a callout]
:::note
A callout inside a tab.
:::
::::
:::::

:::file-tree
- a/
  - b/
    - c/
      - d/
        - e/
          - deep.ts
- averyverylongfilenamethatmustwraportruncateinsidethefiletreecomponent.config.mjs
- **highlighted-and-bold.ts** with a trailing comment that is also fairly long
- Program Files (x86)/
  - Azusawa's Gacha World.exe
  - `a name in backticks.dll` with a trailing comment
:::

::card[A leaf card with a very long title that should wrap inside the card frame instead of overflowing it]{href=/fixtures}

Empty bodies for every directive, which must not crash the build:

::::steps
::::

::::tabs
::::

:::::tabs{sync=empties}
::::tab[an empty tab]
::::
::::tab[a populated sibling]
With a body.
::::
:::::

:::file-tree
:::

:::file-tree
- 
:::

:::details
:::

:::card
:::

## Math

Euler's identity inline: $e^{i\pi} + 1 = 0$.

$$
\int_{-\infty}^{\infty} e^{-x^2} \,dx = \sqrt{\pi}
$$

### Math (limits)

The currency trap with single-dollar math enabled: prices from $50 to $100
become math. Escaped dollars survive: from \$50 to \$100.

Inline math long enough to wrap mid-sentence
$\sum_{i=0}^{n} \binom{n}{i} x^i (1-x)^{n-i} = 1$ and one with tall
delimiters $\left( \frac{a^{b^c}}{d_{e_f}} \right)^{g}$ between words.

$$
\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} &
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \cdot \mathbf{B} &= 0 &
\nabla \times \mathbf{B} &= \mu_0\mathbf{J} + \mu_0\varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{aligned}
$$

$$
f(x) = \underbrace{\int_{-\infty}^{\infty} \hat{f}(\xi)\, e^{2\pi i \xi x} \,d\xi}_{\text{a display equation wide enough that it may need to scroll or scale on narrow viewports rather than overflowing}}
$$

## Prose

A [local link](/blog) and an [external link](https://satteri.bruits.org)
which should open in a new tab. Press <kbd>⌘</kbd><kbd>K</kbd> for nothing,
for now.[^1]

> A blockquote with `inline code` and a `<green>tone</green>`.

| Feature | Status | Notes |
| - | - | - |
| Anchors | `<green>done</green>` | Hover a heading |
| Tones | `<green>done</green>` | Inline and block |
| Pills | `<green>done</green>` | Click to copy |

1. Ordered item
2. Another item
   - Nested unordered
   - With `code`

- [x] Task complete
- [ ] Task pending

### Prose (limits)

Raw HTML swallows text: Array<T> loses its type parameter because <T> parses
as an open tag, while the escaped \<T\> and the coded `Array<T>` both
survive. An unbroken URL:
<https://example.com/api/v2/leaderboard?offset=0&limit=100&division=open&bracket=undergraduate&format=json&cache=false>
and a bare autolink www.example.com plus literal asterisks \*not emphasis\*.

> Outer quote with `code`
>
> > Nested quote with a `<red>tone</red>`
> >
> > > Third level with math $x^2$ and a footnote[^dup]

| A very long header cell that should wrap or truncate gracefully inside the column | `code` | Aligned right |
| :- | :-: | -: |
| A cell with an extremely long sentence that runs far past the column's natural width to force wrapping behavior inside table cells, including a `$ bun run build` pill and a `<green>tone</green>` | centered | `<red>fail</red>` |
| escaped \| pipe | | trailing empty cell above and an empty middle cell here |

- one
  - two
    - three
      - four
        - five
          - six levels deep with `code` and a long sentence that wraps within the deepest indentation level to test alignment of the wrapped lines

99. starts at ninety-nine
100. crosses into three digits, so the markers change width mid-list

A hard break with two trailing spaces  
then a backslash break\
then a normal soft wrap.

The same footnote referenced twice[^dup] and a footnote containing a
fence[^block].

<details>
  <summary>Raw HTML passthrough with <em>markup</em></summary>
  Inside: an <unknown-element>unregistered custom element</unknown-element>
  and a <a href="/docs">raw link</a>.
</details>

## Lists

A tight item with a fence between bare text — the bare runs should be
promoted to paragraphs so spacing appears on both sides of the block:

- text before the fence
  ```ts
  const wrapped = true
  ```
  text after the fence
- a plain sibling item for comparison

A tight item with a callout:

- text before the callout
  :::note
  A callout nested in a tight list item.
  :::
  text after the callout

A tight item with display math:

- text before the math
  $$
  e^{i\pi} + 1 = 0
  $$
  text after the math

A tight item with a standalone image — alone on its line it gets its own
paragraph, while an inline one stays in the sentence:

- text before the image
  ![favicon placeholder](/favicon.svg)
  text after the image
- an inline ![favicon placeholder](/favicon.svg) image in a sentence

### Lists (limits)

A raw HTML block swallows the rest of its line group: everything until the
next blank line is fused into the figure's raw HTML at parse time, so the
trailing text has to be split back out of the raw block before it can be
wrapped:

- text before the figure
  <figure><figcaption>a raw figure</figcaption></figure>
  text after the figure, fused into the raw block at parse time

The same figure separated by blank lines keeps the trailing text as a real
paragraph:

- text before the figure

  <figure><figcaption>a raw figure</figcaption></figure>

  text after the figure

[^1]: A footnote with `code{:ts}`.

[^dup]: Referenced twice — the backrefs should render ↑ and ↑2.

[^block]: A footnote containing a fence:

    ```ts
    const insideFootnote = true
    ```
