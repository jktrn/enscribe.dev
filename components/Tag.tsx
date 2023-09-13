import Link from 'next/link'
import { slug } from 'github-slugger'
interface Props {
    text: string
}

const Tag = ({ text }: Props) => {
    return (
        <Link
            href={`/tags/${slug(text)}`}
            className="mr-3 text-sm font-medium uppercase text-primary hover:brightness-110 dark:hover:brightness-110"
        >
            {text.split(' ').join('-')}
        </Link>
    )
}

export default Tag
