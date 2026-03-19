import { Card, EncounterType, Entity, GameState, Hero, Trap } from '../types';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';

/**
 * Encounter System - Manages Environment, Event, and Trap cards
 * 
 * Rules from BoardGameRulesChecklist.md:
 * - Environment Cards: Major change in dungeon crypts, effects apply to all Heroes, only one at a time
 * - Event Cards: Strange occurrence, takes place when drawn, then discarded
 * - Event-Attack Cards: Red cards with attack roll against Heroes
 * - Trap Cards: Snare/mechanical device, activates during Villain Phase like Monster
 */
export class EncounterSystem {
    /**
     * Draws an encounter card during exploration phase
     */
    public static drawEncounterCard(gameState: GameState): { card: Card | null; message: string } {
        if (gameState.encounterDeck.length === 0) {
            return { card: null, message: 'Encounter deck is empty' };
        }

        const cardId = gameState.encounterDeck.pop();
        if (!cardId) {
            return { card: null, message: 'Failed to draw encounter card' };
        }

        // In a real implementation, we'd look up the card from DataLoader
        // For now, we'll return a placeholder
        const card: Card = {
            id: cardId,
            type: 'encounter',
            name: 'Encounter',
            description: 'An encounter occurs',
            effects: []
        };

        return { card, message: `Drew encounter card: ${card.name}` };
    }

    /**
     * Processes an environment card
     * Environment cards apply to all heroes and only one can be active at a time
     */
    public static processEnvironmentCard(
        gameState: GameState,
        card: Card
    ): { success: boolean; message: string } {
        // If there's already an active environment card, discard it
        if (gameState.activeEnvironmentCard) {
            console.log(`[EncounterSystem] Discarding previous environment card: ${gameState.activeEnvironmentCard}`);
        }

        // Set the new active environment card
        gameState.activeEnvironmentCard = card.id;

        // Apply environment effects to all heroes
        for (const hero of gameState.heroes) {
            for (const effect of card.effects) {
                this.applyEffect(effect, hero, null, gameState);
            }
        }

        return {
            success: true,
            message: `Environment card ${card.name} is now active. Effects apply to all heroes.`
        };
    }

    /**
     * Processes an event card
     * Event cards take effect immediately and are then discarded
     */
    public static processEventCard(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string } {
        // Apply event effects
        for (const effect of card.effects) {
            this.applyEffect(effect, activeHero, null, gameState);
        }

        // Add to discard pile
        if (!gameState.discardPiles['encounter']) {
            gameState.discardPiles['encounter'] = [];
        }
        gameState.discardPiles['encounter'].push(card.id);

        return {
            success: true,
            message: `Event card ${card.name} resolved and discarded.`
        };
    }

    /**
     * Processes an event-attack card
     * Event-attack cards make an attack roll against heroes
     */
    public static processEventAttackCard(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string; results: any[] } {
        const results: any[] = [];

        // Event-attack cards typically target the active hero or all heroes
        for (const effect of card.effects) {
            if (effect.type === 'damage') {
                // Make an attack roll
                const attackBonus = effect.attackBonus || 7; // Default +7 for traps/events
                const damage = effect.value || 1;

                if (effect.target === 'all_heroes') {
                    // Attack all heroes
                    for (const hero of gameState.heroes) {
                        const result = CombatSystem.resolveAttack(
                            { id: 'event', name: card.name, type: 'monster', hp: 0, maxHp: 0, ac: 0, speed: 0, isExhausted: false, position: hero.position, conditions: [], usedPowers: [] },
                            hero,
                            attackBonus,
                            damage
                        );
                        if (result.hit) {
                            CombatSystem.applyDamage(hero, result.damage);
                        }
                        results.push({ heroId: hero.id, hit: result.hit, damage: result.damage });
                    }
                } else {
                    // Attack active hero
                    const result = CombatSystem.resolveAttack(
                        { id: 'event', name: card.name, type: 'monster', hp: 0, maxHp: 0, ac: 0, speed: 0, isExhausted: false, position: activeHero.position, conditions: [], usedPowers: [] },
                        activeHero,
                        attackBonus,
                        damage
                    );
                    if (result.hit) {
                        CombatSystem.applyDamage(activeHero, result.damage);
                    }
                    results.push({ heroId: activeHero.id, hit: result.hit, damage: result.damage });
                }
            } else {
                // Apply other effects
                this.applyEffect(effect, activeHero, null, gameState);
            }
        }

        // Add to discard pile
        if (!gameState.discardPiles['encounter']) {
            gameState.discardPiles['encounter'] = [];
        }
        gameState.discardPiles['encounter'].push(card.id);

        return {
            success: true,
            message: `Event-attack card ${card.name} resolved.`,
            results
        };
    }

