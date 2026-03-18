import { Card, GameState, Hero, TreasureType } from '../types';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';
import { PowerSystem } from './PowerSystem';

/**
 * Treasure System - Manages Blessings, Fortunes, and Items
 * 
 * Rules from BoardGameRulesChecklist.md:
 * - Blessings: Played immediately, last until end of next turn, benefit all Heroes
 * - Fortunes: Played immediately, provide immediate benefit, discard immediately
 * - Items: Provide lasting benefit, decide which Hero gets it when drawn
 */
export class TreasureSystem {
    /**
     * Draws a treasure card
     * Only one treasure per turn maximum
     */
    public static drawTreasureCard(
        gameState: GameState,
        hero: Hero
    ): { card: Card | null; message: string } {
        // Check if treasure already drawn this turn
        if (gameState.treasuresDrawnThisTurn >= 1) {
            return {
                card: null,
                message: 'Already drawn a treasure card this turn. Maximum one per turn.'
            };
        }

        if (gameState.treasureDeck.length === 0) {
            return { card: null, message: 'Treasure deck is empty' };
        }

        const cardId = gameState.treasureDeck.pop();
        if (!cardId) {
            return { card: null, message: 'Failed to draw treasure card' };
        }

        // Increment treasures drawn this turn
        gameState.treasuresDrawnThisTurn++;

        // In a real implementation, we'd look up card from DataLoader
        // For now, we'll return a placeholder
        const card: Card = {
            id: cardId,
            type: 'treasure',
            name: 'Treasure',
            description: 'A valuable item',
            effects: [],
            treasureType: 'item'
        };

        return { card, message: `${hero.name} draws treasure: ${card.name}` };
    }

    /**
     * Uses a blessing treasure card
     * Blessings are played immediately and last until end of next turn
     */
    public static useBlessing(
        gameState: GameState,
        card: Card,
        hero: Hero
    ): { success: boolean; message: string } {
        if (card.treasureType !== 'blessing') {
            return { success: false, message: 'Not a blessing card' };
        }

        // Apply blessing effects to all heroes
        for (const h of gameState.heroes) {
            for (const effect of card.effects) {
                this.applyEffect(effect, h, null, gameState);
            }
        }

        // Add to discard pile
        if (!gameState.discardPiles['treasure']) {
            gameState.discardPiles['treasure'] = [];
        }
        gameState.discardPiles['treasure'].push(card.id);

        return {
            success: true,
            message: `Blessing ${card.name} activated. Effects apply to all heroes until end of next turn.`
        };
    }

    /**
     * Uses a fortune treasure card
     * Fortunes are played immediately, provide immediate benefit, and are discarded
     */
    public static useFortune(
        gameState: GameState,
        card: Card,
        hero: Hero
    ): { success: boolean; message: string } {
        if (card.treasureType !== 'fortune') {
            return { success: false, message: 'Not a fortune card' };
        }

        // Apply fortune effects
        let hasEffect = false;
        for (const effect of card.effects) {
            const result = this.applyEffect(effect, hero, null, gameState);
            if (result) {
                hasEffect = true;
            }
        }

        // Add to discard pile
        if (!gameState.discardPiles['treasure']) {
            gameState.discardPiles['treasure'] = [];
        }
        gameState.discardPiles['treasure'].push(card.id);

        if (hasEffect) {
            return {
                success: true,
                message: `Fortune ${card.name} used and discarded.`
            };
        } else {
            return {
                success: true,
                message: `Fortune ${card.name} used but had no effect.`
            };
        }
    }

    /**
     * Assigns an item treasure card to a hero
     * Items provide lasting benefit
     */
    public static assignItem(
        gameState: GameState,
        card: Card,
        hero: Hero
    ): { success: boolean; message: string } {
        if (card.treasureType !== 'item') {
            return { success: false, message: 'Not an item card' };
        }

        // Add item to hero's items
        hero.items.push(card.id);

        // Add to discard pile (items are tracked in hero.items)
        if (!gameState.discardPiles['treasure']) {
            gameState.discardPiles['treasure'] = [];
        }
        gameState.discardPiles['treasure'].push(card.id);

        return {
            success: true,
            message: `Item ${card.name} assigned to ${hero.name}.`
        };
    }

