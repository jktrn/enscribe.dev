'use client'

import { cn } from '@/scripts/utils/tailwind-helpers'
import { Toc } from 'pliny/mdx-plugins/remark-toc-headings'
import React, { useEffect, useState } from 'react'

type TocItem = {
    value: string
    url: string
    depth: number
    active?: boolean
}

export interface TOCInlineProps {
    toc: Toc
    title?: string
    fromHeading?: number
    toHeading?: number
    asDisclosure?: boolean
    exclude?: string | string[]
    collapse?: boolean
    ulClassName?: string
    liClassName?: string
    rightAlign?: boolean
}

export interface NestedTocItem extends TocItem {
    children?: NestedTocItem[]
}

const createNestedList = (items: TocItem[]): NestedTocItem[] => {
    const nestedList: NestedTocItem[] = []
    const stack: NestedTocItem[] = []

    items.forEach((item) => {
        const newItem: NestedTocItem = { ...item }
        while (stack.length > 0 && stack[stack.length - 1].depth >= newItem.depth) {
            stack.pop()
        }
        const parent = stack.length > 0 ? stack[stack.length - 1] : null
        if (parent) {
            parent.children = parent.children || []
            parent.children.push(newItem)
        } else {
            nestedList.push(newItem)
        }
        stack.push(newItem)
    })

    return nestedList
}

const TOCInline = ({
    toc,
    title = 'Table of Contents',
    fromHeading = 1,
    toHeading = 6,
    asDisclosure = false,
    exclude = '',
    collapse = false,
    ulClassName = '',
    liClassName = '',
    rightAlign = false,
}: TOCInlineProps) => {
    const [activeId, setActiveId] = useState<string | null>(null)

    const re = Array.isArray(exclude)
        ? new RegExp('^(' + exclude.join('|') + ')$', 'i')
        : new RegExp('^(' + exclude + ')$', 'i')

    const filteredToc = toc.filter(
        (heading) =>
            heading.depth >= fromHeading && heading.depth <= toHeading && !re.test(heading.value)
    )

    const handleScroll = () => {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop

        let currentId = ''
        headings.forEach((heading) => {
            const id = heading.getAttribute('id')
            if (id) {
                const rect = heading.getBoundingClientRect()
                if (rect.top + window.pageYOffset - 300 <= scrollPosition) {
                    currentId = id
                }
            }
        })

        setActiveId(currentId)
    }

    useEffect(() => {
        window.addEventListener('scroll', handleScroll)
        return () => {
            window.removeEventListener('scroll', handleScroll)
        }
    }, [])

    const createList = (items: NestedTocItem[] | undefined, level = 0) => {
        if (!items || items.length === 0) {
            return null
        }
        return (
            <ul
                className={ulClassName}
                style={{
                    [rightAlign ? 'marginRight' : 'marginLeft']: `${
                        level == 0 ? level + 1.5 : level
                    }rem`,
                }}
            >
                {items.map((item, index) => (
                    <li key={index} className={liClassName}>
                        <a
                            href={item.url}
                            className={cn(
                                'inline-block mb-1',
                                (item.url.substring(1, item.url.length) === activeId ||
                                    item.active) &&
                                    'active-header'
                            )}
                        >
                            {item.value}
                        </a>
                        {createList(item.children, level + 1)}
                    </li>
                ))}
            </ul>
        )
    }

    const nestedList = createNestedList(filteredToc)

    return (
        <>
            {!asDisclosure && (
                <div
                    className={`pb-2 pt-2 text-base font-bold ${
                        rightAlign ? 'mr-6 text-right' : 'ml-6'
                    }`}
                >
                    {title}
                </div>
            )}
            {asDisclosure ? (
                <details open={!collapse}>
                    <summary
                        className={`pb-2 pt-2 text-xl font-bold ${
                            rightAlign ? 'mr-6 text-right' : 'ml-6'
                        }`}
                    >
                        Table of Contents
                    </summary>
                    <div className={rightAlign ? 'mr-6' : 'ml-6'}>{createList(nestedList)}</div>
                </details>
            ) : (
                createList(nestedList)
            )}
        </>
    )
}

export default TOCInline
