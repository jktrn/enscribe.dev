import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const redis = Redis.fromEnv()
export const runtime = 'edge'

const ratelimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        if (req.headers.get('Content-Type') !== 'application/json') {
            return new NextResponse('Content type must be json', { status: 400 })
        }

        const body = await req.json()
        if (!body.slug) {
            return new NextResponse('Slug not found', { status: 400 })
        }

        const slug = body.slug
        const ip = req.ip ?? '127.0.0.1'

        const allowed = await ratelimiter.limit(ip)
        if (!allowed) {
            return new NextResponse('Rate limit exceeded', { status: 429 })
        }

        const hash = await generateHash(ip)
        const dedupKey = `deduplicate:${hash}:${slug}`
        const isNew = await redis.set(dedupKey, true, { nx: true, ex: 24 * 60 * 60 })

        if (!isNew) {
            return new NextResponse('Duplicate request', { status: 202 })
        }

        const pageViewKey = `pageviews:projects:${slug}`
        await redis.incr(pageViewKey)
        return new NextResponse('Request processed', { status: 202 })
    } catch (error) {
        console.error('Error processing request:', error)
        return new NextResponse('Internal server error', { status: 500 })
    }
}

async function generateHash(input) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}
