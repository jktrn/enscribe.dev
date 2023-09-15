import React from 'react'

const YouTube = ({
    youTubeId,
    youTubePlaylistId,
    aspectRatio = '16:9',
    autoPlay = false,
    skipTo = { h: 0, m: 0, s: 0 },
    noCookie = false,
}) => {
    const { h, m, s } = skipTo

    const tH = h * 60
    const tM = m * 60

    const startTime = tH + tM + s

    const provider = noCookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com'
    const baseUrl = `${provider}/embed/`
    const src = `${baseUrl}${
        youTubeId
            ? `${youTubeId}?&autoplay=${autoPlay}&start=${startTime}`
            : `&videoseries?list=${youTubePlaylistId}`
    }`

    return (
        <div
            className="youtube-mdx-embed relative my-6 w-full"
            style={{
                ...getPadding(aspectRatio),
            }}
        >
            <iframe
                data-testid="youtube"
                title={`youTube-${youTubeId ? youTubeId : youTubePlaylistId}`}
                src={src}
                frameBorder="0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    )
}

const getPadding = (aspectRatio) => {
    const config = {
        '1:1': {
            paddingTop: '100%',
        },
        '16:9': {
            paddingTop: '56.25%',
        },
        '4:3': {
            paddingTop: '75%',
        },
        '3:2': {
            paddingTop: '66.66%',
        },
        8.5: {
            paddingTop: '62.5%',
        },
    }
    // @ts-ignore
    return config[aspectRatio]
}

export default YouTube
