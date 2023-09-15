export interface Character {
    name: string
    cardName: string
    rarity: string
    attribute: string
    splashArt: string
    avatar: string
    flag?: string
}

export interface GachaResponse {
    characters?: Character[]
    error?: string
}