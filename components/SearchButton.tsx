import siteMetadata from '@/data/siteMetadata'
import { Command, Search } from 'lucide-react'
import { AlgoliaButton } from 'pliny/search/AlgoliaButton'
import { KBarButton } from 'pliny/search/KBarButton'

const SearchButton = () => {
    if (
        siteMetadata.search &&
        (siteMetadata.search.provider === 'algolia' || siteMetadata.search.provider === 'kbar')
    ) {
        const SearchButtonWrapper =
            siteMetadata.search.provider === 'algolia' ? AlgoliaButton : KBarButton

        return (
            <>
                <SearchButtonWrapper aria-label="Search">
                    <Search />
                </SearchButtonWrapper>
                <span className="hidden md:flex gap-1 text-xs text-muted-foreground">
                    <kbd className="flex items-center justify-center !w-6 !h-6 border border-border rounded-md">
                        <Command size={12} />
                    </kbd>
                    <kbd className="flex items-center justify-center !w-6 !h-6 p-1 border border-border rounded-md">
                        K
                    </kbd>
                </span>
            </>
        )
    }
}

export default SearchButton
