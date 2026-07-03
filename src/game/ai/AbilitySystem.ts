/**
 * AbilitySystem Core
 *
 * Pure static methods for monster ability execution.
 * No mutation. No side effects. Every function returns a new GameState or derived value.
 */

import {
    GameState,
    Monster,
    MonsterAbility,
    AbilityEffect,
    AbilityTarget,
    Entity,
    Hero,
    Tile,
    Direction
} from '../types';
import { findClosestHero } from '../engine/MonsterAI';
import { TileSystem } from '../engine/TileSystem';
import { DataLoader } from '../dataLoader';

/**
 * Pure static class for monster ability system.
 */
export class AbilitySystem {
    /**
     * Roll override for testing purposes.
     * Set to a function that returns a fixed roll value.
     * Reset to null after each test to restore normal behavior.
     */
    public static _rollOverride: (() => number) | null = null;

    /**
     * Roll a d20 (1-20).
     * Returns Math.floor(Math.random() * 20) + 1
     * Uses _rollOverride if set (for testing).
     */
    private static rollD20(): number {
        if (this._rollOverride) {
            return this._rollOverride();
        }
        return Math.floor(Math.random() * 20) + 1;
    }

    /**
     * Check if a monster can use an ability.
     * Returns false if:
     * - ability.currentCooldown > 0
     * - ability.remainingUses is defined AND <= 0
     * - ability.type === 'passive' (passives are never manually activated)
     * Returns true otherwise.
     */
    public static canUseAbility(
        ability: MonsterAbility,
        monster: Monster,
        gameState: GameState
    ): boolean {
        // Check cooldown
        if (ability.currentCooldown !== undefined && ability.currentCooldown > 0) {
            return false;
        }

        // Check remaining uses
        if (ability.remainingUses !== undefined && ability.remainingUses <= 0) {
            return false;
        }

        // Passive abilities are never manually activated
        if (ability.type === 'passive') {
            return false;
        }

        return true;
    }

    /**
     * Get target entities for an ability effect.
     * Maps AbilityTarget values to entity arrays.
     */
    public static getAbilityTargets(
        effect: AbilityEffect,
        monster: Monster,
        gameState: GameState
    ): Entity[] {
        // Get the monster's current tile
        const monsterTile = gameState.tiles.find(
            t => t.x === monster.position.x && t.z === monster.position.z
        );

        if (!monsterTile) {
            return [];
        }

        switch (effect.target) {
            case 'self':
                return [monster];

            case 'closest_hero': {
                const closest = findClosestHero(monsterTile, gameState.heroes, gameState.tiles);
                return closest ? [closest.hero] : [];
            }

            case 'all_heroes':
                return gameState.heroes;

            case 'adjacent_heroes': {
                const adjacentTiles = [monsterTile, ...TileSystem.getAdjacentTiles(monsterTile, gameState.tiles)];
                const adjacentHeroes: Hero[] = [];
                for (const tile of adjacentTiles) {
                    for (const heroId of tile.heroes) {
                        const hero = gameState.heroes.find(h => h.id === heroId);
                        if (hero) {
                            adjacentHeroes.push(hero);
                        }
                    }
                }
                return adjacentHeroes;
            }

            case 'random_hero':
                if (gameState.heroes.length === 0) {
                    return [];
                }
                const randomIndex = Math.floor(Math.random() * gameState.heroes.length);
                return [gameState.heroes[randomIndex]];

            case 'all_monsters':
                return gameState.monsters;

            case 'adjacent_monsters': {
                const adjacentTiles = [monsterTile, ...TileSystem.getAdjacentTiles(monsterTile, gameState.tiles)];
                const adjacentMonsters: Monster[] = [];
                for (const tile of adjacentTiles) {
                    for (const monsterId of tile.monsters) {
                        if (monsterId === monster.id) {
                            continue;
                        }
                        const m = gameState.monsters.find(mon => mon.id === monsterId);
                        if (m) {
                            adjacentMonsters.push(m);
                        }
                    }
                }
                return adjacentMonsters;
            }

            case 'tile': {
                const tileHeroes: Hero[] = [];
                for (const heroId of monsterTile.heroes) {
                    const hero = gameState.heroes.find(h => h.id === heroId);
                    if (hero) {
                        tileHeroes.push(hero);
                    }
                }
                return tileHeroes;
            }

            default:
                return [];
        }
    }

