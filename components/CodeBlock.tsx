'use client'

import { getLanguageIcon } from '@/scripts/utils/language-icons.tsx'
import React, { FC, useEffect, useRef, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import createElement from 'react-syntax-highlighter/dist/cjs/create-element'

import CopyButton from './CopyButton'

interface LineProps {
    lineNumber: number
    children: React.ReactNode
    showLineNumbers: boolean
}

const Line: FC<LineProps> = ({ lineNumber, children, showLineNumbers }) => (
    <span className="flex">
        {showLineNumbers && (
            <span className="linenumber inline-block min-w-[2.75em] select-none pr-[1em] text-right text-muted-foreground">
                {lineNumber}
            </span>
        )}
        {children}
    </span>
)

interface CodeBlockProps {
    src?: string
    title?: string
    range?: [number, number][]
    fileName?: string
    language?: string
    rawHTML?: boolean
    terminal?: boolean
    scrollable?: boolean
    wrapLongLines?: boolean
    showLineNumbers?: boolean
    skipLines?: [number, number][]
    addedLines?: [number, number][]
    removedLines?: [number, number][]
}

const CodeBlock: FC<CodeBlockProps> = ({
    src,
    title,
    range,
    fileName,
    language = 'text',
    rawHTML = false,
    terminal = false,
    scrollable = false,
    wrapLongLines = true,
    showLineNumbers = true,
    skipLines = [],
    addedLines = [],
    removedLines = [],
}) => {
    const { code, loading } = useFetchData(src)
    const textInput = useRef(null)
    const [hovered, onEnter, onExit] = useHover()
    const [copied, onCopy] = useCopy(code)

    const preStyles: React.CSSProperties = {
        ...(scrollable ? { maxHeight: '500px', overflowY: 'auto' } : {}),
        ...(terminal ? { backgroundColor: '#111' } : {}),
        fontFamily: 'inherit',
        margin: 0,
    }

    const codeStyles = {
        style: {
            display: 'flex',
            flexDirection: 'column',
            hyphens: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
        },
    }

    const lineRenderer = ({ rows, stylesheet, useInlineStyles }) => {
        let lineNumber = 0
        let removedCount = 0
        const rangeStartEnds = range ?? []

        return rows.map((node, i) => {
            lineNumber++
            if (
                skipLines.some(
                    ([startSkip, endSkip]) => lineNumber >= startSkip && lineNumber <= endSkip - 1
                )
            ) {
                return null
            } else if (skipLines.some(([startSkip, endSkip]) => lineNumber === endSkip)) {
                const foundSkipLine = skipLines.find(
                    ([startSkip, endSkip]) => lineNumber === endSkip
                )
                if (foundSkipLine) {
                    const [startSkip, endSkip] = foundSkipLine
                    return (
                        <span
                            key={i}
                            className="my-4 flex items-center justify-center whitespace-pre rounded-sm bg-secondary py-1 text-xs"
                        >
                            {`${startSkip - removedCount}-${endSkip - removedCount}`}
                        </span>
                    )
                } else {
                    return null
                }
            } else if (
                range &&
                !rangeStartEnds.some(
                    ([rangeStart, rangeEnd]) => lineNumber >= rangeStart && lineNumber <= rangeEnd
                )
            ) {
                return null
            } else {
                const lineStyle: React.CSSProperties = {}
                if (
                    addedLines.some(
                        ([addedStart, addedEnd]) =>
                            lineNumber >= addedStart && lineNumber <= addedEnd
                    )
                ) {
                    lineStyle.backgroundColor = 'rgba(233, 211, 182, 0.05)'
                    // lineStyle.width = '100%'
                } else if (
                    removedLines.some(
                        ([removedStart, removedEnd]) =>
                            lineNumber >= removedStart && lineNumber <= removedEnd
                    )
                ) {
                    lineStyle.backgroundColor = 'rgba(255, 0, 0, 0.1)'
                    // lineStyle.width = '100%'
                    removedCount++
                }
                return (
                    <span style={lineStyle} key={i}>
                        <Line
                            key={i}
                            lineNumber={lineNumber - removedCount}
                            showLineNumbers={showLineNumbers}
                        >
                            {createElement({
                                node,
                                stylesheet,
                                useInlineStyles,
                                key: `code-segment${i}`,
                            })}
                        </Line>
                    </span>
                )
            }
        })
    }

    return (
        <div
            onMouseEnter={onEnter}
            onMouseLeave={onExit}
            className="relative my-6 overflow-hidden rounded-lg border border-border"
            ref={textInput}
        >
            {loading ? (
                // Loading circle using Tailwind
                <div className="flex h-40 items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-border"></div>
                </div>
            ) : (
                <>
                    {fileName || title ? (
                        <div className="align-center flex gap-3 px-3 py-1">
                            <div className="hidden items-center gap-2 rounded-md bg-secondary px-2 py-1 text-[13px] md:flex">
                                {getLanguageIcon(language)}
                                {fileName && <span className="font-bold">{fileName}</span>}
                            </div>
                            {title && (
                                <span className="flex items-center text-muted-foreground">
                                    {title}
                                </span>
                            )}
                        </div>
                    ) : null}
                    {rawHTML ? (
                        <pre style={preStyles}>
                            <code>
                                <div
                                    className="line"
                                    dangerouslySetInnerHTML={{ __html: code }}
                                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                />
                            </code>
                        </pre>
                    ) : (
                        <SyntaxHighlighter
                            language={language}
                            useInlineStyles={false}
                            wrapLines
                            customStyle={preStyles}
                            codeTagProps={codeStyles}
                            wrapLongLines={wrapLongLines}
                            renderer={lineRenderer}
                        >
                            {code}
                        </SyntaxHighlighter>
                    )}
                    {!terminal && <CopyButton onClick={onCopy} copied={copied} hovered={hovered} />}
                </>
            )}
        </div>
    )
}

const fetchData = async (src: string): Promise<string> => {
    try {
        const response = await fetch(`/static/code/${src}.txt`)
        const text = await response.text()
        return text
    } catch (error) {
        console.error(error)
        throw error
    }
}

const useFetchData = (src?: string) => {
    const [code, setCode] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false) // Add a loading state

    useEffect(() => {
        if (src) {
            setLoading(true) // Set loading to true before fetching
            fetchData(src)
                .then(setCode)
                .finally(() => setLoading(false)) // Set loading to false after fetching
        }
    }, [src])

    return { code, loading } // Return the loading state along with the code
}

const useHover = (): [
    boolean,
    React.MouseEventHandler<HTMLDivElement>,
    React.MouseEventHandler<HTMLDivElement>,
] => {
    const [hovered, setHovered] = useState(false)
    const onEnter: React.MouseEventHandler<HTMLDivElement> = () => setHovered(true)
    const onExit: React.MouseEventHandler<HTMLDivElement> = () => setHovered(false)
    return [hovered, onEnter, onExit]
}

const useCopy = (code) => {
    const [copied, setCopied] = useState(false)
    const onCopy = () => {
        setCopied(true)
        navigator.clipboard.writeText(code)
        setTimeout(() => {
            setCopied(false)
        }, 2000)
    }
    return [copied, onCopy]
}

export default CodeBlock
