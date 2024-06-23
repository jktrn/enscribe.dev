'use client'

import Image from '@/components/Image'
import Link from '@/components/Link'
import { slug as githubSlugger } from 'github-slugger'
import { Badge } from '@/components/shadcn/badge'
import { Skeleton } from '@/components/shadcn/skeleton'
import siteMetadata from '@/data/siteMetadata'
import type { Blog } from 'contentlayer/generated'
import { Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { CoreContent } from 'pliny/utils/contentlayer'
import { formatDate } from 'pliny/utils/formatDate'
import { useEffect, useState } from 'react'

interface PaginationProps {
    totalPages: number
    currentPage: number
}
interface ListLayoutProps {
    posts: CoreContent<Blog>[]
    title: string
    initialDisplayPosts?: CoreContent<Blog>[]
    pagination?: PaginationProps
}

function Pagination({ totalPages, currentPage }: PaginationProps) {
    const pathname = usePathname()
    const basePath = pathname.split('/')[1]
    const prevPage = currentPage - 1 > 0
    const nextPage = currentPage + 1 <= totalPages

    return (
        <div className="space-y-2 py-8 md:space-y-5">
            <nav className="flex justify-between">
                {!prevPage && (
                    <button className="cursor-auto disabled:opacity-50" disabled={!prevPage}>
                        Previous
                    </button>
                )}
                {prevPage && (
                    <Link
                        href={
                            currentPage - 1 === 1
                                ? `/${basePath}/`
                                : `/${basePath}/page/${currentPage - 1}`
                        }
                        rel="prev"
                    >
                        Previous
                    </Link>
                )}
                <span>
                    {currentPage} of {totalPages}
                </span>
                {!nextPage && (
                    <button className="cursor-auto disabled:opacity-50" disabled={!nextPage}>
                        Next
                    </button>
                )}
                {nextPage && (
                    <Link href={`/${basePath}/page/${currentPage + 1}`} rel="next">
                        Next
                    </Link>
                )}
            </nav>
        </div>
    )
}

export default function ListLayout({
    posts,
    title,
    initialDisplayPosts = [],
    pagination,
}: ListLayoutProps) {
    const [searchValue, setSearchValue] = useState('')
    const [pageViews, setPageViews] = useState<Record<string, number | undefined>>({})

    const filteredBlogPosts = posts.filter((post) => {
        const searchContent = post.title + post.summary + post.tags?.join(' ')
        return searchContent.toLowerCase().includes(searchValue.toLowerCase())
    })

    useEffect(() => {
        posts.forEach((post) => {
            const slug = post.slug
            if (slug && !(slug in pageViews)) {
                // Assume undefined means loading
                setPageViews((prevPageViews) => ({
                    ...prevPageViews,
                    [slug]: undefined,
                }))

                fetch(`/api/page-views?slug=${encodeURIComponent(slug)}`)
                    .then((response) => response.json())
                    .then((data) => {
                        setPageViews((prevPageViews) => ({
                            ...prevPageViews,
                            [slug]: data.pageViewCount,
                        }))
                    })
                    .catch((error) => console.error('Error fetching page views:', error))
            }
        })
    }, [posts])

    // If initialDisplayPosts exist, display it if no searchValue is specified
    const displayPosts =
        initialDisplayPosts.length > 0 && !searchValue ? initialDisplayPosts : filteredBlogPosts

    return (
        <>
            <div className="divide-y divide-accent-foreground dark:divide-accent">
                <div className="space-y-2 py-8 md:space-y-5">
                    <h1 className="text-3xl font-extrabold leading-9 tracking-tight text-foreground sm:text-4xl sm:leading-10 md:text-6xl md:leading-14">
                        {title}
                    </h1>
                    <div className="relative w-full">
                        <label>
                            <span className="sr-only">Search articles</span>
                            <input
                                aria-label="Search articles"
                                type="text"
                                onChange={(e) => setSearchValue(e.target.value)}
                                placeholder="Search articles"
                                className="block w-full rounded-md border border-muted-foreground bg-secondary px-4 py-2 text-muted-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary dark:border-muted"
                            />
                        </label>
                        <Search className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                    </div>
                </div>
                <ul>
                    {!filteredBlogPosts.length && 'No posts found.'}
                    {displayPosts.map((post) => {
                        const { slug, path, date, title, summary, tags, thumbnail } = post
                        const isLoadingViewCount = pageViews[slug] === undefined
                        return (
                            <li key={path} className="py-4">
                                <article className="space-y-2 xl:grid xl:grid-cols-5 xl:items-start xl:gap-4 xl:space-y-0">
                                    <div className="xl:col-span-2">
                                        <Link href={`/${path}`}>
                                            <Image
                                                src={thumbnail || ''}
                                                alt={`${title} thumbnail`}
                                                width={1200}
                                                height={630}
                                                className="mb-4 h-fit w-full rounded-md object-contain"
                                            />
                                        </Link>
                                    </div>
                                    <div className="space-y-3 xl:col-span-3">
                                        <div>
                                            <h3 className="mb-2 text-2xl font-bold leading-8 tracking-tight">
                                                <Link href={`/${path}`} className="text-foreground">
                                                    {title}
                                                </Link>
                                            </h3>
                                            <div className="flex flex-wrap">
                                                {tags?.map((tag) => (
                                                    <Badge
                                                        key={tag}
                                                        className="mr-2"
                                                        variant={'outline'}
                                                    >
                                                        <Link
                                                            href={`/tags/${githubSlugger(tag)}`}
                                                            className="text-sm font-medium uppercase text-primary hover:brightness-125 dark:hover:brightness-125"
                                                        >
                                                            {tag.split(' ').join('-')}
                                                        </Link>
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="prose prose-sm max-w-none text-muted-foreground">
                                            {summary}
                                        </div>
                                        <div>
                                            <dl>
                                                <dt className="sr-only">Published on</dt>
                                                <dd className="flex gap-1 text-base font-medium leading-6 text-muted-foreground">
                                                    {isLoadingViewCount ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                            <Skeleton className="h-6 w-12" />
                                                            <span> views</span>
                                                        </span>
                                                    ) : (
                                                        <span>
                                                            {pageViews[slug]?.toLocaleString() ||
                                                                '...'}{' '}
                                                            views
                                                        </span>
                                                    )}
                                                    <span>・</span>
                                                    <time dateTime={date}>
                                                        {formatDate(date, siteMetadata.locale)}
                                                    </time>
                                                </dd>
                                            </dl>
                                        </div>
                                    </div>
                                </article>
                            </li>
                        )
                    })}
                </ul>
            </div>
            {pagination && pagination.totalPages > 1 && !searchValue && (
                <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                />
            )}
        </>
    )
}
