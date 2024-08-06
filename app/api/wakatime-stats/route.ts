import { NextRequest } from 'next/server'

type Language = {
    name: string
    hours: string
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl
    const username = url.searchParams.get('username')

    if (!username) {
        return new Response(JSON.stringify({ error: 'Username is required' }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    }

    try {
        const response = await fetch(`https://wakatime.com/api/v1/users/${username}/stats/all_time`)

        if (!response.ok) {
            console.log(response.status)
            throw new Error('Failed to fetch data from WakaTime API')
        }

        const data = await response.json()
        const topLanguages: Language[] = data.data.languages.map((lang: any) => ({
            name: lang.name,
            hours: (lang.total_seconds / 3600).toFixed(2),
        }))

        return new Response(JSON.stringify(topLanguages), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('WakaTime API error:', error)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    }
}
