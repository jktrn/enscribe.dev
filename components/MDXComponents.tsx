import TOCInline from '@/components/TOCInline'
import type { MDXComponents } from 'mdx/types'
import Pre from 'pliny/ui/Pre'

import Box from './Box'
import Challenge from './Challenge'
import CodeBlock from './CodeBlock'
import CountryFlag from './CountryFlag'
import Image from './Image'
import CustomLink from './Link'
import StaticTweet from './StaticTweet'
import YouTube from './YouTube'

export const components: MDXComponents = {
    Image,
    TOCInline,
    a: CustomLink,
    pre: Pre,
    CodeBlock,
    CountryFlag,
    Challenge,
    StaticTweet,
    Box,
    YouTube,
}
