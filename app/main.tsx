import BentoBox from '@/components/bento/BentoBox'

export default function Home({ posts }) {
    return (
        <div className="divide-y divide-accent-foreground dark:divide-accent">
            <BentoBox posts={posts} />
        </div>
    )
}
