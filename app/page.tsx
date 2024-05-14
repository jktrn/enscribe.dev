import { allBlogs } from 'contentlayer/generated'
import { allCoreContent, sortPosts } from 'pliny/utils/contentlayer'
import { genPageMetadata } from './seo'

import Main from './main'

export const metadata = genPageMetadata({ title: 'Home | enscribe.dev' })

export default async function Page() {
    const sortedPosts = sortPosts(allBlogs)
    const posts = allCoreContent(sortedPosts)
    return <Main posts={posts} />
}
