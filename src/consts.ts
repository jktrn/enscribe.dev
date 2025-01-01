export type Site = {
  TITLE: string
  DESCRIPTION: string
  EMAIL: string
  NUM_POSTS_ON_HOMEPAGE: number
  POSTS_PER_PAGE: number
  SITEURL: string
}

export type Link = {
  href: string
  label: string
}

export const SITE: Site = {
  TITLE: 'enscribe.dev',
  DESCRIPTION:
    'Freelance frontend web development and cybersecurity shenanigans.',
  EMAIL: 'jason@enscribe.dev',
  NUM_POSTS_ON_HOMEPAGE: 2,
  POSTS_PER_PAGE: 4,
  SITEURL: 'https://enscribe.dev',
}

export const NAV_LINKS: Link[] = [
  { href: '/', label: 'home' },
  { href: '/blog', label: 'blog' },
  // { href: '/authors', label: 'authors' },
  // { href: '/about', label: 'about' },
  // { href: '/tags', label: 'tags' },
]

export const SOCIAL_LINKS: Link[] = [
  { href: 'https://github.com/jktrn', label: 'GitHub' },
  { href: 'https://twitter.com/enscry', label: 'Twitter' },
  { href: 'jason@enscribe.dev', label: 'Email' },
  { href: '/rss.xml', label: 'RSS' },
]
