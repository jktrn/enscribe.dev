import siteMetadata from '@/data/siteMetadata'
import { allBlogs } from 'contentlayer/generated'
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const siteUrl = siteMetadata.siteUrl
    const blogRoutes = allBlogs
        .filter((post) => !post.draft)
        .map((post) => ({
            url: `${siteUrl}/${post.path}`,
            lastModified: post.lastmod || post.date,
        }))

    const routes = ['', 'blog', 'projects'].map((route) => ({
        url: `${siteUrl}/${route}`,
        lastModified: new Date().toISOString().split('T')[0],
    }))

    return [...routes, ...blogRoutes]
}
