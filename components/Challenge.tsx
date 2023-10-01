'use client'

import { Check, File, PenTool, Star, Tag, User, Users } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

import Image from './Image'
import Link from './Link'

interface TitleProps {
    level: number
    className?: string
    children: React.ReactNode
}

const Title = ({ level, className, children }: TitleProps) => {
    const Tag = `h${level}` as keyof JSX.IntrinsicElements

    return <Tag className={className}>{children}</Tag>
}

const Challenge = ({
    title,
    level = 2,
    authors,
    solvers,
    description,
    points,
    category,
    solves,
    files,
}) => {
    const [userAvatars, setUserAvatars] = useState({})
    const usernameMapping = {
        jktrn: 'enscribe',
    }

    useEffect(() => {
        const fetchUserAvatars = async () => {
            let usernames
            if (Array.isArray(solvers)) {
                usernames = Array.from(new Set([...solvers]))
            } else {
                usernames = [solvers]
            }

            try {
                const avatarResponses = await Promise.all(
                    usernames.map((username) => fetch(`https://api.github.com/users/${username}`))
                )
                const avatarData = await Promise.all(
                    avatarResponses.map((response) => response.json())
                )
                const avatars = avatarData.reduce((accumulator, current) => {
                    accumulator[current.login] = current.avatar_url
                    return accumulator
                }, {})
                setUserAvatars(avatars)
            } catch (error) {
                console.log(error)
            }
        }

        fetchUserAvatars()
    }, [authors, solvers])

    return (
        <div className="my-6 overflow-hidden rounded-lg border border-border">
            <div className="px-6 py-3">
                <Title level={level} className="!m-0 text-xl">
                    {title}
                </Title>
            </div>
            <div className="flex">
                <div className="flex flex-col justify-center gap-1 bg-secondary px-6 py-4 text-xs">
                    {solvers && Array.isArray(solvers) ? (
                        <>
                            <span className="flex items-center space-x-2">
                                <Users size={14} strokeWidth={3} /> <b>solvers</b>:
                            </span>
                            {solvers.map((solver, index) => (
                                <span key={index} className="flex items-center space-x-2">
                                    -&nbsp;
                                    {userAvatars[solver] ? (
                                        <Image
                                            src={userAvatars[solver]}
                                            alt={`${solver}'s avatar`}
                                            className="!m-0 inline-block h-4 w-4 rounded-full align-middle"
                                            skeletonClassName="rounded-full"
                                            width={16}
                                            height={16}
                                        />
                                    ) : (
                                        <User size={16} strokeWidth={3} />
                                    )}
                                    {userAvatars[solver] ? (
                                        <Link href={`https://github.com/${solver}`}>
                                            {usernameMapping[solver] || solver}
                                        </Link>
                                    ) : (
                                        <span>{usernameMapping[solver] || solver}</span>
                                    )}
                                    {index !== solvers.length - 1 && <br />}
                                </span>
                            ))}
                        </>
                    ) : (
                        <span className="flex items-center">
                            <span className="flex items-center space-x-2">
                                <User size={14} strokeWidth={3} /> <b>solver</b>
                                :&nbsp;
                            </span>
                            <span className="flex items-center space-x-1">
                                {userAvatars[solvers] ? (
                                    <Image
                                        src={userAvatars[solvers]}
                                        alt={`${solvers}'s avatar`}
                                        className="!m-0 inline-block h-4 w-4 rounded-full align-middle"
                                        skeletonClassName="rounded-full"
                                        width={16}
                                        height={16}
                                    />
                                ) : (
                                    <User size={16} strokeWidth={3} />
                                )}
                                {userAvatars[solvers] ? (
                                    <Link href={`https://github.com/${solvers}`}>
                                        {usernameMapping[solvers] || solvers}
                                    </Link>
                                ) : (
                                    <span>{usernameMapping[solvers] || solvers}</span>
                                )}
                                <br />
                            </span>
                        </span>
                    )}
                    {authors && Array.isArray(authors) ? (
                        <>
                            <span className="flex items-center space-x-2">
                                <PenTool size={14} strokeWidth={3} /> <b>authors</b>:
                            </span>
                            {authors.map((author, index) => (
                                <span key={index}>
                                    - {author}
                                    {index !== authors.length - 1 && <br />}
                                </span>
                            ))}
                        </>
                    ) : (
                        authors && (
                            <span className="flex items-center space-x-2">
                                <PenTool size={14} strokeWidth={3} /> <b>author</b>: {authors}
                                <br />
                            </span>
                        )
                    )}
                    {points && (
                        <span className="flex items-center space-x-2">
                            <Star size={14} strokeWidth={3} /> <b>points</b>: {points}
                            <br />
                        </span>
                    )}
                    {category && (
                        <span className="flex items-center space-x-2">
                            <Tag size={14} strokeWidth={3} /> <b>category</b>: {category}
                            <br />
                        </span>
                    )}
                    {solves && (
                        <span className="flex items-center space-x-2">
                            <Check size={14} strokeWidth={3} /> <b>solves</b>: {solves}
                            <br />
                        </span>
                    )}
                    {files && (
                        <span className="flex items-center space-x-2">
                            <File size={14} strokeWidth={3} /> <b>files</b>:{' '}
                            <ReactMarkdown components={{ p: React.Fragment }}>
                                {files}
                            </ReactMarkdown>
                            <br />
                        </span>
                    )}
                </div>
                <div className="flex flex-1 items-center justify-center bg-tertiary/50 p-4 text-center">
                    <span className="text-[13px]">
                        <ReactMarkdown
                            components={{ p: React.Fragment }}
                            // @ts-ignore
                            rehypePlugins={[rehypeRaw]}
                        >
                            {description}
                        </ReactMarkdown>
                    </span>
                </div>
            </div>
        </div>
    )
}

export default Challenge
