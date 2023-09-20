'use client'

import siteMetadata from '@/data/siteMetadata'
import { Comments as CommentsComponent } from 'pliny/comments'
import { useState } from 'react'

export default function Comments({ slug }: { slug: string }) {
    const [loadComments, setLoadComments] = useState(false)
    return (
        <>
            {!loadComments && <button onClick={() => setLoadComments(true)}>Load Comments</button>}
            {siteMetadata.comments && loadComments && (
                <CommentsComponent commentsConfig={siteMetadata.comments} slug={slug} />
            )}
        </>
    )
}
