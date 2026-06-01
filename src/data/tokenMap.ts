/**
 * Token asset map for Castle Ravenloft
 * Maps token IDs to their image assets
 */

export interface TokenAsset {
    id: string
    name: string
    frontImage: string
    backImage: string
    type: 'coffin' | 'encounter' | 'item' | 'condition' | 'monster' | 'misc' | 'hp' | 'healing_surge' | 'reaction' | 'marker' | 'adventure'
    description?: string
    maxCount?: number
}

// Coffin tokens for Scenario 1 (Find Strahd's Coffin)
export const COFFIN_TOKENS: TokenAsset[] = [
    {
        id: 'coffin_strahd',
        name: "Strahd's Coffin",
        frontImage: '/assets/tokens/Token_Misc_CoffinStrahd.png',
        backImage: '/assets/tokens/Token_Misc_CoffinBack.png',
        type: 'coffin'
    },
    {
        id: 'coffin_empty',
        name: 'Empty Coffin',
        frontImage: '/assets/tokens/Token_Misc_CoffinEmpty.png',
        backImage: '/assets/tokens/Token_Misc_CoffinBack.png',
        type: 'coffin'
    },
    {
        id: 'coffin_treasure',
        name: 'Treasure Coffin',
        frontImage: '/assets/tokens/Token_Misc_CoffinTreasure.png',
        backImage: '/assets/tokens/Token_Misc_CoffinBack.png',
        type: 'coffin'
    },
    {
        id: 'coffin_trap',
        name: 'Trap Coffin',
        frontImage: '/assets/tokens/Token_Misc_CoffinTrap.png',
        backImage: '/assets/tokens/Token_Misc_CoffinBack.png',
        type: 'coffin'
    },
    {
        id: 'coffin_monster',
        name: 'Monster Coffin',
        frontImage: '/assets/tokens/Token_Misc_CoffinMonster.png',
        backImage: '/assets/tokens/Token_Misc_CoffinBack.png',
        type: 'coffin'
    },
    {
        id: 'coffin_holy_water',
        name: 'Holy Water Coffin',
        frontImage: '/assets/tokens/Token_Misc_CoffinHolyWater.png',
        backImage: '/assets/tokens/Token_Misc_CoffinBack.png',
        type: 'coffin'
    },
    {
        id: 'coffin_wooden_stake',
        name: 'Wooden Stake Coffin',
        frontImage: '/assets/tokens/Token_Misc_CoffinWoodenStake.png',
        backImage: '/assets/tokens/Token_Misc_CoffinBack.png',
        type: 'coffin'
    }
]

// Monster tokens for tracking specific monster types
export const MONSTER_TOKENS: TokenAsset[] = [
    {
        id: 'monster_0',
        name: 'Monster Marker 0',
        frontImage: '/assets/tokens/Token_Monster_0.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 9
    },
    {
        id: 'monster_1',
        name: 'Monster Marker 1',
        frontImage: '/assets/tokens/Token_Monster_1.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 12
    },
    {
        id: 'monster_2',
        name: 'Monster Marker 2',
        frontImage: '/assets/tokens/Token_Monster_2.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 6
    },
    {
        id: 'monster_3',
        name: 'Monster Marker 3',
        frontImage: '/assets/tokens/Token_Monster_3.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 2
    },
    {
        id: 'monster_dragolich',
        name: 'Dragolich',
        frontImage: '/assets/tokens/Token_Monster_Dragolich.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 2
    },
    {
        id: 'monster_flesh_golem',
        name: 'Flesh Golem',
        frontImage: '/assets/tokens/Token_Monster_FleshGolem.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 1
    },
    {
        id: 'monster_howling_hag',
        name: 'Howling Hag',
        frontImage: '/assets/tokens/Token_Monster_HowlingHag.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 5
    },
    {
        id: 'monster_kobold_sorcerer',
        name: 'Kobold Sorcerer',
        frontImage: '/assets/tokens/Token_Monster_KoboldSorceror.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 1
    },
    {
        id: 'monster_strahd',
        name: 'Count Strahd',
        frontImage: '/assets/tokens/Token_Monster_Strahd.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 1
    },
    {
        id: 'monster_werewolf',
        name: 'Werewolf',
        frontImage: '/assets/tokens/Token_Monster_Werewolf.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 1
    },
    {
        id: 'monster_young_vampire',
        name: 'Young Vampire',
        frontImage: '/assets/tokens/Token_Monster_YoungVampire.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 1
    },
    {
        id: 'monster_zombie_dragon',
        name: 'Zombie Dragon',
        frontImage: '/assets/tokens/Token_Monster_ZombieDragon.png',
        backImage: '/assets/tokens/Token_MonsterBack.png',
        type: 'monster',
        maxCount: 1
    }
]

