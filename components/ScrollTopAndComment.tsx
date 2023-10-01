'use client'

import siteMetadata from '@/data/siteMetadata'
import { ArrowUp, MessagesSquare } from 'lucide-react'
import { useEffect, useState } from 'react'

const ScrollTopAndComment = () => {
    const [show, setShow] = useState(false)

    useEffect(() => {
        const handleWindowScroll = () => {
            if (window.scrollY > 50) setShow(true)
            else setShow(false)
        }

        window.addEventListener('scroll', handleWindowScroll)
        return () => window.removeEventListener('scroll', handleWindowScroll)
    }, [])

    const handleScrollTop = () => {
        window.scrollTo({ top: 0 })
    }
    const handleScrollToComment = () => {
        document.getElementById('comment')?.scrollIntoView()
    }
    return (
        <div
            className={`fixed bottom-8 right-8 hidden flex-col gap-3 ${
                show ? 'md:flex' : 'md:hidden'
            }`}
        >
            {/* {siteMetadata.comments?.provider && (
                <button
                    aria-label="Scroll To Comment"
                    onClick={handleScrollToComment}
                    className="rounded-full bg-muted p-2 text-muted-foreground transition-all hover:brightness-125"
                >
                    <MessagesSquare />
                </button>
            )} */}
            <button
                aria-label="Scroll To Top"
                onClick={handleScrollTop}
                className="rounded-full bg-muted p-2 text-muted-foreground transition-all hover:brightness-125"
            >
                <ArrowUp />
            </button>
        </div>
    )
}

export default ScrollTopAndComment