    /**
     * Uses an item treasure card
     * Some items can be used (like consumables), others provide passive bonuses
     */
    public static useItem(
        gameState: GameState,
        card: Card,
        hero: Hero,
        target: any = null
    ): { success: boolean; message: string } {
        if (card.treasureType !== 'item') {
            return { success: false, message: 'Not an item card' };
        }

        if (!hero.items.includes(card.id)) {
            return { success: false, message: 'Hero does not own this item' };
        }

        // Apply item effects
        for (const effect of card.effects) {
            if (effect.type === 'passive') {
                // Passive items don't need to be "used" - they provide constant bonuses
                continue;
            } else {
                this.applyEffect(effect, hero, target, gameState);
            }
        }

        // Check if item is consumable (should be removed after use)
        const isConsumable = card.type === 'consumable';
        if (isConsumable) {
            hero.items = hero.items.filter(id => id !== card.id);
        }

        return {
            success: true,
            message: `Item ${card.name} used by ${hero.name}.${isConsumable ? ' Item consumed.' : ''}`
        };
    }

    /**
     * Checks if a hero can benefit from a specific item
     * Used to check passive bonuses
     */
    public static getHeroItemBonuses(hero: Hero, allCards: Card[]): any {
        const bonuses: any = {
            attackBonus: 0,
            defenseBonus: 0,
            damageBonus: 0,
            specialAbilities: []
        };

        for (const itemId of hero.items) {
            const card = allCards.find(c => c.id === itemId);
            if (!card) continue;

            for (const effect of card.effects) {
                if (effect.type === 'attack_bonus') {
                    bonuses.attackBonus += effect.value || 0;
                } else if (effect.type === 'defense_bonus') {
                    bonuses.defenseBonus += effect.value || 0;
                } else if (effect.type === 'passive') {
                    bonuses.specialAbilities.push(effect.passiveType);
                }
            }
        }

        return bonuses;
    }

    /**
     * Gets effective stats for a hero including item bonuses
     */
    public static getEffectiveStats(hero: Hero, allCards: Card[]): {
        ac: number;
        attackBonus: number;
        damage: number;
    } {
        const bonuses = this.getHeroItemBonuses(hero, allCards);

        return {
            ac: hero.ac + bonuses.defenseBonus,
            attackBonus: bonuses.attackBonus,
            damage: bonuses.damageBonus
        };
    }

    /**
     * Checks if a hero has a specific passive ability from items
     */
    public static hasPassiveAbility(hero: Hero, abilityType: string, allCards: Card[]): boolean {
        const bonuses = this.getHeroItemBonuses(hero, allCards);
        return bonuses.specialAbilities.includes(abilityType);
    }

    /**
     * Applies an effect from a treasure card
     */
    private static applyEffect(
        effect: any,
        hero: Hero,
        target: any,
        gameState: GameState
    ): boolean {
        switch (effect.type) {
            case 'damage':
                if (target) {
                    CombatSystem.applyDamage(target, effect.value || 0);
                    return true;
                }
                return false;

            case 'heal':
                if (effect.value) {
                    CombatSystem.applyHealing(hero, effect.value);
                    return true;
                }
                return false;

            case 'status_effect':
                if (target && effect.statusEffect) {
                    ConditionSystem.applyCondition(target, effect.statusEffect as any, hero.id, effect.duration || 1);
                    return true;
                }
                return false;

            case 'flip_power':
                // Reset a daily/utility power
                if (effect.value) {
                    PowerSystem.resetPower(hero, effect.value);
                    return true;
                }
                return false;

            case 'draw_card':
                // Draw cards - would need to integrate with card system
                return true;

            case 'passive':
                // Passive effects don't apply immediately
                return false;

            default:
                console.log(`[TreasureSystem] Unknown effect type: ${effect.type}`);
                return false;
        }
    }

    /**
     * Resets treasures drawn counter at start of turn
     */
    public static resetTreasuresDrawn(gameState: GameState): void {
        gameState.treasuresDrawnThisTurn = 0;
    }

    /**
     * Gets all items owned by a hero
     */
    public static getHeroItems(hero: Hero, allCards: Card[]): Card[] {
        return allCards.filter(card => hero.items.includes(card.id));
    }
}
