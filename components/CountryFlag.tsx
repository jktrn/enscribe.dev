interface CountryFlagProps {
    country: string
}

// Parameter: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
export default function CountryFlag({ country }: CountryFlagProps) {
    if (!country) return null

    return (
        <img
            src={`https://flagcdn.com/20x15/${country}.png`}
            alt={country}
            className="inline-block align-text-middle !m-0 !mr-1 rounded-none border-none"
        />
    )
}