    /**
     * Places a trap on the active hero's tile
     */
    public static placeTrap(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string; trap?: Trap } {
        // Check if there's already a trap on this tile
        const existingTrap = gameState.traps.find(t => t.tileId === activeHero.position.x + ',' + activeHero.position.z);
        if (existingTrap) {
            // Discard this trap and draw another encounter card
            if (!gameState.discardPiles['encounter']) {
                gameState.discardPiles['encounter'] = [];
            }
            gameState.discardPiles['encounter'].push(card.id);
            return {
                success: false,
                message: 'A trap already exists on this tile. Drawing another encounter card.'
            };
        }

        // Create the trap
        const trap: Trap = {
            id: `trap_${Date.now()}`,
            cardId: card.id,
            tileId: activeHero.position.x + ',' + activeHero.position.z,
            position: activeHero.position,
            disabled: false,
            ownedByHeroId: activeHero.id,
            isTriggered: false
        };

        gameState.traps.push(trap);

        return {
            success: true,
            message: `Trap ${card.name} placed on tile.`,
            trap
        };
    }

    /**
     * Activates a trap during the Villain Phase
     */
    public static activateTrap(
        gameState: GameState,
        trap: Trap,
        card: Card
    ): { success: boolean; message: string; results: any[] } {
        if (trap.disabled) {
            return { success: false, message: 'Trap is disabled', results: [] };
        }

        const results: any[] = [];

        // Find heroes on the trap's tile
        const heroesOnTile = gameState.heroes.filter(h =>
            h.position.x === trap.position?.x && h.position.z === trap.position?.z
        );

        for (const hero of heroesOnTile) {
            for (const effect of card.effects) {
                if (effect.type === 'damage') {
                    const attackBonus = effect.attackBonus || 7;
                    const damage = effect.value || 1;

                    const result = CombatSystem.resolveAttack(
                        { id: 'trap', name: card.name, type: 'monster', hp: 0, maxHp: 0, ac: 0, speed: 0, isExhausted: false, position: hero.position, conditions: [], usedPowers: [] },
                        hero,
                        attackBonus,
                        damage
                    );
                    if (result.hit) {
                        CombatSystem.applyDamage(hero, result.damage);
                    }
                    results.push({ heroId: hero.id, hit: result.hit, damage: result.damage });
                } else if (effect.type === 'status_effect' && effect.statusEffect) {
                    ConditionSystem.applyCondition(hero, effect.statusEffect as any, trap.id, effect.duration || 1);
                    results.push({ heroId: hero.id, statusEffect: effect.statusEffect });
                }
            }
        }

        return {
            success: true,
            message: `Trap ${card.name} activated.`,
            results
        };
    }

    /**
     * Attempts to disable a trap
     * Hero must be on the same tile as the trap
     */
    public static attemptDisableTrap(
        gameState: GameState,
        hero: Hero,
        trap: Trap,
        card: Card
    ): { success: boolean; message: string; disabled: boolean } {
        // Check if hero is on the trap's tile
        if (hero.position.x !== trap.position?.x || hero.position.z !== trap.position?.z) {
            return {
                success: false,
                message: 'Hero must be on the same tile as the trap to disable it.',
                disabled: false
            };
        }

        // Roll to disable
        const roll = Math.floor(Math.random() * 20) + 1;
        const disableDC = card.disableDC || 10; // Default DC if not specified

        if (roll >= disableDC) {
            // Disable the trap
            trap.disabled = true;

            // Remove trap from game state
            gameState.traps = gameState.traps.filter(t => t.id !== trap.id);

            // Add to discard pile
            if (!gameState.discardPiles['encounter']) {
                gameState.discardPiles['encounter'] = [];
            }
            gameState.discardPiles['encounter'].push(card.id);

            return {
                success: true,
                message: `${hero.name} disabled the trap! (Roll: ${roll}, DC: ${disableDC})`,
                disabled: true
            };
        } else {
            return {
                success: false,
                message: `${hero.name} failed to disable the trap. (Roll: ${roll}, DC: ${disableDC})`,
                disabled: false
            };
        }
    }

    /**
     * Applies an effect from an encounter card
     */
    private static applyEffect(
        effect: any,
        hero: Hero,
        target: Entity | null,
        gameState: GameState
    ): void {
        switch (effect.type) {
            case 'damage':
                if (effect.value) {
                    CombatSystem.applyDamage(hero, effect.value);
                }
                break;

            case 'heal':
                if (effect.value) {
                    CombatSystem.applyHealing(hero, effect.value);
                }
                break;

            case 'status_effect':
                if (effect.statusEffect) {
                    ConditionSystem.applyCondition(hero, effect.statusEffect as any, 'encounter', effect.duration || 1);
                }
                break;

            case 'move':
                // Move hero - would need to integrate with movement system
                break;

            default:
                console.log(`[EncounterSystem] Unknown effect type: ${effect.type}`);
        }
    }

    /**
     * Gets the active environment card
     */
    public static getActiveEnvironmentCard(gameState: GameState): string | null {
        return gameState.activeEnvironmentCard;
    }

    /**
     * Removes the active environment card
     */
    public static removeEnvironmentCard(gameState: GameState): void {
        if (gameState.activeEnvironmentCard) {
            if (!gameState.discardPiles['encounter']) {
                gameState.discardPiles['encounter'] = [];
            }
            gameState.discardPiles['encounter'].push(gameState.activeEnvironmentCard);
            gameState.activeEnvironmentCard = null;
        }
    }
}
