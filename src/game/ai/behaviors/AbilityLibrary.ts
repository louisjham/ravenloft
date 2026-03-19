import type { MonsterAbility } from '../../types'

export const ABILITY_LIBRARY: Record<string, MonsterAbility> = {
    fireball: {
        id: 'fireball',
        name: 'Fireball',
        description: 'Single target damage 3.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 3
            }
        ]
    },

    summon_skeletons: {
        id: 'summon_skeletons',
        name: 'Summon Skeletons',
        description: 'Spawn skeleton minions.',
        type: 'active',
        effects: []
        // TODO: full summon implementation
    },

    multiattack: {
        id: 'multiattack',
        name: 'Multiattack',
        description: 'Attack multiple targets.',
        type: 'active',
        effects: []
        // TODO: full multiattack implementation
    },

    undying: {
        id: 'undying',
        name: 'Undying',
        description: 'When reduced to 0 HP, roll d20. On 15+, return to 1 HP.',
        type: 'triggered',
        trigger: 'on_death',
        effects: [
            {
                type: 'heal',
                target: 'self',
                value: 1,
                condition: 'roll_15_plus'
            }
        ]
    },

    plague_aura: {
        id: 'plague_aura',
        name: 'Plague Aura',
        description: 'Heroes adjacent take 1 poison damage at start of turn.',
        type: 'passive',
        effects: [
            {
                type: 'damage',
                target: 'adjacent_heroes',
                value: 1,
                condition: 'poisoned'
            }
        ]
    },

    vampiric_bite: {
        id: 'vampiric_bite',
        name: 'Vampiric Bite',
        description: 'Heal for damage dealt.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 1
            },
            {
                type: 'heal',
                target: 'self',
                value: 1
            }
        ]
    },

    mist_form: {
        id: 'mist_form',
        name: 'Mist Form',
        description: 'Teleport to any tile with a hero.',
        type: 'active',
        effects: [
            {
                type: 'teleport',
                target: 'tile'
            }
        ]
    },

    regeneration: {
        id: 'regeneration',
        name: 'Regeneration',
        description: 'Heal 1 HP at start of turn.',
        type: 'passive',
        effects: [
            {
                type: 'heal',
                target: 'self',
                value: 1
            }
        ]
    },

    fire_breath: {
        id: 'fire_breath',
        name: 'Fire Breath',
        description: 'Cone attack, 2 damage to all heroes in cone.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'adjacent_heroes',
                value: 2,
                aoe: true
            }
        ]
    },

    summon: {
        id: 'summon',
        name: 'Summon',
        description: 'Spawn 1-2 minions.',
        type: 'active',
        effects: []
        // TODO: summon logic implemented in a future pass - requires MonsterSpawner
    },

    fear_aura: {
        id: 'fear_aura',
        name: 'Fear Aura',
        description: 'Heroes adjacent must roll or be stunned.',
        type: 'passive',
        effects: [
            {
                type: 'condition',
                target: 'adjacent_heroes',
                condition: 'stunned',
                duration: 1
            }
        ]
    },

    drain_life: {
        id: 'drain_life',
        name: 'Drain Life',
        description: 'Deal 2 damage, heal 1 HP.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 2
            },
            {
                type: 'heal',
                target: 'self',
                value: 1
            }
        ]
    },

    web: {
        id: 'web',
        name: 'Web',
        description: 'Target hero is immobilized (save ends).',
        type: 'active',
        effects: [
            {
                type: 'condition',
                target: 'closest_hero',
                condition: 'immobilized',
                duration: 1
            }
        ]
    },

    poison_cloud: {
        id: 'poison_cloud',
        name: 'Poison Cloud',
        description: 'All heroes on tile take 1 poison damage.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'tile',
                value: 1,
                condition: 'poisoned'
            }
        ]
    },

    howl: {
        id: 'howl',
        name: 'Howl',
        description: 'All heroes must roll or be dazed.',
        type: 'active',
        effects: [
            {
                type: 'condition',
                target: 'all_heroes',
                condition: 'dazed',
                duration: 1
            }
        ]
    }
}

export function getAbility(id: string): MonsterAbility {
    const ability = ABILITY_LIBRARY[id]
    if (!ability) {
        throw new Error(`Ability with id "${id}" not found in ABILITY_LIBRARY. Valid ids are: ${Object.keys(ABILITY_LIBRARY).join(', ')}`)
    }
    return ability
}
