import React from 'react'
import { MoveUpRight } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/shadcn/tooltip'
import Link from '../Link'

const IconBox = ({ icon: Icon, name, href }) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <div className="relative flex h-full w-full items-center justify-center rounded-lg">
                    {Icon && (
                        <TooltipTrigger>
                            <Icon size={96} className="text-primary" />
                        </TooltipTrigger>
                    )}
                    <Link href={href} className="block">
                        <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-secondary/50 p-3 transition-all duration-300 hover:brightness-125">
                            <MoveUpRight size={16} />
                        </div>
                    </Link>
                </div>
                <TooltipContent>{name}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export default IconBox