// Encounter tokens (traps and environmental hazards)
export const ENCOUNTER_TOKENS: TokenAsset[] = [
    {
        id: 'encounter_alarm',
        name: 'Alarm',
        frontImage: '/assets/tokens/Token_Encounter_Alarm.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'An alarm that alerts nearby monsters',
        maxCount: 1
    },
    {
        id: 'encounter_consecrated_ground',
        name: 'Consecrated Ground',
        frontImage: '/assets/tokens/Token_Encounter_ConsecratedGround.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Holy ground that affects undead',
        maxCount: 1
    },
    {
        id: 'encounter_crossbow_turret',
        name: 'Crossbow Turret',
        frontImage: '/assets/tokens/Token_Encounter_CrossbowTurret.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Automated crossbow trap',
        maxCount: 1
    },
    {
        id: 'encounter_crushing_walls',
        name: 'Crushing Walls',
        frontImage: '/assets/tokens/Token_Encounter_CrushingWalls.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Walls that close in on heroes',
        maxCount: 1
    },
    {
        id: 'encounter_dart_trap',
        name: 'Dart Trap',
        frontImage: '/assets/tokens/Token_Encounter_DartTrap.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Hidden dart launcher',
        maxCount: 1
    },
    {
        id: 'encounter_fire_trap',
        name: 'Fire Trap',
        frontImage: '/assets/tokens/Token_Encounter_FireTrap.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Trap that unleashes flames',
        maxCount: 1
    },
    {
        id: 'encounter_freezing_cloud',
        name: 'Freezing Cloud',
        frontImage: '/assets/tokens/Token_Encounter_FreezingCloud.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Cloud of freezing mist',
        maxCount: 1
    },
    {
        id: 'encounter_illusionary_crowd',
        name: 'Illusionary Crowd',
        frontImage: '/assets/tokens/Token_Encounter_IllusionaryCrowd.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Magical illusions that confuse heroes',
        maxCount: 1
    },
    {
        id: 'encounter_sliding_walls',
        name: 'Sliding Walls',
        frontImage: '/assets/tokens/Token_Encounter_SlidingWalls.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Walls that shift and block passage',
        maxCount: 1
    },
    {
        id: 'encounter_spear_gauntlet',
        name: 'Spear Gauntlet',
        frontImage: '/assets/tokens/Token_Encounter_SpearGauntlet.png',
        backImage: '/assets/tokens/Token_EncounterBack.png',
        type: 'encounter',
        description: 'Corridor filled with spear traps',
        maxCount: 1
    },
    {
        id: 'encounter_glyph_of_warding',
        name: 'Glyph of Warding',
        frontImage: '/assets/tokens/Token_Item_GlyphOfWarding.png',
        backImage: '/assets/tokens/Token_ItemBack.png',
        type: 'encounter',
        description: 'Magical glyph that triggers when crossed',
        maxCount: 1
    }
]

