import siteMetadata from '@/data/siteMetadata'
import { Metadata } from 'next'

interface PageSEOProps {
    title: string
    description?: string
    image?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
}

export function genPageMetadata({ title, description, image, ...rest }: PageSEOProps): Metadata {
    return {
        title,
        openGraph: {
            title: `${title} | ${siteMetadata.title}`,
            description: description || siteMetadata.description,
            url: './',
            siteName: siteMetadata.title,
            images: image ? [image] : [siteMetadata.socialBanner],
            locale: 'en_US',
            type: 'website',
        },
        twitter: {
            title: `${title} | ${siteMetadata.title}`,
            card: 'summary_large_image',
            images: image ? [image] : [siteMetadata.socialBanner],
        },
        ...rest,
    }
}
