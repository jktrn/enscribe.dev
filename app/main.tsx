import BentoBox from '@/components/bento/BentoBox'

export default function Home({ posts }) {
    return (
        <div className="divide-y divide-accent-foreground dark:divide-accent">
            <div className="mx-auto bento-md:-mx-[5vw] bento-lg:-mx-[20vw]">
                <BentoBox posts={posts} />
            </div>
        </div>
    )
}