// Item tokens (quest items and equipment)
export const ITEM_TOKENS: TokenAsset[] = [
    {
        id: 'item_animal',
        name: 'Animal',
        frontImage: '/assets/tokens/Token_Misc_ItemAnimal.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'A friendly animal companion',
        maxCount: 1
    },
    {
        id: 'item_dimensional_shackles',
        name: 'Dimensional Shackles',
        frontImage: '/assets/tokens/Token_Misc_ItemDimensionalShackles.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Magical restraints that prevent teleportation',
        maxCount: 1
    },
    {
        id: 'item_feywalk_amulet',
        name: 'Feywalk Amulet',
        frontImage: '/assets/tokens/Token_Misc_ItemFeywalkAmulet.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Amulet that allows passage through the Feywild',
        maxCount: 1
    },
    {
        id: 'item_food',
        name: 'Food',
        frontImage: '/assets/tokens/Token_Misc_ItemFood.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Rations that restore health',
        maxCount: 1
    },
    {
        id: 'item_gravestorms_phylactery',
        name: "Gravestorm's Phylactery",
        frontImage: '/assets/tokens/Token_Misc_ItemGravestormsPhylactery.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'The phylactery of the lich Gravestorm',
        maxCount: 1
    },
    {
        id: 'item_holy_water',
        name: 'Holy Water',
        frontImage: '/assets/tokens/Token_Misc_ItemHolyWater.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Blessed water that harms undead',
        maxCount: 1
    },
    {
        id: 'item_icon_of_ravenloft',
        name: 'Icon of Ravenloft',
        frontImage: '/assets/tokens/Token_Misc_ItemIconOfRavenloft.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Sacred icon sought in Scenario 1',
        maxCount: 1
    },
    {
        id: 'item_kavan',
        name: 'Kavan',
        frontImage: '/assets/tokens/Token_Misc_ItemKavan.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'A mysterious artifact',
        maxCount: 1
    },
    {
        id: 'item_mirror',
        name: 'Mirror',
        frontImage: '/assets/tokens/Token_Misc_ItemMirror.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Magical mirror with special properties',
        maxCount: 1
    },
    {
        id: 'item_portrait',
        name: 'Portrait',
        frontImage: '/assets/tokens/Token_Misc_ItemPortrait.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'An enchanted portrait',
        maxCount: 1
    },
    {
        id: 'item_silver_dagger',
        name: 'Silver Dagger',
        frontImage: '/assets/tokens/Token_Misc_ItemSilverDagger.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Silver weapon effective against lycanthropes',
        maxCount: 1
    },
    {
        id: 'item_skull',
        name: 'Skull',
        frontImage: '/assets/tokens/Token_Misc_ItemSkull.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'A mysterious skull artifact',
        maxCount: 1
    },
    {
        id: 'item_torch',
        name: 'Torch',
        frontImage: '/assets/tokens/Token_Misc_ItemTorch.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Light source for dark dungeons',
        maxCount: 1
    },
    {
        id: 'item_treasure',
        name: 'Treasure',
        frontImage: '/assets/tokens/Token_Misc_ItemTreasure.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Generic treasure marker',
        maxCount: 4
    },
    {
        id: 'item_wooden_stake',
        name: 'Wooden Stake',
        frontImage: '/assets/tokens/Token_Misc_ItemWoodenStake.png',
        backImage: '/assets/tokens/Token_Misc_ItemBack.png',
        type: 'item',
        description: 'Wooden stake for slaying vampires',
        maxCount: 1
    }
]

// Condition tokens (status effects)
export const CONDITION_TOKENS: TokenAsset[] = [
    {
        id: 'condition_immobilized',
        name: 'Immobilized',
        frontImage: '/assets/tokens/Token_Misc_ConditionImmobilized.png',
        backImage: '/assets/tokens/Token_Misc_ConditionBack.png',
        type: 'condition',
        description: 'Cannot move',
        maxCount: 5
    },
    {
        id: 'condition_slowed',
        name: 'Slowed',
        frontImage: '/assets/tokens/Token_Misc_ConditionSlowed.png',
        backImage: '/assets/tokens/Token_Misc_ConditionBack.png',
        type: 'condition',
        description: 'Movement reduced',
        maxCount: 5
    }
]

// HP tokens for tracking damage
export const HP_TOKENS: TokenAsset[] = [
    {
        id: 'hp_1',
        name: 'HP 1',
        frontImage: '/assets/tokens/Token_Misc_HP1.png',
        backImage: '/assets/tokens/Token_Misc_HP1Back.png',
        type: 'hp',
        description: '1 hit point damage marker',
        maxCount: 60
    },
    {
        id: 'hp_5',
        name: 'HP 5',
        frontImage: '/assets/tokens/Token_Misc_HP5.png',
        backImage: '/assets/tokens/Token_Misc_HP5Back.png',
        type: 'hp',
        description: '5 hit point damage marker',
        maxCount: 10
    },
    {
        id: 'monster_hp',
        name: 'Monster HP',
        frontImage: '/assets/tokens/Token_Misc_MonsterHP.png',
        backImage: '/assets/tokens/Token_Misc_MonsterHPBack.png',
        type: 'hp',
        description: 'Monster hit point tracker',
        maxCount: 10
    }
]

// Healing surge tokens
export const HEALING_SURGE_TOKENS: TokenAsset[] = [
    {
        id: 'healing_surge',
        name: 'Healing Surge',
        frontImage: '/assets/tokens/Token_Misc_HealingSurge.png',
        backImage: '/assets/tokens/Token_Misc_HealingSurgeBack.png',
        type: 'healing_surge',
        description: 'Healing surge resource',
        maxCount: 5
    }
]

// Reaction tokens (monster behavior)
export const REACTION_TOKENS: TokenAsset[] = [
    {
        id: 'reaction_calm',
        name: 'Calm',
        frontImage: '/assets/tokens/Token_Misc_ReactionCalm.png',
        backImage: '/assets/tokens/Token_Misc_ReactionBack.png',
        type: 'reaction',
        description: 'Monster is calm',
        maxCount: 3
    },
    {
        id: 'reaction_enrage',
        name: 'Enrage',
        frontImage: '/assets/tokens/Token_Misc_ReactionEnrage.png',
        backImage: '/assets/tokens/Token_Misc_ReactionBack.png',
        type: 'reaction',
        description: 'Monster is enraged',
        maxCount: 3
    }
]

