'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/shadcn/tooltip'

const ThemeSwitch = () => {
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()

    // When mounted on client, now we can show the UI
    useEffect(() => setMounted(true), [])

    if (!mounted) {
        return null
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <button
                        disabled
                        aria-label="Toggle Dark Mode"
                        className="flex cursor-not-allowed items-center transition-opacity duration-300 hover:brightness-125 disabled:opacity-50"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                        {mounted && theme === 'dark' ? <Sun /> : <Moon />}
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <span>Temporarily disabled!</span>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export default ThemeSwitch
