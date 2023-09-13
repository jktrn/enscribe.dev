import Image from './Image'
import Link from './Link'

const Card = ({ title, description, imgSrc, href }) => (
    <div className="md max-w-[544px] p-4 md:w-1/2">
        <div
            className={`${
                imgSrc && 'h-full'
            }  overflow-hidden rounded-md border-2 border-secondary border-opacity-60`}
        >
            {imgSrc &&
                (href ? (
                    <Link href={href} aria-label={`Link to ${title}`}>
                        <Image
                            alt={title}
                            src={imgSrc}
                            className="object-cover object-center md:h-36 lg:h-48"
                            width={544}
                            height={306}
                        />
                    </Link>
                ) : (
                    <Image
                        alt={title}
                        src={imgSrc}
                        className="object-cover object-center md:h-36 lg:h-48"
                        width={544}
                        height={306}
                    />
                ))}
            <div className="p-6">
                <h2 className="mb-3 text-2xl font-bold leading-8 tracking-tight">
                    {href ? (
                        <Link href={href} aria-label={`Link to ${title}`}>
                            {title}
                        </Link>
                    ) : (
                        title
                    )}
                </h2>
                <p className="prose mb-3 max-w-none text-muted-foreground">
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
