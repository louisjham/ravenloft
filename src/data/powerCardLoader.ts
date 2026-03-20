import powerCardsJson from './powerCards.json'
import type { Card, PowerType } from '../game/types'

const POWER_CARDS: Card[] = powerCardsJson as Card[]

export function getAllPowerCards(): Card[] {
    return POWER_CARDS
}

export function getPowerCard(id: string): Card {
    const card = POWER_CARDS.find(c => c.id === id)
    if (!card) throw new Error(`Power card not found: ${id}`)
    return card
}

export function getPowerCardsForHero(heroClass: string): Card[] {
    return POWER_CARDS.filter(
        c => !c.heroClass || c.heroClass === heroClass
    )
}

export function getPowerCardsByType(
    heroClass: string,
    powerType: PowerType
): Card[] {
    return getPowerCardsForHero(heroClass).filter(
        c => c.powerType === powerType
    )
}
