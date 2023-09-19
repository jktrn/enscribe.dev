'use client'

import { MoveUpRight } from 'lucide-react'
import Image from 'next/image'
import React, { useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { useLanyard } from 'react-use-lanyard'
import IconBox from './IconBox'
import SpotifyPresence from './SpotifyPresence'
import { FaGithub, FaTwitter } from 'react-icons/fa'

const ResponsiveGridLayout = WidthProvider(Responsive, { measureBeforeMount: true })

const BentoBox = ({ posts }) => {
    const mainLayout = [
        { i: 'a', x: 0, y: 0, w: 2, h: 1 },
        { i: 'b', x: 2, y: 0, w: 1, h: 1 },
        { i: 'c', x: 4, y: 0, w: 1, h: 2 },
        { i: 'd', x: 0, y: 1, w: 1, h: 1 },
        { i: 'e', x: 1, y: 1, w: 2, h: 1 },
        { i: 'f', x: 0, y: 3, w: 1, h: 2 },
        { i: 'g', x: 1, y: 3, w: 1, h: 1 },
        { i: 'h', x: 2, y: 3, w: 1, h: 1 },
        { i: 'i', x: 3, y: 3, w: 1, h: 1 },
        { i: 'j', x: 1, y: 4, w: 1, h: 1 },
        { i: 'k', x: 2, y: 4, w: 2, h: 1 },
    ]

    const mobileLayout = [
        { i: 'a', x: 0, y: 0, w: 2, h: 1 },
        { i: 'e', x: 0, y: 1, w: 2, h: 1 },
        { i: 'f', x: 0, y: 2, w: 1, h: 2 },
        { i: 'b', x: 1, y: 2, w: 1, h: 1 },
        { i: 'd', x: 0, y: 4, w: 1, h: 1 },
        { i: 'c', x: 1, y: 3, w: 1, h: 2 },
        { i: 'g', x: 0, y: 5, w: 1, h: 1 },
        { i: 'h', x: 1, y: 5, w: 1, h: 1 },
        { i: 'i', x: 0, y: 6, w: 1, h: 1 },
        { i: 'j', x: 1, y: 6, w: 1, h: 1 },
        { i: 'k', x: 0, y: 7, w: 2, h: 1 },
    ]

    const [rowHeight, setRowHeight] = useState(280)
    const [introSilhouette, setIntroSilhouette] = useState(false)

    const handleWidthChange = (width) => {
        if (width <= 500) {
            setRowHeight(158)
        } else if (width <= 1100) {
            setRowHeight(180)
        } else {
            setRowHeight(280)
        }
    }

    const lanyard = useLanyard({
        userId: '747519888347627550',
    })

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
                <div key="b">
                    <IconBox icon={FaGithub} href="https://github.com/jktrn" />
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
                    className="group flex items-start"
                    onMouseEnter={() => setIntroSilhouette(true)}
                    onMouseLeave={() => setIntroSilhouette(false)}
                >
                    <Image
                        src={posts[0].images[0]}
                        alt={posts[0].title}
                        width={0}
                        height={0}
                        className="m-2 w-[80%] rounded-2xl border border-border md:m-3 lg:m-4"
                        unoptimized
                    />
                    <Image
                        src="/static/images/bento/bento-latest-post-silhouette.svg"
                        alt="Bento Latest Post Silhouette"
                        fill={true}
                        className="rounded-3xl object-cover transition-opacity duration-300 group-hover:opacity-0 group-hover:delay-75"
                        unoptimized
                    />
                    <Image
                        src="/static/images/bento/bento-latest-post.svg"
                        alt="Bento Latest Post Silhouette"
                        fill={true}
                        className="rounded-3xl object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:delay-75"
                        unoptimized
                    />
                    <a href={posts[0].path} className="block">
                        <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-tertiary/50 p-3 text-primary transition-all duration-300 hover:brightness-125">
                            <MoveUpRight size={16} />
                        </div>
                    </a>
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
                <div key="h">
                    <IconBox icon={FaTwitter} href="https://x.com/enscry" />
                </div>
                <div key="i">
                    {!lanyard.isValidating && <SpotifyPresence lanyard={lanyard.data} />}
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
