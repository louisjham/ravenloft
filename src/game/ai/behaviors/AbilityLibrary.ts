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
                condition: 'roll_undying'
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
    },
    blast_of_lightning: {
        id: 'blast_of_lightning',
        name: 'Blast of Lightning',
        description: 'Lightning breath: 3 damage to adjacent heroes.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'adjacent_heroes',
                value: 3
            }
        ]
    },
    gravestorms_bite: {
        id: 'gravestorms_bite',
        name: "Gravestorm's Bite",
        description: 'Bite adjacent hero: 2 damage and push.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 2
            },
            {
                type: 'push',
                target: 'closest_hero',
                value: 1
            }
        ]
    },
    burst_of_lightning: {
        id: 'burst_of_lightning',
        name: 'Burst of Lightning',
        description: 'Lightning strike: 1 damage to closest hero\'s tile.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'tile',
                value: 1
            }
        ]
    },

    paralyzing_claws: {
        id: 'paralyzing_claws',
        name: 'Paralyzing Claws',
        description: 'On hit, target hero is immobilized.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 1
            },
            {
                type: 'condition',
                target: 'closest_hero',
                condition: 'immobilized',
                duration: 1
            }
        ]
    },

    pack_hunter: {
        id: 'pack_hunter',
        name: 'Pack Hunter',
        description: 'Wolf deals +1 damage for each other Wolf adjacent to target.',
        type: 'passive',
        effects: [
            {
                type: 'buff',
                target: 'self'
            }
        ]
    },

    shifty: {
        id: 'shifty',
        name: 'Shifty',
        description: 'Kobold can shift 1 square after attacking.',
        type: 'active',
        effects: [
            {
                type: 'move',
                target: 'self',
                value: 1
            }
        ]
    },

    death_shriek: {
        id: 'death_shriek',
        name: 'Death Shriek',
        description: 'When Wraith is defeated, deal 1 damage to all heroes on tile.',
        type: 'triggered',
        trigger: 'on_death',
        effects: [
            {
                type: 'damage',
                target: 'all_heroes',
                value: 1
            }
        ]
    },

    swarm: {
        id: 'swarm',
        name: 'Swarm',
        description: 'Rat Swarm takes half damage (rounded up).',
        type: 'passive',
        effects: [
            {
                type: 'buff',
                target: 'self'
            }
        ]
    },

    explosive: {
        id: 'explosive',
        name: 'Explosive',
        description: 'When Blazing Skeleton is defeated, deal 1 damage to all heroes on tile.',
        type: 'triggered',
        trigger: 'on_death',
        effects: [
            {
                type: 'damage',
                target: 'all_heroes',
                value: 1
            }
        ]
    },

    cackling_skulls: {
        id: 'cackling_skulls',
        name: 'Cackling Skulls',
        description: 'Any hero that attacks and misses Skull Lord from within 1 tile must flip a daily/utility power or take 1 damage.',
        type: 'passive',
        effects: [
            {
                type: 'damage',
                target: 'self',
                value: 1,
                condition: 'on_miss'
            }
        ]
    },

    mummy_rot: {
        id: 'mummy_rot',
        name: 'Mummy Rot',
        description: 'Damage inflicted by Mummy cannot be healed (turn the wound token face down).',
        type: 'passive',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 1
            }
        ]
    },

    incorporeal: {
        id: 'incorporeal',
        name: 'Incorporeal',
        description: '+3 AC vs non-adjacent attacks.',
        type: 'passive',
        effects: [
            {
                type: 'buff',
                target: 'self'
            }
        ]
    },

    feeding_frenzy: {
        id: 'feeding_frenzy',
        name: 'Feeding Frenzy',
        description: 'When a hero kills a non-Undead monster within 1 tile, Ghast moves onto the monster\'s square and heals 1 HP.',
        type: 'triggered',
        trigger: 'on_death',
        effects: [
            {
                type: 'heal',
                target: 'self',
                value: 1
            }
        ]
    },

    cascade_of_steel: {
        id: 'cascade_of_steel',
        name: 'Cascade of Steel',
        description: 'If adjacent to only 1 hero, Tomb Guardian attacks up to 4 times until he misses.',
        type: 'active',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 1
            }
        ]
    },

    vengeful_shriek: {
        id: 'vengeful_shriek',
        name: 'Vengeful Shriek',
        description: 'When Battle Wight is killed, the closest Undead monster within 2 tiles gains an extra activation immediately.',
        type: 'triggered',
        trigger: 'on_death',
        effects: []
    },

    agonizing_gaze: {
        id: 'agonizing_gaze',
        name: 'Agonizing Gaze',
        description: 'Any hero that attacks Bodak from the same tile takes 1 damage before the attack and suffers -2 to Attack bonus.',
        type: 'passive',
        effects: [
            {
                type: 'damage',
                target: 'self',
                value: 1
            }
        ]
    },

    shriek: {
        id: 'shriek',
        name: 'Shriek',
        description: 'When Dire Bat is hit, reveal a tile from the bottom on the closest unexplored edge.',
        type: 'triggered',
        trigger: 'on_damage_taken',
        effects: []
    },

    deathless_hunger: {
        id: 'deathless_hunger',
        name: 'Deathless Hunger',
        description: 'Zombie Hulk may only be reduced to 0 HP by an attack that is a natural hit.',
        type: 'passive',
        effects: [
            {
                type: 'buff',
                target: 'self'
            }
        ]
    },

    force_armor: {
        id: 'force_armor',
        name: 'Force Armor',
        description: 'Direguard gains +1 AC for each wound token on it.',
        type: 'passive',
        effects: [
            {
                type: 'buff',
                target: 'self'
            }
        ]
    },

    engage: {
        id: 'engage',
        name: 'Engage',
        description: 'Heroes that start adjacent to Warforged Minion and move away take 1 damage.',
        type: 'passive',
        effects: [
            {
                type: 'damage',
                target: 'adjacent_heroes',
                value: 1
            }
        ]
    },

    magehands: {
        id: 'magehands',
        name: 'Magehands',
        description: 'When any hero within 2 tiles draws an Encounter card, draw 3 cards instead and choose any Trap.',
        type: 'passive',
        effects: []
    },

    impending_doom: {
        id: 'impending_doom',
        name: 'Impending Doom',
        description: 'Place a HP token face down on the hero card. Each token causes -1 AC.',
        type: 'active',
        effects: [
            {
                type: 'condition',
                target: 'closest_hero',
                condition: 'weakened',
                duration: 1
            }
        ]
    },

    death_rattle: {
        id: 'death_rattle',
        name: 'Death Rattle',
        description: 'At the start of its activation, Bone Naga attacks each hero within 1 tile.',
        type: 'triggered',
        trigger: 'on_turn_start',
        effects: [
            {
                type: 'damage',
                target: 'adjacent_heroes',
                value: 1
            }
        ]
    },

    threatening_reach: {
        id: 'threatening_reach',
        name: 'Threatening Reach',
        description: 'Any hero that starts a move action within 2 tiles of Boneclaw is attacked with extending claws.',
        type: 'passive',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 1
            }
        ]
    },

    dark_chant: {
        id: 'dark_chant',
        name: 'Dark Chant',
        description: 'If Dark Acolyte did not attack, the closest wounded Undead regains 1 HP.',
        type: 'active',
        effects: [
            {
                type: 'heal',
                target: 'self',
                value: 1,
                condition: 'ally_undead'
            }
        ]
    },

    tireless_pursuit: {
        id: 'tireless_pursuit',
        name: 'Tireless Pursuit',
        description: 'If a hero started his turn adjacent to Dread Warrior and moves away, move adjacent to the hero and attack with axe.',
        type: 'passive',
        effects: [
            {
                type: 'damage',
                target: 'closest_hero',
                value: 2
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
