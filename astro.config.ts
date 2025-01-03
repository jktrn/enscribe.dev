import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerRenderWhitespace,
} from '@shikijs/transformers'
import { defineConfig } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import rehypeExternalLinks from 'rehype-external-links'
import rehypePrettyCode from 'rehype-pretty-code'
import remarkEmoji from 'remark-emoji'
import remarkMath from 'remark-math'
import remarkToc from 'remark-toc'
import sectionize from '@hbsnow/rehype-sectionize'
import { transformerNotationSkip } from './src/lib/transformerNotationSkip'
import { transformerDiffHighlight } from './src/lib/transformerDiffHighlight'

import icon from 'astro-icon'

// https://astro.build/config
export default defineConfig({
  site: 'https://enscribe.dev',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
    mdx(),
    react(),
    icon(),
  ],
  markdown: {
    syntaxHighlight: false,
    rehypePlugins: [
      [
        rehypeExternalLinks,
        {
          target: '_blank',
          rel: ['nofollow', 'noreferrer', 'noopener'],
        },
      ],
      rehypeHeadingIds,
      [
        rehypeKatex,
        {
          strict: false,
        },
      ],
      sectionize as any,
      [
        rehypePrettyCode,
        {
          theme: {
            light: 'everforest-dark',
            dark: 'everforest-dark',
          },
          transformers: [
            transformerNotationDiff(),
            transformerMetaHighlight(),
            transformerRenderWhitespace(),
            transformerNotationSkip(),
            transformerDiffHighlight(),
          ],
        },
      ],
    ],
    remarkPlugins: [remarkToc, remarkMath, remarkEmoji],
  },
  server: {
    port: 1234,
    host: true,
  },
  devToolbar: {
    enabled: false,
  },
})
