import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      image: image().optional(),
      tags: z.array(z.string()).optional(),
      authors: z.array(z.string()).optional(),
      draft: z.boolean().optional(),
      hidden: z.boolean().optional(),
      parentTitle: z.string().optional(),
      parentSlug: z.string().optional(),
      tableOfContents: z
        .array(
          z.object({
            depth: z.number(),
            slug: z.string(),
            text: z.string(),
            subheadings: z.lazy(() =>
              z.array(
                z.object({
                  depth: z.number(),
                  slug: z.string(),
                  text: z.string(),
                  subheadings: z.array(z.any()),
                }),
              ),
            ),
          }),
        )
        .optional(),
      tableOfContentsTitle: z.string().optional(),
      activeSlug: z.string().optional(),
    }),
})

const authors = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    pronouns: z.string().optional(),
    avatar: z.string().url(),
    bio: z.string().optional(),
    mail: z.string().email().optional(),
    website: z.string().url().optional(),
    twitter: z.string().url().optional(),
    github: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    discord: z.string().url().optional(),
  }),
})

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      image: image(),
      link: z.string().url(),
    }),
})

export const collections = { blog, authors, projects }
