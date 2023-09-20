'use client'

import { mainLayout, mobileLayout } from '@/scripts/utils/bento-layouts'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { FaGithub, FaTwitter } from 'react-icons/fa'
import { useLanyard } from 'react-use-lanyard'

import ExternalLink from './ExternalLink'
import SilhouetteHover from './SilhouetteHover'
import SpotifyPresence from './SpotifyPresence'

const ResponsiveGridLayout = WidthProvider(Responsive, { measureBeforeMount: true })

const BentoBox = ({ posts }) => {
    const lanyard = useLanyard({
        userId: '747519888347627550',
    })

    const [rowHeight, setRowHeight] = useState(280)
    const [introSilhouette, setIntroSilhouette] = useState(false)

    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleWidthChange = (width) => {
        if (width <= 500) {
            setRowHeight(158)
        } else if (width <= 1100) {
            setRowHeight(180)
        } else {
            setRowHeight(280)
        }
    }

    const handleDragStart = (element) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        document.querySelectorAll('.react-grid-item').forEach((item) => {
            ;(item as HTMLElement).style.zIndex = '1'
        })

        element.style.zIndex = '10'
    }

    const handleDragStop = (element) => {
        timeoutRef.current = setTimeout(() => {
            element.style.zIndex = '1'
        }, 500)
    }

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    return (
        <div className="react-grid-container">
            <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: mainLayout, md: mainLayout, sm: mobileLayout }}
                // I don't know why but if I don't subtract 1 everything shits itself
                breakpoints={{ lg: 1199, md: 799, sm: 374 }}
                cols={{ lg: 4, md: 4, sm: 2 }}
                rowHeight={rowHeight}
                isResizable={false}
                onWidthChange={handleWidthChange}
                isBounded={true}
                margin={[16, 16]}
                useCSSTransforms={false}
                onDragStart={(layout, oldItem, newItem, placeholder, e, element) =>
                    handleDragStart(element)
                }
                onDragStop={(layout, oldItem, newItem, placeholder, e, element) =>
                    handleDragStop(element)
                }
            >
                <div key="a">
                    <Image
                        src="/static/images/bento/bento-intro-silhouette.svg"
                        alt="Bento Intro Silhouette"
                        fill={true}
                        className={`rounded-3xl object-cover transition-opacity duration-300 ${
                            introSilhouette ? 'opacity-100' : 'opacity-0 delay-75'
                        }`}
                        unoptimized
                    />
                    <Image
                        src="/static/images/bento/bento-intro.svg"
                        alt="Bento Intro"
                        fill={true}
                        className={`rounded-3xl object-cover transition-opacity duration-300 ${
                            introSilhouette ? 'opacity-0 delay-75' : 'opacity-100'
                        }`}
                        unoptimized
                    />
                </div>
                <div
                    key="b"
                    className="group"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <div className="relative flex h-full w-full items-center justify-center rounded-lg">
                        <FaGithub size={96} className="absolute z-[1] text-primary" />
                        <SilhouetteHover
                            silhouetteSrc="/static/images/bento/bento-github-silhouette.svg"
                            silhouetteAlt="Bento Github Silhouette"
                            mainSrc="/static/images/bento/bento-github.svg"
                            mainAlt="Bento Github"
                            className="rounded-3xl object-cover"
                        />
                        <ExternalLink href="https://github.com/jktrn" />
                    </div>
                </div>
                <div key="c">
                    <Image
                        src="/static/images/bento/bento-image-1.svg"
                        alt="Bento Box 1"
                        fill={true}
                        className="rounded-3xl object-cover"
                        unoptimized
                    />
                </div>
                <div key="d">Child D</div>
                <div
                    key="e"
                    className="group"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <SilhouetteHover
                        silhouetteSrc="/static/images/bento/bento-latest-post-silhouette.svg"
                        silhouetteAlt="Bento Latest Post Silhouette"
                        mainSrc="/static/images/bento/bento-latest-post.svg"
                        mainAlt="Bento Latest Post"
                        className="rounded-3xl object-cover"
                    >
                        <Image
                            src={posts[0].images[0]}
                            alt={posts[0].title}
                            width={0}
                            height={0}
                            className="m-2 w-[80%] rounded-2xl border border-border md:m-3 lg:m-4"
                            unoptimized
                        />
                    </SilhouetteHover>
                    <ExternalLink href={posts[0].path} />
                </div>
                <div key="f">
                    <Image
                        src="/static/images/bento/bento-image-2.svg"
                        alt="Bento Box 2"
                        fill={true}
                        className="rounded-3xl object-cover"
                        unoptimized
                    />
                </div>
                <div key="g">Child G</div>
                <div
                    key="h"
                    className="group"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <div className="relative flex h-full w-full items-center justify-center rounded-lg">
                        <FaTwitter size={96} className="absolute z-[1] text-primary" />
                        <SilhouetteHover
                            silhouetteSrc="/static/images/bento/bento-twitter-silhouette.svg"
                            silhouetteAlt="Bento Twitter Silhouette"
                            mainSrc="/static/images/bento/bento-twitter.svg"
                            mainAlt="Bento Twitter"
                            className="rounded-3xl object-cover"
                        />
                        <ExternalLink href="https://twitter.com/jktrn" />
                    </div>
                </div>
                <div
                    key="i"
                    className="group"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    {!lanyard.isValidating && <SpotifyPresence lanyard={lanyard.data} />}
                    <SilhouetteHover
                        silhouetteSrc="/static/images/bento/bento-spotify-silhouette.svg"
                        silhouetteAlt="Bento Spotify Silhouette"
                        mainSrc="/static/images/bento/bento-spotify.svg"
                        mainAlt="Bento Spotify"
                        className="rounded-3xl object-cover"
                    />
                </div>
                <div key="j">
                    <Image
                        src="/static/images/bento/bento-technologies.svg"
                        alt="Bento Technologies"
                        fill={true}
                        className="rounded-3xl object-cover"
                        unoptimized
                    />
                </div>
                <div key="k">Child K</div>
            </ResponsiveGridLayout>
        </div>
    )
}

export default BentoBox
