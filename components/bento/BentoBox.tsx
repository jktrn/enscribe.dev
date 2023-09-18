'use client'

import React, { useState } from 'react'
import { Github, Twitter } from 'lucide-react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import Image from 'next/image'
import IconBox from './IconBox'

const ResponsiveGridLayout = WidthProvider(Responsive)

const BentoBox = () => {
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

    const handleWidthChange = (width) => {
        if (width <= 500) {
            setRowHeight(158)
        } else if (width <= 1100) {
            setRowHeight(180)
        } else {
            setRowHeight(280)
        }
    }

    return (
        <div className="react-grid-container">
            <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: mainLayout, md: mainLayout, sm: mobileLayout }}
                breakpoints={{ lg: 1199, md: 799, sm: 374 }}
                cols={{ lg: 4, md: 4, sm: 2 }}
                rowHeight={rowHeight}
                isResizable={false}
                onWidthChange={handleWidthChange}
                isBounded={true}
                margin={[16, 16]}
                useCSSTransforms={true}
            >
                <div key="a">
                    <Image
                        src="/static/images/bento-intro.svg"
                        alt="Bento Intro"
                        fill={true}
                        className="rounded-3xl object-cover"
                        unoptimized
                    />
                </div>
                <div key="b">
                    <IconBox icon={Github} name="Github" href="https://github.com/jktrn" />
                </div>
                <div key="c">
                    <Image
                        src="/static/images/bento-image-1.svg"
                        alt="Bento Box 1"
                        fill={true}
                        className="rounded-3xl object-cover"
                        unoptimized
                    />
                </div>
                <div key="d">Child D</div>
                <div key="e">Child E</div>
                <div key="f">
                    <Image
                        src="/static/images/bento-image-2.svg"
                        alt="Bento Box 2"
                        fill={true}
                        className="rounded-3xl object-cover"
                        unoptimized
                    />
                </div>
                <div key="g">Child G</div>
                <div key="h">
                    <IconBox icon={Twitter} name="X/Twitter" href="https://x.com/enscry" />
                </div>
                <div key="i">Child I</div>
                <div key="j">
                    <Image
                        src="/static/images/bento-technologies.svg"
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