    /**
     * Apply an ability effect to targets.
     * Handles damage, heal, teleport, push effects.
     * Condition and summon effects log a warning and return state unchanged.
     */
    public static applyAbilityEffect(
        effect: AbilityEffect,
        source: Monster,
        targets: Entity[],
        gameState: GameState
    ): GameState {
        if (targets.length === 0) {
            return gameState;
        }

        switch (effect.type) {
            case 'damage': {
                const damageValue = effect.value ?? 1;
                return {
                    ...gameState,
                    heroes: gameState.heroes.map(hero => {
                        const target = targets.find(t => t.id === hero.id);
                        if (target) {
                            return {
                                ...hero,
                                hp: Math.max(0, hero.hp - damageValue)
                            };
                        }
                        return hero;
                    }),
                    monsters: gameState.monsters.map(monster => {
                        const target = targets.find(t => t.id === monster.id);
                        if (target) {
                            return {
                                ...monster,
                                hp: Math.max(0, monster.hp - damageValue)
                            };
                        }
                        return monster;
                    })
                };
            }

            case 'heal': {
                const healValue = effect.value ?? 1;
                return {
                    ...gameState,
                    heroes: gameState.heroes.map(hero => {
                        const target = targets.find(t => t.id === hero.id);
                        if (target) {
                            return {
                                ...hero,
                                hp: Math.min(hero.maxHp, hero.hp + healValue)
                            };
                        }
                        return hero;
                    }),
                    monsters: gameState.monsters.map(monster => {
                        const target = targets.find(t => t.id === monster.id);
                        if (target) {
                            const newHp = Math.min(monster.maxHp, monster.hp + healValue);
                            return {
                                ...monster,
                                hp: newHp,
                                isDefeated: newHp > 0 ? false : monster.isDefeated
                            };
                        }
                        return monster;
                    })
                };
            }

            case 'teleport': {
                // Teleport: move source monster to target entity's tile
                // Only valid when target is a hero
                const heroTarget = targets.find(t => t.type === 'hero') as Hero | undefined;
                if (!heroTarget) {
                    return gameState;
                }

                return {
                    ...gameState,
                    monsters: gameState.monsters.map(monster => {
                        if (monster.id === source.id) {
                            return {
                                ...monster,
                                position: { ...heroTarget.position }
                            };
                        }
                        return monster;
                    })
                };
            }

            case 'push': {
                // Push: move target hero 1 tile directly away from source
                const pushValue = effect.value ?? 1;
                return {
                    ...gameState,
                    heroes: gameState.heroes.map(hero => {
                        const target = targets.find(t => t.id === hero.id) as Hero | undefined;
                        if (target) {
                            // Determine direction from source to target
                            let direction: Direction = 'north';
                            if (target.position.x > source.position.x) {
                                direction = 'east';
                            } else if (target.position.x < source.position.x) {
                                direction = 'west';
                            } else if (target.position.z > source.position.z) {
                                direction = 'south';
                            } else if (target.position.z < source.position.z) {
                                direction = 'north';
                            }

                            // Apply push multiple times based on value
                            let newPosition = { ...target.position };
                            for (let i = 0; i < pushValue; i++) {
                                newPosition = TileSystem.getTargetPosition(newPosition, direction);
                            }

                            return {
                                ...hero,
                                position: newPosition
                            };
                        }
                        return hero;
                    })
                };
            }

            case 'condition': {
                // Apply a status condition to each target entity.
                // effect.condition holds the ConditionType string (e.g. 'stunned', 'slowed').
                // effect.duration overrides the default duration of 1 turn.
                const condType = effect.condition as import('../types').ConditionType | undefined;
                if (!condType) {
                    console.warn(`AbilitySystem: condition effect missing 'condition' field`);
                    return gameState;
                }
                const condDuration = effect.duration ?? 1;
                let condState = gameState;
                condState = {
                    ...condState,
                    heroes: condState.heroes.map(hero => {
                        if (!targets.find(t => t.id === hero.id)) return hero;
                        const existing = hero.conditions.find(c => c.type === condType);
                        if (existing) {
                            // Refresh duration
                            return {
                                ...hero,
                                conditions: hero.conditions.map(c =>
                                    c.type === condType ? { ...c, turnsRemaining: condDuration, sourceId: source.id } : c
                                )
                            };
                        }
                        return {
                            ...hero,
                            conditions: [...hero.conditions, { type: condType, turnsRemaining: condDuration, sourceId: source.id }]
                        };
                    }),
                    monsters: condState.monsters.map(monster => {
                        if (!targets.find(t => t.id === monster.id)) return monster;
                        if (monster.id === source.id) return monster; // Don't self-apply by accident from 'all_monsters'
                        const existing = monster.conditions.find(c => c.type === condType);
                        if (existing) {
                            return {
                                ...monster,
                                conditions: monster.conditions.map(c =>
                                    c.type === condType ? { ...c, turnsRemaining: condDuration, sourceId: source.id } : c
                                )
                            };
                        }
                        return {
                            ...monster,
                            conditions: [...monster.conditions, { type: condType, turnsRemaining: condDuration, sourceId: source.id }]
                        };
                    })
                };
                return condState;
            }

            case 'summon': {
                // Summon a monster from a template, placing it on the source monster's tile.
                // effect.monsterId must be set to the template data ID (e.g. 'monster_skeleton').
                // effect.value controls the number of monsters to spawn (default 1).
                const templateId = effect.monsterId;
                if (!templateId) {
                    console.warn(`AbilitySystem: summon effect missing 'monsterId' field on source ${source.name}`);
                    return gameState;
                }
                const template = DataLoader.getInstance().getMonsterById(templateId);
                if (!template) {
                    console.warn(`AbilitySystem: summon could not find monster template '${templateId}'`);
                    return gameState;
                }

                const spawnCount = effect.value ?? 1;
                const sourceTile = gameState.tiles.find(t => t.x === source.position.x && t.z === source.position.z);
                if (!sourceTile) return gameState;

                const spawnPosition = {
                    x: sourceTile.x,
                    z: sourceTile.z,
                    sqX: sourceTile.boneSquare?.sqX ?? 2,
                    sqZ: sourceTile.boneSquare?.sqZ ?? 2,
                };

                const newMonsters: Monster[] = [];
                for (let i = 0; i < spawnCount; i++) {
                    const uniqueId = `${templateId}_summoned_${Date.now()}_${i}`;
                    newMonsters.push({
                        ...template,
                        id: uniqueId,
                        templateId,
                        position: spawnPosition,
                        hp: template.maxHp ?? template.hp,
                        conditions: [],
                        usedPowers: [],
                        ownedByHeroId: source.ownedByHeroId,
                        isBoss: false,
                        isDefeated: false,
                        isExhausted: false,
                    } as Monster);
                }

                // Place the new monster IDs onto the tile's monsters list
                const updatedTiles = gameState.tiles.map(t =>
                    t.id === sourceTile.id
                        ? { ...t, monsters: [...t.monsters, ...newMonsters.map(m => m.id)] }
                        : t
                );

                return {
                    ...gameState,
                    monsters: [...gameState.monsters, ...newMonsters],
                    tiles: updatedTiles,
                };
            }

            case 'move': {
                // Move the source monster by `effect.value` squares toward the closest hero.
                // Pure positional update — no pathfinding through walls (matches board game simplicity).
                const moveSteps = effect.value ?? 1;
                const closestResult = findClosestHero(
                    gameState.tiles.find(t => t.x === source.position.x && t.z === source.position.z)!,
                    gameState.heroes,
                    gameState.tiles
                );
                if (!closestResult) return gameState;

                let newPos = { ...source.position };
                for (let i = 0; i < moveSteps; i++) {
                    const dx = closestResult.hero.position.x - newPos.x;
                    const dz = closestResult.hero.position.z - newPos.z;
                    if (dx === 0 && dz === 0) break;
                    if (Math.abs(dx) >= Math.abs(dz)) {
                        newPos = { ...newPos, x: newPos.x + Math.sign(dx) };
                    } else {
                        newPos = { ...newPos, z: newPos.z + Math.sign(dz) };
                    }
                }

                return {
                    ...gameState,
                    monsters: gameState.monsters.map(m =>
                        m.id === source.id ? { ...m, position: newPos } : m
                    )
                };
            }

            case 'buff': {
                // Buff: Apply a positive condition to the source monster.
                // effect.condition specifies the ConditionType (e.g. 'attack_bonus', 'ac_bonus').
                // effect.value is the numeric bonus amount.
                // effect.duration is how many turns the buff lasts (default 1).
                const buffType = effect.condition as import('../types').ConditionType | undefined;
                if (!buffType) {
                    // Generic buff with no specific condition (e.g. pack_hunter passive) — no-op state change needed
                    return gameState;
                }
                const buffDuration = effect.duration ?? 1;
                const buffValue = effect.value ?? 1;
                return {
                    ...gameState,
                    monsters: gameState.monsters.map(m => {
                        if (m.id !== source.id) return m;
                        const existing = m.conditions.find(c => c.type === buffType);
                        if (existing) {
                            return {
                                ...m,
                                conditions: m.conditions.map(c =>
                                    c.type === buffType ? { ...c, turnsRemaining: buffDuration, value: (c.value ?? 0) + buffValue } : c
                                )
                            };
                        }
                        return {
                            ...m,
                            conditions: [...m.conditions, { type: buffType, turnsRemaining: buffDuration, value: buffValue, sourceId: source.id }]
                        };
                    })
                };
            }

            case 'debuff': {
                // Debuff: Apply a negative condition to target entities.
                // effect.condition specifies the ConditionType (e.g. 'weakened', 'slowed').
                // effect.duration is how many turns the debuff lasts (default 1).
                const debuffType = effect.condition as import('../types').ConditionType | undefined;
                if (!debuffType) {
                    console.warn(`AbilitySystem: debuff effect missing 'condition' field on source ${source.name}`);
                    return gameState;
                }
                const debuffDuration = effect.duration ?? 1;
                return {
                    ...gameState,
                    heroes: gameState.heroes.map(hero => {
                        if (!targets.find(t => t.id === hero.id)) return hero;
                        const existing = hero.conditions.find(c => c.type === debuffType);
                        if (existing) {
                            return {
                                ...hero,
                                conditions: hero.conditions.map(c =>
                                    c.type === debuffType ? { ...c, turnsRemaining: debuffDuration, sourceId: source.id } : c
                                )
                            };
                        }
                        return {
                            ...hero,
                            conditions: [...hero.conditions, { type: debuffType, turnsRemaining: debuffDuration, sourceId: source.id }]
                        };
                    }),
                    monsters: gameState.monsters.map(monster => {
                        if (!targets.find(t => t.id === monster.id) || monster.id === source.id) return monster;
                        const existing = monster.conditions.find(c => c.type === debuffType);
                        if (existing) {
                            return {
                                ...monster,
                                conditions: monster.conditions.map(c =>
                                    c.type === debuffType ? { ...c, turnsRemaining: debuffDuration, sourceId: source.id } : c
                                )
                            };
                        }
                        return {
                            ...monster,
                            conditions: [...monster.conditions, { type: debuffType, turnsRemaining: debuffDuration, sourceId: source.id }]
                        };
                    })
                };
            }

            case 'pull': {
                // Pull: move target heroes toward the source monster by `effect.value` tiles.
                // Opposite of 'push': direction is from target toward source.
                const pullValue = effect.value ?? 1;
                return {
                    ...gameState,
                    heroes: gameState.heroes.map(hero => {
                        const target = targets.find(t => t.id === hero.id) as Hero | undefined;
                        if (!target) return hero;

                        // Determine direction from target toward source
                        let direction: Direction = 'north';
                        if (source.position.x > target.position.x) {
                            direction = 'east';
                        } else if (source.position.x < target.position.x) {
                            direction = 'west';
                        } else if (source.position.z > target.position.z) {
                            direction = 'south';
                        } else if (source.position.z < target.position.z) {
                            direction = 'north';
                        }

                        let newPosition = { ...target.position };
                        for (let i = 0; i < pullValue; i++) {
                            const candidate = TileSystem.getTargetPosition(newPosition, direction);
                            // Stop pulling if we would land on the same tile as the source
                            if (candidate.x === source.position.x && candidate.z === source.position.z) {
                                newPosition = candidate;
                                break;
                            }
                            newPosition = candidate;
                        }

                        return { ...hero, position: newPosition };
                    })
                };
            }

            default:
                console.warn(`AbilitySystem: Unknown effect type ${effect.type}`);
                return gameState;
        }
    }

