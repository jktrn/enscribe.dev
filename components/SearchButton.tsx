'use client'

import siteMetadata from '@/data/siteMetadata'
import { useKBar } from 'kbar'
import { Search } from 'lucide-react'

import { Button } from './shadcn/button'

const SearchButton = () => {
    const { query } = useKBar()

    if (
        siteMetadata.search &&
        (siteMetadata.search.provider === 'algolia' || siteMetadata.search.provider === 'kbar')
    ) {
        return (
            <Button
                aria-label="Search"
                variant="ghost"
                className="px-2"
                title="Search"
                onClick={() => query.toggle()}
            >
                <Search />
            </Button>
        )
    }
}

export default SearchButton
