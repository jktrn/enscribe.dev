import { Book, Flag, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

const Box = ({ text, type }) => {
    const typeMapping = {
        warning: {
            color: 'bg-destructive/30',
            icon: AlertCircle,
        },
        info: {
            color: 'bg-secondary',
            icon: Info,
        },
        definition: {
            color: 'bg-primary/25',
            icon: Book,
        },
        theorem: {
            color: 'bg-primary/25',
            icon: CheckCircle2,
        },
        flag: {
            color: 'bg-primary/25',
            icon: Flag,
        },
    }

    return (
        <div className={`my-6 rounded-lg p-4 ${typeMapping[type].color} text-center`}>
            <span className="mb-1 mr-2 inline-flex items-center justify-center align-middle">
                {React.createElement(typeMapping[type].icon, { size: 16 })}
            </span>
            <ReactMarkdown
                components={{ p: React.Fragment }}
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {text}
            </ReactMarkdown>
        </div>
    )
}

export default Box
