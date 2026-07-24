# Inline link icons

Every external link gets an icon after its text. Hostnames listed in
[`src/lib/link-icons.ts`](../../../src/lib/link-icons.ts) use their mapped SVG;
every other hostname uses `custom-external-link.svg`.

## Add an icon

1. Copy a monochrome SVG into this directory. It must have a `viewBox` and must
   not contain scripts, embedded images, or external references.
2. Add one line to `LINK_ICONS_BY_HOST` in `src/lib/link-icons.ts`:

   ```ts
   "example.com": "example.svg",
   ```

   Use the hostname without `www.`; normalization handles it automatically.
3. Run `bun run favicons:check`, `bun test`, and `bun run build`.

If a site does not need its own icon, do nothing. It will automatically use the
generic external-link icon.

## Sources

- `phosphor-*.svg`: Phosphor Icons 2.1.1 Fill (MIT)
- `simple-*.svg`: Simple Icons 16.26.0 (CC0-1.0; marks belong to their owners)
- `custom-*.svg`: project-specific or user-supplied assets
