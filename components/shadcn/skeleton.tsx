import { cn } from '@/scripts/utils/tailwind-helpers'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('animate-skeleton rounded-md bg-muted', className)} {...props} />
}

export { Skeleton }
