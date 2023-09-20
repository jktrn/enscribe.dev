import siteMetadata from '@/data/siteMetadata'
import { Search } from 'lucide-react'
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
            <SearchButtonWrapper aria-label="Search">
                <Search />
            </SearchButtonWrapper>
        )
    }
}

export default SearchButton
