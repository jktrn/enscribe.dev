'use client'

import { lgLayout, mdLayout, smLayout } from '@/scripts/utils/bento-layouts'
import React, { useEffect, useState } from 'react'
import GitHubCalendar from 'react-github-calendar'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { FaGithub, FaTwitter } from 'react-icons/fa'
import { useLanyard } from 'react-use-lanyard'

import Image from '../Image'
import { Skeleton } from '../shadcn/skeleton'
import DiscordPresence from './DiscordPresence'
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

    const [isDiscordLoaded, setDiscordLoaded] = useState(false)
    const [isSpotifyLoaded, setIsSpotifyLoaded] = useState(false)

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

    const DAYS_TO_SHOW = 133

    const selectLastNDays = (contributions) => {
        const today = new Date()
        const startDate = new Date(today)
        startDate.setDate(today.getDate() - DAYS_TO_SHOW)

        return contributions.filter((activity) => {
            const activityDate = new Date(activity.date)
            return activityDate >= startDate && activityDate <= today
        })
    }

    return (
        <div className="react-grid-container">
            <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: lgLayout, md: mdLayout, sm: smLayout }}
                // I don't know why but if I don't subtract 1 everything shits itself
                breakpoints={{ lg: 1199, md: 799, sm: 374 }}
                cols={{ lg: 4, md: 4, sm: 2 }}
                rowHeight={rowHeight}
                isResizable={false}
                onWidthChange={handleWidthChange}
                isBounded
                margin={[16, 16]}
                useCSSTransforms={false}
                onDragStart={(layout, oldItem, newItem, placeholder, e, element) =>
                    handleDragStart(element)
                }
                onDragStop={(layout, oldItem, newItem, placeholder, e, element) =>
                    handleDragStop(element)
                }
            >
                <div key="intro">
                    <Image
                        src="/static/images/bento/bento-intro-silhouette.svg"
                        alt="Bento Intro Silhouette"
                        fill
                        className={`rounded-3xl object-cover transition-opacity duration-300 ${
                            introSilhouette ? 'opacity-100' : 'opacity-0 delay-75'
                        }`}
                        skeletonClassName="rounded-3xl"
                        noRelative
                        unoptimized
                        priority
                    />
                    <Image
                        src="/static/images/bento/bento-intro.svg"
                        alt="Bento Intro"
                        fill
                        className={`rounded-3xl object-cover transition-opacity duration-300 ${
                            introSilhouette ? 'opacity-0 delay-75' : 'opacity-100'
                        }`}
                        skeletonClassName="rounded-3xl"
                        noRelative
                        unoptimized
                        priority
                    />
                </div>
                <div
                    key="github"
                    className="group"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <div className="relative flex h-full w-full items-center justify-center rounded-lg">
                        <FaGithub className="absolute z-[1] text-primary w-20 h-20 bento-md:w-24 bento-md:h-24" />
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
                <div key="image-1">
                    <Image
                        src="/static/images/bento/bento-image-1.svg"
                        alt="Bento Box 1"
                        fill
                        noRelative
                        className="rounded-3xl object-cover"
                        skeletonClassName="rounded-3xl"
                        unoptimized
                        priority
                    />
                </div>
                <div key="discord">
                    {lanyard.data && !lanyard.isValidating ? (
                        <DiscordPresence
                            lanyard={lanyard.data}
                            onLoad={() => setDiscordLoaded(true)}
                        />
                    ) : (
                        <Skeleton className="w-full h-full rounded-3xl" />
                    )}
                </div>
                <div
                    key="latest-post"
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
                            skeletonClassName="rounded-3xl"
                            noRelative
                            unoptimized
                        />
                    </SilhouetteHover>
                    <ExternalLink href={posts[0].path} newTab={false} />
                </div>
                <div key="image-2">
                    <Image
                        src="/static/images/bento/bento-image-2.svg"
                        alt="Bento Box 2"
                        fill
                        className="rounded-3xl object-cover"
                        skeletonClassName="rounded-3xl"
                        noRelative
                        unoptimized
                        priority
                    />
                </div>
                <div
                    key="about-ctfs"
                    className="group bg-[url('/static/images/bento/bento-about-ctfs-bg.svg')] bg-cover bg-center"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <SilhouetteHover
                        silhouetteSrc="/static/images/bento/bento-about-ctfs-silhouette.svg"
                        silhouetteAlt="Bento About CTFs Silhouette"
                        mainSrc="/static/images/bento/bento-about-ctfs.svg"
                        mainAlt="Bento About CTFs"
                        className="rounded-3xl object-cover"
                    />
                </div>
                <div
                    key="twitter"
                    className="group"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <div className="relative flex h-full w-full items-center justify-center rounded-lg">
                        <FaTwitter className="absolute z-[1] text-primary w-20 h-20 bento-md:w-24 bento-md:h-24" />
                        <SilhouetteHover
                            silhouetteSrc="/static/images/bento/bento-twitter-silhouette.svg"
                            silhouetteAlt="Bento Twitter Silhouette"
                            mainSrc="/static/images/bento/bento-twitter.svg"
                            mainAlt="Bento Twitter"
                            className="rounded-3xl object-cover"
                        />
                        <ExternalLink href="https://twitter.com/enscry" />
                    </div>
                </div>
                <div
                    key="spotify"
                    className="group"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    {lanyard.data && !lanyard.isValidating ? (
                        <SpotifyPresence
                            lanyard={lanyard.data}
                            onLoad={() => setIsSpotifyLoaded(true)}
                        />
                    ) : (
                        <Skeleton className="w-full h-full rounded-3xl z-[1]" />
                    )}
                    <SilhouetteHover
                        silhouetteSrc="/static/images/bento/bento-spotify-silhouette.svg"
                        silhouetteAlt="Bento Spotify Silhouette"
                        mainSrc="/static/images/bento/bento-spotify.svg"
                        mainAlt="Bento Spotify"
                        className="hidden bento-lg:block object-cover rounded-3xl ml-auto"
                    />
                    <SilhouetteHover
                        silhouetteSrc="/static/images/bento/bento-spotify-silhouette-2x1.svg"
                        silhouetteAlt="Bento Spotify Silhouette"
                        mainSrc="/static/images/bento/bento-spotify-2x1.svg"
                        mainAlt="Bento Spotify"
                        className="block bento-lg:hidden object-cover rounded-3xl ml-auto"
                    />
                </div>
                <div key="tech">
                    <Image
                        src="/static/images/bento/bento-technologies.svg"
                        alt="Bento Technologies"
                        fill
                        className="rounded-3xl object-cover"
                        skeletonClassName="rounded-3xl"
                        noRelative
                        unoptimized
                    />
                </div>
                <div
                    key="contributions"
                    className="group flex items-center justify-center"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <SilhouetteHover
                        silhouetteSrc="/static/images/bento/bento-contributions-silhouette.svg"
                        silhouetteAlt="Bento GitHub Contributions Silhouette"
                        mainSrc="/static/images/bento/bento-contributions.svg"
                        mainAlt="Bento GitHub Contributions"
                        className="rounded-3xl object-cover z-[2]"
                    />
                    {/* i'm too lazy to make an onLoad for this */}
                    <div className={isSpotifyLoaded ? 'visible' : 'invisible'}>
                        <GitHubCalendar
                            username="jktrn"
                            transformData={selectLastNDays}
                            theme={{
                                dark: ['#1A1A1A', '#E9D3B6'],
                            }}
                            hideColorLegend
                            hideTotalCount
                            blockMargin={6}
                            blockSize={20}
                            blockRadius={7}
                            style={{
                                margin: '1rem',
                                zIndex: 1,
                            }}
                        />
                    </div>
                </div>
            </ResponsiveGridLayout>
        </div>
    )
}

export default BentoBox
