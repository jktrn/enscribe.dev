import { AlgoliaButton } from 'pliny/search/AlgoliaButton'
import { KBarButton } from 'pliny/search/KBarButton'
import siteMetadata from '@/data/siteMetadata'
import { Search } from 'lucide-react'

const SearchButton = () => {
    if (
        siteMetadata.search &&
        (siteMetadata.search.provider === 'algolia' || siteMetadata.search.provider === 'kbar')
    ) {
        const SearchButtonWrapper =
            siteMetadata.search.provider === 'algolia' ? AlgoliaButton : KBarButton

        return (
            <SearchButtonWrapper className="py-2 px-3" aria-label="Search">
                <Search />
            </SearchButtonWrapper>
        )
    }
}

export default SearchButton
