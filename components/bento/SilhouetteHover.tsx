import Image from 'next/image'

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
                fill={true}
                className={`rounded-3xl ${
                    objectCover ? 'object-cover' : 'object-contain'
                } transition-opacity delay-75 duration-300 group-hover:opacity-0`}
                unoptimized
            />
            <Image
                src={mainSrc}
                alt={mainAlt}
                fill={true}
                className={`rounded-3xl ${
                    objectCover ? 'object-cover' : 'object-contain'
                } opacity-0 transition-opacity delay-75 duration-300 group-hover:opacity-100`}
                unoptimized
            />
            {children}
        </div>
    )
}

export default SilhouetteHover
