import { Inter } from 'next/font/google'
import { ReactNode } from 'react'

import Footer from './Footer'
import Header from './Header'
import SectionContainer from './SectionContainer'

interface Props {
    children: ReactNode
}

const inter = Inter({
    subsets: ['latin'],
})

const LayoutWrapper = ({ children }: Props) => {
    return (
        <SectionContainer>
            <div className={`${inter.className} flex h-full flex-col justify-between font-sans`}>
                <Header />
                <main className="mb-auto">{children}</main>
                <Footer />
            </div>
        </SectionContainer>
    )
}

export default LayoutWrapper
