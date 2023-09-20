'use client'

import { Skeleton } from '@/components/shadcn/skeleton'
import NextImage, { ImageProps } from 'next/image'
import { useState } from 'react'

interface ExtendedImageProps extends ImageProps {
    noSkeleton?: boolean
    skeletonClassName?: string
}

const Image = ({
    onLoad,
    className,
    noSkeleton,
    skeletonClassName,
    ...rest
}: ExtendedImageProps) => {
    const [isLoading, setIsLoading] = useState(true)

    return (
        <div className="relative">
            {!noSkeleton && isLoading && (
                <Skeleton
                    className={`absolute left-0 top-0 h-full w-full rounded-md object-contain ${skeletonClassName}`}
                />
            )}
            <NextImage
                {...rest}
                className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={(event) => {
                    setIsLoading(false)
                    if (onLoad) onLoad(event)
                }}
            />
        </div>
    )
}

export default Image
