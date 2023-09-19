import React from 'react'
import { MoveUpRight } from 'lucide-react'
import Link from '../Link'
import Image from 'next/image'

const IconBox = ({ icon: Icon, href }) => {
    return (
        <div className="relative flex h-full w-full items-center justify-center rounded-lg">
            {Icon && <Icon size={96} className="text-primary" />}
            <Link href={href} className="block">
                <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-tertiary/50 p-3 text-primary transition-all duration-300 hover:brightness-125">
                    <MoveUpRight size={16} />
                </div>
            </Link>
        </div>
    )
}

export default IconBox
