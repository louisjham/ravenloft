import { BossPhase } from '../../types'
import bossPhases from '../../../data/boss-phases.json'

export interface BossTacticsDefinition {
    phases: BossPhase[]
}

export const BOSS_TACTICS = bossPhases as Record<string, BossTacticsDefinition>

export function getBossTactics(monsterType: string): BossTacticsDefinition {
    const tactics = BOSS_TACTICS[monsterType]
    if (!tactics) {
        throw new Error(
            `Boss tactics not found for monster type "${monsterType}". ` +
            `Valid monster types are: ${Object.keys(BOSS_TACTICS).join(', ')}`
        )
    }
    return tactics
}
