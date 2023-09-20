import BentoBox from '@/components/bento/BentoBox'

export default function Home({ posts }) {
    return (
        <div className="divide-y divide-accent-foreground dark:divide-accent">
            <div className="z-10 m-auto md:-mx-[20vw]">
                <BentoBox posts={posts} />
            </div>
        </div>
    )
}