// Marker tokens (special abilities)
export const MARKER_TOKENS: TokenAsset[] = [
    {
        id: 'marker_dragons_breath',
        name: "Dragon's Breath",
        frontImage: '/assets/tokens/Token_Misc_MarkerDragonsBreath.png',
        backImage: '/assets/tokens/Token_Misc_MarkerBack.png',
        type: 'marker',
        description: 'Dragon breath weapon area',
        maxCount: 1
    },
    {
        id: 'marker_mist_form',
        name: 'Mist Form',
        frontImage: '/assets/tokens/Token_Misc_MarkerMistForm.png',
        backImage: '/assets/tokens/Token_Misc_MarkerBack.png',
        type: 'marker',
        description: 'Vampire in mist form',
        maxCount: 1
    }
]

// Adventure tokens (scenario-specific)
export const ADVENTURE_TOKENS: TokenAsset[] = [
    {
        id: 'adventure_klaks_artifact',
        name: "Klak's Artifact",
        frontImage: '/assets/tokens/Token_Adventure_KlaksArtifact.png',
        backImage: '/assets/tokens/Token_AdventureBack.png',
        type: 'adventure',
        description: 'Quest objective for specific adventure',
        maxCount: 1
    }
]

// Miscellaneous tokens
export const MISC_TOKENS: TokenAsset[] = [
    {
        id: 'misc_time',
        name: 'Time Token',
        frontImage: '/assets/tokens/Token_Misc_Time.png',
        backImage: '/assets/tokens/Token_Misc_TimeBack.png',
        type: 'misc',
        description: 'Tracks time-based events',
        maxCount: 5
    },
    {
        id: 'misc_sun',
        name: 'Sun Token',
        frontImage: '/assets/tokens/Token_Misc_Sun.png',
        backImage: '/assets/tokens/Token_Misc_Sun.png',
        type: 'misc',
        description: 'Daylight marker',
        maxCount: 1
    },
    {
        id: 'misc_freezing_cloud',
        name: 'Freezing Cloud (Small)',
        frontImage: '/assets/tokens/Token_Misc_FreezingCloud.png',
        backImage: '/assets/tokens/Token_Misc_FreezingCloud.png',
        type: 'misc',
        description: 'Small freezing cloud marker',
        maxCount: 3
    }
]

// All tokens combined
export const ALL_TOKENS: TokenAsset[] = [
    ...COFFIN_TOKENS,
    ...MONSTER_TOKENS,
    ...ENCOUNTER_TOKENS,
    ...ITEM_TOKENS,
    ...CONDITION_TOKENS,
    ...HP_TOKENS,
    ...HEALING_SURGE_TOKENS,
    ...REACTION_TOKENS,
    ...MARKER_TOKENS,
    ...ADVENTURE_TOKENS,
    ...MISC_TOKENS
]

// Token map for quick lookup
export const TOKEN_MAP: Record<string, TokenAsset> = ALL_TOKENS.reduce((acc, token) => {
    acc[token.id] = token
    return acc
}, {} as Record<string, TokenAsset>)

/**
 * Get a token asset by ID
 */
export function getTokenAsset(tokenId: string): TokenAsset | undefined {
    return TOKEN_MAP[tokenId]
}

/**
 * Get all coffin tokens (for Scenario 1)
 */
export function getCoffinTokens(): TokenAsset[] {
    return COFFIN_TOKENS
}

/**
 * Get randomized coffin deck for scenario setup
 * Returns coffin token IDs with one marked as Strahd's
 */
export function generateCoffinDeck(count: number = 6): { tokenId: string; isStrahds: boolean }[] {
    const availableTokens = COFFIN_TOKENS.filter(t => t.id !== 'coffin_strahd')

    // Shuffle available tokens
    const shuffled = [...availableTokens].sort(() => Math.random() - 0.5)

    // Take (count - 1) random tokens
    const selected = shuffled.slice(0, count - 1)

    // Add Strahd's coffin
    const strahdToken = COFFIN_TOKENS.find(t => t.id === 'coffin_strahd')!
    selected.push(strahdToken)

    // Shuffle again so Strahd's position is random
    const finalDeck = selected.sort(() => Math.random() - 0.5)

    return finalDeck.map(token => ({
        tokenId: token.id,
        isStrahds: token.id === 'coffin_strahd'
    }))
}
