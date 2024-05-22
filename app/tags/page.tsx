import Link from '@/components/Link'
import Tag from '@/components/Tag'
import { genPageMetadata } from 'app/seo'
import tagData from 'app/tag-data.json'
import { slug } from 'github-slugger'

export const metadata = genPageMetadata({
    title: 'Tags',
    description: 'Different topics that I blog about.',
    robots: {
        index: false,
        follow: false,
    },
})

export default async function Page() {
    const tagCounts = tagData as Record<string, number>
    const tagKeys = Object.keys(tagCounts)
    const sortedTags = tagKeys.sort((a, b) => tagCounts[b] - tagCounts[a])
    return (
        <>
            <div className="flex flex-col items-start justify-start divide-y divide-accent-foreground dark:divide-accent md:mt-24 md:flex-row md:items-center md:justify-center md:space-x-6 md:divide-y-0">
                <div className="space-x-2 pb-8 pt-6 md:space-y-5">
                    <h1 className="text-3xl font-extrabold leading-9 tracking-tight text-foreground sm:text-4xl sm:leading-10 md:border-r-2 md:px-6 md:text-6xl md:leading-14">
                        Tags
                    </h1>
                </div>
                <div className="flex max-w-lg flex-wrap">
                    {tagKeys.length === 0 && 'No tags found.'}
                    {sortedTags.map((t) => {
                        return (
                            <div key={t} className="mb-2 mr-5 mt-2">
                                <Tag text={t} />
                                <Link
                                    href={`/tags/${slug(t)}`}
                                    className="-ml-1 text-sm font-semibold uppercase text-muted-foreground"
                                    aria-label={`View posts tagged ${t}`}
                                >
                                    {` (${tagCounts[t]})`}
                                </Link>
                            </div>
                        )
                    })}
                </div>
            </div>
        </>
    )
}
