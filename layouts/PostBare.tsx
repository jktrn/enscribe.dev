'use client'

import Image from '@/components/Image'
import Link from '@/components/Link'
import PageTitle from '@/components/PageTitle'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'
import TOCInline from '@/components/TOCInline'
import Tag from '@/components/Tag'
import { Skeleton } from '@/components/shadcn/skeleton'
import siteMetadata from '@/data/siteMetadata'
import type { Authors, Blog } from 'contentlayer/generated'
import NextImage from 'next/image'
import { Toc } from 'pliny/mdx-plugins'
import { CoreContent } from 'pliny/utils/contentlayer'
import { formatDate } from 'pliny/utils/formatDate'
import { ReactNode, useEffect, useState } from 'react'

interface LayoutProps {
    content: CoreContent<Blog>
    authorDetails: CoreContent<Authors>[]
    children: ReactNode
    toc: Toc
    next?: { path: string; title: string }
    prev?: { path: string; title: string }
}

export default function PostBare({
    content,
    authorDetails,
    toc,
    next,
    prev,
    children,
}: LayoutProps) {
    const { path, slug, tags, date, title, thumbnail } = content
    const displayThumbnail = thumbnail ? thumbnail : '/static/images/twitter-card.png'
    const [isLoading, setIsLoading] = useState(true)
    const [pageViews, setPageViews] = useState({
        isLoading: true,
        count: null,
    })

    useEffect(() => {
        setPageViews((prev) => ({ ...prev, isLoading: true }))
        if (slug) {
            fetch(`/api/page-views?slug=${encodeURIComponent(slug)}`)
                .then((response) => response.json())
                .then((data) => {
                    setPageViews({
                        isLoading: false,
                        count: data.pageViewCount.toLocaleString(),
                    })
                })
                .catch((error) => {
                    console.error('Error fetching page views:', error)
                    setPageViews({
                        isLoading: false,
                        count: null,
                    })
                })
        }
    }, [slug])

    return (
        <>
            <ScrollTopAndComment />
            <article>
                <div>
                    <div className="grid-rows-[auto_1fr] divide-y divide-muted-foreground pb-8 dark:divide-muted xl:divide-y-0">
                        <div className="divide-y divide-accent-foreground dark:divide-accent xl:col-span-3 xl:row-span-2 xl:pb-0">
                            <div className="prose prose-sm max-w-none pb-8 pt-10 dark:prose-invert">
                                <div className="toc not-prose">
                                    <TOCInline toc={toc} />
                                </div>
                                <div>{children}</div>
                            </div>
                        </div>
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
