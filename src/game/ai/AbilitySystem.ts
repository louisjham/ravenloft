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

/**
 * Pure static class for monster ability system.
 */
export class AbilitySystem {
    /**
     * Roll a d20 (1-20).
     * Returns Math.floor(Math.random() * 20) + 1
     */
    private static rollD20(): number {
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
                const adjacentTiles = TileSystem.getAdjacentTiles(monsterTile, gameState.tiles);
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
                const adjacentTiles = TileSystem.getAdjacentTiles(monsterTile, gameState.tiles);
                const adjacentMonsters: Monster[] = [];
                for (const tile of adjacentTiles) {
                    for (const monsterId of tile.monsters) {
                        const m = gameState.monsters.find(mon => mon.id === monsterId);
                        if (m) {
                            adjacentMonsters.push(m);
                        }
                    }
                }
                return adjacentMonsters;
            }

            case 'tile':
                // Tile target - returns empty array for now as it's not a direct entity target
                return [];

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
                            return {
                                ...monster,
                                hp: Math.min(monster.maxHp, monster.hp + healValue)
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

            case 'condition':
            case 'summon':
                // Log warning and return state unchanged - implement in a later pass
                console.warn(`AbilitySystem: ${effect.type} effect not yet implemented`);
                return gameState;

            case 'move':
            case 'buff':
            case 'debuff':
            case 'pull':
                // Log warning for other unimplemented effect types
                console.warn(`AbilitySystem: ${effect.type} effect not yet implemented`);
                return gameState;

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
