import { Clipboard, ClipboardCheck } from 'lucide-react'

const CopyIcon = ({ copied }) => (
    <div className="flex h-5 w-5 items-center justify-center">
        {copied ? (
            <ClipboardCheck className="text-green-400" />
        ) : (
            <Clipboard className="text-gray-300" />
        )}
    </div>
)

const CopyButton = ({ onClick, copied, hovered }) => (
    <button
        aria-label="Copy code"
        type="button"
        className={`border-1 absolute right-0.5 top-0.5 m-1 flex h-7 w-7 items-center justify-center rounded bg-accent transition-all duration-200 ${
            copied
                ? 'border-green-400 opacity-100 focus:border-green-400 focus:outline-none'
                : 'opacity-0'
        } ${hovered ? '!opacity-100' : ''}`}
        onClick={onClick}
    >
        <CopyIcon copied={copied} />
    </button>
)

export default CopyButton
