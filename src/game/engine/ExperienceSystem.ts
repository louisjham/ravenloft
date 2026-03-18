import { Card, GameState, Hero } from '../types';
import { PowerSystem } from './PowerSystem';

/**
 * Experience System - Manages XP spending and leveling up
 * 
 * Rules from BoardGameRulesChecklist.md:
 * - Canceling Encounter Cards: Spend 5 XP to cancel an encounter card
 * - Leveling Up: Triggered by natural 20 on attack or disable trap roll, costs 5 XP
 * - Level 2 Benefits: HP +2, AC +1, Surge Value +1, choose new Daily power, gain critical ability
 */
export class ExperienceSystem {
    /**
     * Calculates total XP available from experience pile
     */
    public static getTotalXP(gameState: GameState): number {
        let totalXP = 0;
        for (const cardId of gameState.experiencePile) {
            // In a real implementation, we'd look up the card's XP value
            // For now, assume 100 XP per card
            totalXP += 100;
        }
        return totalXP;
    }

    /**
     * Attempts to cancel an encounter card using XP
     * Cost: 5 XP total
     */
    public static cancelEncounterCard(
        gameState: GameState,
        encounterCardId: string
    ): { success: boolean; message: string; cardsUsed: string[] } {
        const totalXP = this.getTotalXP(gameState);
        const requiredXP = 5 * 100; // 5 XP * 100 XP per card

        if (totalXP < requiredXP) {
            return {
                success: false,
                message: `Not enough XP to cancel encounter. Need ${requiredXP} XP, have ${totalXP} XP.`,
                cardsUsed: []
            };
        }

        // Select cards to spend (simple approach: take first cards until we have enough XP)
        const cardsToSpend: string[] = [];
        let xpSpent = 0;
        for (const cardId of gameState.experiencePile) {
            if (xpSpent >= requiredXP) break;
            cardsToSpend.push(cardId);
            xpSpent += 100; // Assume 100 XP per card
        }

        // Remove cards from experience pile
        gameState.experiencePile = gameState.experiencePile.filter(
            id => !cardsToSpend.includes(id)
        );

        // Add spent cards to discard pile
        if (!gameState.discardPiles['monster']) {
            gameState.discardPiles['monster'] = [];
        }
        gameState.discardPiles['monster'].push(...cardsToSpend);

        return {
            success: true,
            message: `Encounter card canceled! Spent ${cardsToSpend.length} monster cards (${xpSpent} XP).`,
            cardsUsed: cardsToSpend
        };
    }

    /**
     * Checks if a hero can level up
     * Trigger: Natural 20 on attack roll or disable trap roll
     * Cost: 5 XP
     */
    public static canLevelUp(gameState: GameState, hero: Hero): boolean {
        const totalXP = this.getTotalXP(gameState);
        const requiredXP = 5 * 100; // 5 XP * 100 XP per card

        if (totalXP < requiredXP) {
            return false;
        }

        if (hero.level >= 2) {
            return false; // Can only level up to 2 in base game
        }

        return true;
    }

    /**
     * Levels up a hero to level 2
     * Benefits: HP +2, AC +1, Surge Value +1, choose new Daily power
     */
    public static levelUpHero(
        gameState: GameState,
        hero: Hero,
        newDailyPowerId?: string
    ): { success: boolean; message: string; cardsUsed: string[] } {
        if (!this.canLevelUp(gameState, hero)) {
            return {
                success: false,
                message: 'Cannot level up: Either not enough XP or already at max level.',
                cardsUsed: []
            };
        }

        const requiredXP = 5 * 100; // 5 XP * 100 XP per card

        // Select cards to spend
        const cardsToSpend: string[] = [];
        let xpSpent = 0;
        for (const cardId of gameState.experiencePile) {
            if (xpSpent >= requiredXP) break;
            cardsToSpend.push(cardId);
            xpSpent += 100; // Assume 100 XP per card
        }

        // Remove cards from experience pile
        gameState.experiencePile = gameState.experiencePile.filter(
            id => !cardsToSpend.includes(id)
        );

        // Add spent cards to discard pile
        if (!gameState.discardPiles['monster']) {
            gameState.discardPiles['monster'] = [];
        }
        gameState.discardPiles['monster'].push(...cardsToSpend);

        // Apply level up benefits
        const oldLevel = hero.level;
        hero.level = 2;
        hero.maxHp += 2;
        hero.hp = Math.min(hero.hp + 2, hero.maxHp);
        hero.ac += 1;
        // Surge value is stored in hero data, would need to add to Hero type

        // Add new daily power if provided
        if (newDailyPowerId) {
            hero.abilities.push(newDailyPowerId);
        }

        return {
            success: true,
            message: `${hero.name} leveled up from ${oldLevel} to 2! HP +2, AC +1, Surge Value +1.`,
            cardsUsed: cardsToSpend
        };
    }

    /**
     * Adds a monster card to the experience pile
     * Called when a monster is defeated
     */
    public static addMonsterToExperiencePile(
        gameState: GameState,
        monsterCardId: string
    ): void {
        gameState.experiencePile.push(monsterCardId);
        console.log(`[ExperienceSystem] Added monster card ${monsterCardId} to experience pile.`);
    }

    /**
     * Gets the number of monster cards in experience pile
     */
    public static getExperienceCardCount(gameState: GameState): number {
        return gameState.experiencePile.length;
    }

    /**
     * Gets experience card IDs from experience pile
     */
    public static getExperienceCards(gameState: GameState): string[] {
        return [...gameState.experiencePile];
    }

    /**
     * Checks if a natural 20 was rolled (for leveling up trigger)
     */
    public static isNatural20(roll: number): boolean {
        return roll === 20;
    }

    /**
     * Processes a roll to check for level up trigger
     * Returns true if the roll was a natural 20
     */
    public static checkLevelUpTrigger(roll: number): boolean {
        if (this.isNatural20(roll)) {
            console.log(`[ExperienceSystem] Natural 20 rolled! Level up available.`);
            return true;
        }
        return false;
    }

    /**
     * Gets hero's surge value (HP recovered when using Healing Surge)
     * Level 1: Base surge value from hero data
     * Level 2: Base surge value + 1
     */
    public static getSurgeValue(hero: Hero, baseSurgeValue: number): number {
        if (hero.level >= 2) {
            return baseSurgeValue + 1;
        }
        return baseSurgeValue;
    }

    /**
     * Gets hero's critical hit ability (from level 2)
     * This would be defined in hero data
     */
    public static getCriticalAbility(hero: Hero): string | null {
        if (hero.level < 2) {
            return null;
        }
        // In a real implementation, this would come from hero data
        // For example: "Critical: Deal +1d6 damage on critical hits"
        return 'Critical ability active';
    }

    /**
     * Resets experience pile (for new game)
     */
    public static resetExperiencePile(gameState: GameState): void {
        gameState.experiencePile = [];
    }
}
