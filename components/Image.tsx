'use client'

import { cn } from '@/scripts/utils/tailwind-helpers'
import NextImage, { ImageProps } from 'next/image'

const Image = ({ className, ...props }: ImageProps) => (
    <NextImage
        data-loaded="false"
        onLoad={(event) => {
            event.currentTarget.setAttribute('data-loaded', 'true')
        }}
        className={cn(
            'data-[loaded=false]:animate-skeleton data-[loaded=false]:bg-secondary',
            className
        )}
        {...props}
    />
)

export default Image
