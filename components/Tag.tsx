import Link from 'next/link'
import { slug } from 'github-slugger'
interface Props {
    text: string
}

const Tag = ({ text }: Props) => {
    return (
        <Link
            href={`/tags/${slug(text)}`}
            className="text-sm font-medium uppercase text-primary hover:brightness-125 dark:hover:brightness-125"
        >
            {text.split(' ').join('-')}
        </Link>
    )
}

export default Tag
