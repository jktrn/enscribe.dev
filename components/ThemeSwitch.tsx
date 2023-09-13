'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

const ThemeSwitch = () => {
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()

    // When mounted on client, now we can show the UI
    useEffect(() => setMounted(true), [])

    if (!mounted) {
        return null
    }

    return (
        <button
            aria-label="Toggle Dark Mode"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
            {mounted && theme === 'dark' ? <Sun /> : <Moon />}
        </button>
    )
}

export default ThemeSwitch
