import Comments from '@/components/Comments'
import Image from '@/components/Image'
import Link from '@/components/Link'
import PageTitle from '@/components/PageTitle'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'
import Tag from '@/components/Tag'
import siteMetadata from '@/data/siteMetadata'
import type { Authors, Blog } from 'contentlayer/generated'
import { CoreContent } from 'pliny/utils/contentlayer'
import { ReactNode } from 'react'

const editUrl = (path) => `${siteMetadata.siteRepo}/blob/main/data/${path}`
const discussUrl = (path) =>
    `https://mobile.twitter.com/search?q=${encodeURIComponent(`${siteMetadata.siteUrl}/${path}`)}`

const postDateTemplate: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
}

interface LayoutProps {
    content: CoreContent<Blog>
    authorDetails: CoreContent<Authors>[]
    next?: { path: string; title: string }
    prev?: { path: string; title: string }
    children: ReactNode
}

export default function PostLayout({ content, authorDetails, next, prev, children }: LayoutProps) {
    const { filePath, path, slug, date, title, tags } = content
    const basePath = path.split('/')[0]

    return (
        <>
            <ScrollTopAndComment />
            <article>
                <div className="xl:divide-y xl:divide-muted-foreground xl:dark:divide-muted">
                    <header className="pt-6 xl:pb-6">
                        <div className="space-y-1 text-center">
                            <dl className="space-y-10">
                                <div>
                                    <dt className="sr-only">Published on</dt>
                                    <dd className="text-base font-medium leading-6 text-muted-foreground">
                                        <time dateTime={date}>
                                            {new Date(date).toLocaleDateString(
                                                siteMetadata.locale,
                                                postDateTemplate
                                            )}
                                        </time>
                                    </dd>
                                </div>
                            </dl>
                            <div>
                                <PageTitle>{title}</PageTitle>
                            </div>
                        </div>
                    </header>
                    <div className="grid-rows-[auto_1fr] divide-y divide-muted-foreground pb-8 dark:divide-muted xl:grid xl:grid-cols-4 xl:gap-x-6 xl:divide-y-0">
                        <dl className="pb-10 pt-6 xl:border-b xl:border-muted-foreground xl:pt-11 xl:dark:border-muted">
                            <dt className="sr-only">Authors</dt>
                            <dd>
                                <ul className="flex flex-wrap justify-center gap-4 sm:space-x-12 xl:block xl:space-x-0 xl:space-y-8">
                                    {authorDetails.map((author) => (
                                        <li
                                            className="flex items-center space-x-2"
                                            key={author.name}
                                        >
                                            {author.avatar && (
                                                <Image
                                                    src={author.avatar}
                                                    width={38}
                                                    height={38}
                                                    alt="avatar"
                                                    className="h-10 w-10 rounded-full"
                                                />
                                            )}
                                            <dl className="whitespace-nowrap text-sm font-medium leading-5">
                                                <dt className="sr-only">Name</dt>
                                                <dd className="text-foreground">{author.name}</dd>
                                                <dt className="sr-only">Twitter</dt>
                                                <dd>
                                                    {author.twitter && (
                                                        <Link
                                                            href={author.twitter}
                                                            className="text-primary hover:brightness-125 dark:hover:brightness-125"
                                                        >
                                                            {author.twitter.replace(
                                                                'https://twitter.com/',
                                                                '@'
                                                            )}
                                                        </Link>
                                                    )}
                                                </dd>
                                            </dl>
                                        </li>
                                    ))}
                                </ul>
                            </dd>
                        </dl>
                        <div className="divide-y divide-accent-foreground dark:divide-accent xl:col-span-3 xl:row-span-2 xl:pb-0">
                            <div className="prose prose-sm max-w-none pb-8 pt-10 dark:prose-invert">
                                {children}
                            </div>
                            <div className="pb-6 pt-6 text-sm text-muted-foreground">
                                <Link href={discussUrl(path)} rel="nofollow">
                                    Discuss on Twitter
                                </Link>
                                {` • `}
                                <Link href={editUrl(filePath)}>View on GitHub</Link>
                            </div>
                            {/* {siteMetadata.comments && (
                                <div
                                    className="pb-6 pt-6 text-center text-muted-foreground"
                                    id="comment"
                                >
                                    <Comments slug={slug} />
                                </div>
                            )} */}
                        </div>
                        <footer>
                            <div className="divide-muted-foreground text-sm font-medium leading-5 dark:divide-muted xl:col-start-1 xl:row-start-2 xl:divide-y">
                                {tags && (
                                    <div className="py-4 xl:py-8">
                                        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                                            Tags
                                        </h2>
                                        <div className="flex flex-wrap space-x-3">
                                            {tags.map((tag) => (
                                                <Tag key={tag} text={tag} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(next || prev) && (
                                    <div className="flex justify-between py-4 xl:block xl:space-y-8 xl:py-8">
                                        {prev && prev.path && (
                                            <div>
                                                <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                                                    Previous Article
                                                </h2>
                                                <div className="text-primary hover:brightness-125 dark:hover:brightness-125">
                                                    <Link href={`/${prev.path}`}>{prev.title}</Link>
                                                </div>
                                            </div>
                                        )}
                                        {next && next.path && (
                                            <div>
                                                <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                                                    Next Article
                                                </h2>
                                                <div className="text-primary hover:brightness-125 dark:hover:brightness-125">
                                                    <Link href={`/${next.path}`}>{next.title}</Link>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 xl:pt-8">
                                <Link
                                    href={`/${basePath}`}
                                    className="text-primary hover:brightness-125 dark:hover:brightness-125"
                                    aria-label="Back to the blog"
                                >
                                    &larr; Back to the blog
                                </Link>
                            </div>
                        </footer>
                    </div>
                </div>
            </article>
        </>
    )
}
