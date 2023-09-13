import { ReactNode } from 'react'
import { formatDate } from 'pliny/utils/formatDate'
import { CoreContent } from 'pliny/utils/contentlayer'
import type { Blog } from 'contentlayer/generated'
import Comments from '@/components/Comments'
import Link from '@/components/Link'
import PageTitle from '@/components/PageTitle'
import siteMetadata from '@/data/siteMetadata'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'

interface LayoutProps {
    content: CoreContent<Blog>
    children: ReactNode
    next?: { path: string; title: string }
    prev?: { path: string; title: string }
}

export default function PostLayout({ content, next, prev, children }: LayoutProps) {
    const { path, slug, date, title } = content

    return (
        <>
            <ScrollTopAndComment />
            <article>
                <div>
                    <header>
                        <div className="space-y-1 border-b border-muted-foreground pb-10 text-center dark:border-muted">
                            <dl>
                                <div>
                                    <dt className="sr-only">Published on</dt>
                                    <dd className="text-base font-medium leading-6 text-muted-foreground">
                                        <time dateTime={date}>
                                            {formatDate(date, siteMetadata.locale)}
                                        </time>
                                    </dd>
                                </div>
                            </dl>
                            <div>
                                <PageTitle>{title}</PageTitle>
                            </div>
                        </div>
                    </header>
                    <div className="grid-rows-[auto_1fr] divide-y divide-muted-foreground pb-8 dark:divide-muted xl:divide-y-0">
                        <div className="divide-y divide-accent-foreground dark:divide-accent xl:col-span-3 xl:row-span-2 xl:pb-0">
                            <div className="prose max-w-none pb-8 pt-10 dark:prose-invert">
                                {children}
                            </div>
                        </div>
                        {siteMetadata.comments && (
                            <div
                                className="pb-6 pt-6 text-center text-muted-foreground"
                                id="comment"
                            >
                                <Comments slug={slug} />
                            </div>
                        )}
                        <footer>
                            <div className="flex flex-col text-sm font-medium sm:flex-row sm:justify-between sm:text-base">
                                {prev && prev.path && (
                                    <div className="pt-4 xl:pt-8">
                                        <Link
                                            href={`/${prev.path}`}
                                            className="text-primary hover:brightness-125 dark:hover:brightness-125"
                                            aria-label={`Previous post: ${prev.title}`}
                                        >
                                            &larr; {prev.title}
                                        </Link>
                                    </div>
                                )}
                                {next && next.path && (
                                    <div className="pt-4 xl:pt-8">
                                        <Link
                                            href={`/${next.path}`}
                                            className="text-primary hover:brightness-125 dark:hover:brightness-125"
                                            aria-label={`Next post: ${next.title}`}
                                        >
                                            {next.title} &rarr;
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </footer>
                    </div>
                </div>
            </article>
        </>
    )
}
