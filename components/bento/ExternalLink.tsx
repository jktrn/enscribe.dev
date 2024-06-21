import { MoveUpRight } from 'lucide-react'
import type { LinkProps } from 'next/link'
import { AnchorHTMLAttributes } from 'react'
import Link from '../Link'

interface ExternalLinkProps extends LinkProps {
    newTab?: boolean
}

const ExternalLink = ({
    newTab = true,
    ...props
}: ExternalLinkProps & AnchorHTMLAttributes<HTMLAnchorElement>) => {
    return newTab ? (
        <Link {...props}>
            <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-tertiary/50 p-3 text-primary transition-all duration-300 hover:brightness-125">
                <MoveUpRight size={16} />
            </div>
        </Link>
    ) : (
        <a {...props}>
            <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-tertiary/50 p-3 text-primary transition-all duration-300 hover:brightness-125">
                <MoveUpRight size={16} />
            </div>
        </a>
    )
}

export default ExternalLink
