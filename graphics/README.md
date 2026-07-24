# Content graphics

This directory contains editable graphics used to create committed blog assets.
Astro does not read or ship files from here.

## Structure

- `blog/<post>/` mirrors `src/content/blog/<post>/`.
- `fonts/` contains fonts required when rasterizing SVG text.

## Rendering themed assets

Run:

```sh
bun run content:render
```

The renderer finds every `*-light.svg` and `*-dark.svg` under `blog/`, resolves
the site's theme color tokens, and writes a 2× WebP beside the matching post's
content assets:

```text
graphics/blog/<post>/<name>-light.svg
  → src/content/blog/<post>/assets/<name>-light.webp
```

The command renders all matching sources and overwrites their WebP outputs. It
is a manual rendering command, not part of `bun run build`.

On macOS, the renderer copies any missing fonts from `fonts/` to
`~/Library/Fonts` so Sharp can preserve SVG text layout.