    /**
     * Execute a monster ability.
     * Processes all effects, handles roll conditions, updates cooldowns and uses.
     */
    public static executeAbility(
        ability: MonsterAbility,
        monster: Monster,
        gameState: GameState
    ): GameState {
        let state = gameState;

        // Process each effect in sequence
        for (const effect of ability.effects) {
            // Get targets for this effect
            const targets = this.getAbilityTargets(effect, monster, state);

            // Check roll condition if present
            if (effect.condition === 'roll_15_plus') {
                const roll = this.rollD20();
                if (roll < 15) {
                    continue; // Skip this effect if roll fails
                }
            } else if (effect.condition === 'roll_undying') {
                const roll = this.rollD20();
                const threshold = (monster.id.includes('zombie') || monster.name.toLowerCase() === 'zombie') ? 11 : 15;
                if (roll < threshold) {
                    continue; // Skip this effect if roll fails
                }
            }

            // Apply the effect
            state = this.applyAbilityEffect(effect, monster, targets, state);
        }

        // Update cooldown
        const cooldownValue = ability.cooldown ?? 0;
        state = {
            ...state,
            monsters: state.monsters.map(m => {
                if (m.id === monster.id && m.abilities) {
                    return {
                        ...m,
                        abilities: m.abilities.map(ab => {
                            if (ab.id === ability.id) {
                                return {
                                    ...ab,
                                    currentCooldown: cooldownValue
                                };
                            }
                            return ab;
                        })
                    };
                }
                return m;
            })
        };

        // Decrement remaining uses if defined
        if (ability.remainingUses !== undefined) {
            state = {
                ...state,
                monsters: state.monsters.map(m => {
                    if (m.id === monster.id && m.abilities) {
                        return {
                            ...m,
                            abilities: m.abilities.map(ab => {
                                if (ab.id === ability.id) {
                                    return {
                                        ...ab,
                                        remainingUses: ab.remainingUses! - 1
                                    };
                                }
                                return ab;
                            })
                        };
                    }
                    return m;
                })
            };
        }

        return state;
    }

    /**
     * Process cooldowns for a monster's abilities.
     * Returns new GameState where the given monster's abilities each have
     * currentCooldown decremented by 1, minimum 0.
     */
    public static processCooldowns(
        monster: Monster,
        gameState: GameState
    ): GameState {
        if (!monster.abilities) {
            return gameState;
        }

        return {
            ...gameState,
            monsters: gameState.monsters.map(m => {
                if (m.id === monster.id && m.abilities) {
                    return {
                        ...m,
                        abilities: m.abilities.map(ability => {
                            const currentCooldown = ability.currentCooldown ?? 0;
                            return {
                                ...ability,
                                currentCooldown: Math.max(0, currentCooldown - 1)
                            };
                        })
                    };
                }
                return m;
            })
        };
    }
}

export default AbilitySystem;
