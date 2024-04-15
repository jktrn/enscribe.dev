import { ReactNode } from 'react'

interface Props {
    children: ReactNode
}

export default function PageTitle({ children }: Props) {
    return (
        <h1 className="text-balance text-3xl font-extrabold leading-9 tracking-tight text-foreground sm:text-4xl sm:leading-10 md:text-5xl md:leading-14">
            {children}
        </h1>
    )
}
