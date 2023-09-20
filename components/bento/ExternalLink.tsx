import { MoveUpRight } from 'lucide-react'

import Link from '../Link'

interface ExternalLinkProps {
    href: string
    newTab?: boolean
    className?: string
}

const ExternalLink = ({ href, newTab = true, className }: ExternalLinkProps) => {
    return newTab ? (
        <Link href={href} className={className}>
            <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-tertiary/50 p-3 text-primary transition-all duration-300 hover:brightness-125">
                <MoveUpRight size={16} />
            </div>
        </Link>
    ) : (
        <a href={href} className={className}>
            <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-tertiary/50 p-3 text-primary transition-all duration-300 hover:brightness-125">
                <MoveUpRight size={16} />
            </div>
        </a>
    )
}

export default ExternalLink
