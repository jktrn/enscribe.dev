const { withContentlayer } = require('next-contentlayer')
const redirects = require('./data/redirects.js')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
})

// You might need to insert additional domains in script-src if you are using external services
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' giscus.app analytics.umami.is;
  style-src 'self' 'unsafe-inline' fonts.googleapis.com;
  img-src * blob: data:;
  media-src 'self';
  connect-src *;
  font-src 'self' fonts.gstatic.com;
  frame-src giscus.app www.youtube.com;
`

const securityHeaders = [
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
    {
        key: 'Content-Security-Policy',
        value: ContentSecurityPolicy.replace(/\n/g, ''),
    },
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-DNS-Prefetch-Control
    {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
    },
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
    },
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Feature-Policy
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
    },
]

/**
 * @type {import('next/dist/next-server/server/config').NextConfig}
 **/
module.exports = () => {
    const plugins = [withContentlayer, withBundleAnalyzer]
    return plugins.reduce((acc, next) => next(acc), {
        reactStrictMode: true,
        pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
        eslint: {
            dirs: ['app', 'components', 'layouts', 'scripts'],
        },
        images: {
            domains: [
                'www.gravatar.com',
                'avatars.githubusercontent.com',
                'pbs.twimg.com',
                'i.scdn.co',
                'api.lanyard.rest',
                'cdn.discordapp.com',
            ],
        },
        experimental: {
            appDir: true,
        },
        async headers() {
            return [
                {
                    source: '/(.*)',
                    headers: securityHeaders,
                },
            ]
        },
        async redirects() {
            return [
                {
                    source: '/ctfs/pico22/beginners-compilation',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico/beginners-compilation',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/crypto/basic-mod1',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/crypto/basic-mod1-2',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/pwn/basic-file-exploit',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/crypto/pwn/cve-xxxx-xxxx',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/pwn/cve-xxxx-xxxx',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/pwn/ropfu',
                    destination: '/blog/picoctf-2022/beginners-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/byu/osint/osint-compilation',
                    destination: '/blog/byuctf-2022/osint-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/utc/prog/port-authority',
                    destination: '/blog/dhhutc-2022/port-authority',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/pwn/buffer-overflow-series',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/pwn/buffer-overflow-0',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/pwn/buffer-overflow-1',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/crypto/pwn/buffer-overflow-0',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/crypto/pwn/buffer-overflow-1',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/crypto/pwn/buffer-overflow-2',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/ctfs/pico22/crypto/pwn/buffer-overflow-3',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/blog/picoctf-2022/buffer-overflow-series',
                    destination: '/blog/picoctf-2022/buffer-overflow',
                    permanent: true,
                },
                {
                    source: '/ctfs/sekai/compilation',
                    destination: '/blog/sekaictf-2022/forensics-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/shctf/compilation',
                    destination: '/blog/shctf-2022/writeup-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/shctf/pwn/guardians-of-the-galaxy',
                    destination: '/blog/shctf-2022/writeup-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/shctf/pwn/vader',
                    destination: '/blog/shctf-2022/writeup-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/shctf/pwn/warmup-to-the-dark-side',
                    destination: '/blog/shctf-2022/writeup-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/shctf/crypto/rahools-challenge',
                    destination: '/blog/shctf-2022/writeup-compilation',
                    permanent: true,
                },
                {
                    source: '/ctfs/actf/algo/gcd-query',
                    destination: '/blog/actf-2023/gcd-query',
                    permanent: true,
                },
                {
                    source: '/ctfs/idek/osint/nmpz',
                    destination: '/blog/idekctf-2023/nmpz',
                    permanent: true,
                },
                {
                    source: '/ctfs/mhs/prog/matchmaker',
                    destination: '/blog/mhsctf-2023/matchmaker',
                    permanent: true,
                },
                {
                    source: '/ctfs/wolv23/osint/wannaflag',
                    destination: '/blog/wolvctf-2023/wannaflag-series',
                    permanent: true,
                },
            ]
        },
        webpack: (config, options) => {
            config.module.rules.push({
                test: /\.svg$/,
                use: ['@svgr/webpack'],
            })

            return config
        },
    })
}
