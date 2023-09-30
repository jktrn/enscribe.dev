import Image from '../Image'

interface SilhouetteHoverProps {
    silhouetteSrc: string
    silhouetteAlt: string
    mainSrc: string
    mainAlt: string
    objectCover?: boolean
    children?: React.ReactNode
    className?: string
}

const SilhouetteHover = ({
    silhouetteSrc,
    silhouetteAlt,
    mainSrc,
    mainAlt,
    objectCover = true,
    children,
    className,
}: SilhouetteHoverProps) => {
    return (
        <div className={`group ${className}`}>
            <Image
                src={silhouetteSrc}
                alt={silhouetteAlt}
                fill
                noRelative
                className={`rounded-3xl ${
                    objectCover ? 'object-cover' : 'object-contain'
                } transition-opacity delay-75 duration-300 group-hover:opacity-0`}
                skeletonClassName="rounded-3xl z-[1]"
                unoptimized
            />
            <Image
                src={mainSrc}
                alt={mainAlt}
                fill
                noRelative
                className={`rounded-3xl ${
                    objectCover ? 'object-cover' : 'object-contain'
                } opacity-0 transition-opacity delay-75 duration-300 group-hover:opacity-100`}
                skeletonClassName="rounded-3xl z-[1]"
                unoptimized
            />
            {children}
        </div>
    )
}

export default SilhouetteHover
