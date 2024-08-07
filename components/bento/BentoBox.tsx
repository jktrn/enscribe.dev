'use client'

import React from 'react'
import { FaGithub, FaTwitter } from 'react-icons/fa'
import { useLanyard } from 'react-use-lanyard'

import Image from '../Image'
import DiscordPresence from './DiscordPresence'
import ExternalLink from './ExternalLink'
import GithubCalendar from './GithubCalendar'
import SpotifyPresence from './SpotifyPresence'
import { Skeleton } from '../shadcn/skeleton'
import WakatimeGraph from './WakatimeGraph'

const BentoBox = ({ posts }) => {
    const lanyard = useLanyard({
        userId: '747519888347627550',
    })

    return (
        <div className="ml-[calc(-50vw+50%+10px)] w-[calc(100vw-20px)] p-4">
            <section
                className="bento grid-mobile-layout sm:grid-sm-layout xl:grid-xl-layout mx-auto grid max-w-[375px] grid-cols-2 gap-4 *:rounded-3xl *:border *:border-muted *:bg-secondary *:bg-cover *:bg-center *:bg-no-repeat sm:max-w-screen-sm xl:max-w-screen-xl xl:grid-cols-4"
                aria-label="Personal information and activity grid"
            >
                <div
                    className="first grid-item-a aspect-square rounded-3xl border bg-cover bg-center bg-no-repeat sm:aspect-[2.1/1] xl:aspect-auto"
                    role="img"
                    aria-label="Introduction"
                    rel="preload"
                >
                    <div className="overlay grid-item-a-silhouette size-full rounded-3xl bg-cover bg-center bg-no-repeat opacity-0 transition-opacity duration-200" />
                    <p className="sr-only">
                        Hey, I'm Jason! I'm a freelance frontend web developer and cybersecurity CTF
                        player from Los Angeles, and I go by aliases enscribe and jktrn online. I'm
                        currently interested in open-source intelligence, fundamental UI/UX design,
                        data science and rhythm games!
                    </p>
                </div>

                <div
                    className="grid-item-b has-overlay aspect-square"
                    role="img"
                    aria-label="CTF Information"
                >
                    <div className="overlay grid-item-b-overlay size-full rounded-3xl bg-cover bg-center bg-no-repeat transition-opacity duration-200 xl:opacity-0" />
                    <p className="sr-only">
                        I currently play cybersecurity capture-the-flags with Project Sekai. Hosted
                        on this blog are in-depth, beginner-friendly writeups for CTF challenges!
                    </p>
                </div>

                <div className="grid-item-c aspect-[1/2.1] xl:aspect-auto" aria-hidden="true" />

                <div className="grid-item-d sm:aspect-square">
                    {lanyard.data && !lanyard.isValidating ? (
                        <DiscordPresence lanyard={lanyard.data} />
                    ) : (
                        <Skeleton className="h-full w-full rounded-3xl" />
                    )}
                </div>

                <div className="grid-item-e has-overlay relative flex aspect-[6/5] items-start overflow-hidden p-4 hover:bg-none sm:aspect-[2.1/1] sm:items-center xl:aspect-auto">
                    <div className="overlay grid-item-e-overlay absolute inset-0 size-full rounded-3xl bg-cover bg-center bg-no-repeat transition-opacity duration-200 xl:opacity-0" />
                    <Image
                        src={posts[0].images[0]}
                        alt={`Featured image for the latest post: ${posts[0].title}`}
                        width={477}
                        height={251}
                        className="w-full rounded-2xl border border-border sm:ml-2 sm:w-[80%]"
                    />
                    <ExternalLink
                        href={posts[0].path}
                        newTab={false}
                        aria-label={`Read the latest post: ${posts[0].title}`}
                        title="Read the latest post"
                    />
                </div>

                <div className="grid-item-f has-overlay relative flex aspect-square items-center justify-center overflow-hidden hover:bg-none sm:aspect-[2.1/1] xl:aspect-auto">
                    <div className="overlay grid-item-f-overlay absolute inset-0 z-[1] size-full rounded-3xl bg-cover bg-center bg-no-repeat transition-opacity duration-200 xl:opacity-0" />
                    <GithubCalendar username="jktrn" hideColorLegend hideTotalCount />
                </div>

                <div className="grid-item-g has-overlay relative aspect-square hover:bg-none">
                    <div className="overlay grid-item-g-overlay absolute inset-0 z-0 size-full rounded-3xl bg-cover bg-center bg-no-repeat transition-opacity duration-200 xl:opacity-0" />
                    {lanyard.data && !lanyard.isValidating ? (
                        <SpotifyPresence lanyard={lanyard.data} />
                    ) : (
                        <Skeleton className="h-full w-full rounded-3xl" />
                    )}
                </div>

                <div className="grid-item-h aspect-[1/2.1] xl:aspect-auto" aria-hidden="true" />

                <div className="grid-item-i has-overlay relative flex aspect-square items-center justify-center hover:bg-none">
                    <div className="overlay grid-item-i-overlay absolute inset-0 size-full rounded-3xl bg-cover bg-center bg-no-repeat transition-opacity duration-200 xl:opacity-0" />
                    <FaGithub
                        className="absolute z-[1] size-1/2 text-primary sm:size-24"
                        aria-hidden="true"
                    />
                    <ExternalLink
                        href="https://github.com/jktrn"
                        aria-label="Visit enscribe's GitHub profile"
                        title="GitHub Profile"
                    />
                </div>

                <div className="grid-item-j relative aspect-square">
                    <WakatimeGraph username="jktrn" />
                    <ExternalLink
                        href="https://wakatime.com/@jktrn"
                        aria-label="View enscribe's Wakatime profile"
                        title="Wakatime Profile"
                    />
                </div>

                <div className="grid-item-k has-overlay relative flex aspect-square items-center justify-center hover:bg-none">
                    <div className="overlay grid-item-k-overlay absolute inset-0 size-full rounded-3xl bg-cover bg-center bg-no-repeat transition-opacity duration-200 xl:opacity-0" />
                    <FaTwitter
                        className="absolute z-[1] size-1/2 text-primary sm:size-24"
                        aria-hidden="true"
                    />
                    <ExternalLink
                        href="https://twitter.com/enscry"
                        aria-label="Visit enscribe's Twitter profile"
                        title="Twitter Profile"
                    />
                </div>
            </section>
        </div>
    )
}

export default BentoBox
