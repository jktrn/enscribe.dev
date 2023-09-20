import { Twitter } from 'lucide-react'
import React from 'react'
import ReactMarkdown from 'react-markdown'

import Image from './Image'

const StaticTweet = ({ avatar, username, handle, date, text, src, media, video }) => {
    return (
        <div className="relative flex flex-col justify-center">
            <div className="mx-auto my-4 rounded-xl border border-border p-4 duration-300">
                <div className="flex justify-between space-x-4">
                    <span className="group flex items-center gap-3">
                        <Image
                            className="!m-0 rounded-full"
                            skeletonClassName="rounded-full"
                            src={avatar}
                            alt={`${username}'s avatar`}
                            width={48}
                            height={48}
                        />
                        <div className="flex flex-col leading-snug">
                            <span className="flex gap-2 font-bold">
                                {username}
                                <span className="font-normal opacity-70">@{handle}</span>
                            </span>
                            <span className="opacity-80">{date}</span>
                        </div>
                    </span>
                    <a href={src}>
                        <Twitter />
                    </a>
                </div>
                <div className="mt-3 leading-normal">
                    <ReactMarkdown components={{ p: React.Fragment }}>{text}</ReactMarkdown>
                </div>
                <div className="flex items-center justify-center">
                    {media && (
                        <Image
                            src={media}
                            alt="Tweet Media"
                            width={500}
                            height={400}
                            className="!mb-0 rounded-md"
                        />
                    )}
                </div>
                {video && (
                    <video controls width="100%" className="!mb-0 rounded-md">
                        <source src={video} type="video/mp4" />
                        <track kind="captions" />
                        Sorry, your browser doesn't support embedded videos.
                    </video>
                )}
            </div>
        </div>
    )
}

export default StaticTweet
