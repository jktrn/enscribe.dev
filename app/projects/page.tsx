import Card from '@/components/Card'
import projectsData from '@/data/projectsData'
import { genPageMetadata } from 'app/seo'

export const metadata = genPageMetadata({ title: 'Projects' })

export default function Projects() {
    return (
        <>
            <div className="divide-y divide-accent-foreground dark:divide-accent">
                <div className="space-y-2 py-8 md:space-y-5">
                    <h1 className="text-3xl font-extrabold leading-9 tracking-tight text-foreground sm:text-4xl sm:leading-10 md:text-6xl md:leading-14">
                        Projects
                    </h1>
                    <p className="text-muted-foreground">
                        Stuff I've personally developed or contributed to!
                    </p>
                </div>
                <div className="py-12">
                    <div className="-m-4 flex flex-wrap">
                        {projectsData.map((d) => (
                            <Card
                                key={d.title}
                                title={d.title}
                                description={d.description}
                                imgSrc={d.imgSrc}
                                href={d.href}
                                tags={d.tags}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
