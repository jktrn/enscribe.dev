import { Badge } from '@/components/shadcn/badge'

import Image from './Image'
import Link from './Link'

type CardProps = {
    title: string
    description: string
    imgSrc: string
    href: string
    tags?: string[]
}

const Card = ({ title, description, imgSrc, href, tags = [] }: CardProps) => (
    <div className="md max-w-[544px] p-4 md:w-1/2">
        <div className={`${imgSrc && 'h-full'} overflow-hidden rounded-md border border-border`}>
            {imgSrc &&
                (href ? (
                    <Link href={href} aria-label={`Link to ${title}`}>
                        <Image
                            alt={title}
                            src={imgSrc}
                            className="object-fit object-center"
                            width={544}
                            height={286}
                        />
                    </Link>
                ) : (
                    <Image
                        alt={title}
                        src={imgSrc}
                        className="object-fit object-center"
                        width={544}
                        height={286}
                    />
                ))}
            <div className="p-6">
                <h2 className="mb-2 text-2xl font-bold leading-8 tracking-tight">
                    {href ? (
                        <Link href={href} aria-label={`Link to ${title}`}>
                            {title}
                        </Link>
                    ) : (
                        title
                    )}
                </h2>
                <div className="mb-3 flex flex-wrap">
                    {tags.map((tag, index) => (
                        <Badge
                            key={tag}
                            className="mr-2 mb-2"
                            variant={index === 0 ? 'default' : 'outline'}
                        >
                            {tag}
                        </Badge>
                    ))}
                </div>
                <p className="prose prose-sm mb-3 max-w-none text-muted-foreground">
                    {description}
                </p>
                {href && (
                    <Link
                        href={href}
                        className="text-base font-medium leading-6 text-primary hover:brightness-125 dark:hover:brightness-125"
                        aria-label={`Link to ${title}`}
                    >
                        Learn more &rarr;
                    </Link>
                )}
            </div>
        </div>
    </div>
)

export default Card
