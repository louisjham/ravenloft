import { Card, Entity, Hero, PowerType } from '../types';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';

/**
 * Power System - Manages Daily, At-Will, and Utility powers
 * 
 * Rules from BoardGameRulesChecklist.md:
 * - Daily Powers: Flip over when used, cannot use again until flipped back up (usually by Treasure Card)
 * - At-Will Powers: Do not flip over when used, can use again next turn
 * - Utility Powers: Do not actively attack Monsters, provide other advantages, flip over when used
 */
export class PowerSystem {
    /**
     * Checks if a hero can use a specific power
     */
    public static canUsePower(hero: Hero, powerCard: Card): { canUse: boolean; reason?: string } {
        // Check if power is in hero's abilities
        if (!hero.abilities.includes(powerCard.id) && !hero.hand.includes(powerCard.id)) {
            return { canUse: false, reason: 'Power not in hero abilities or hand' };
        }

        // Check if hero can take actions (not stunned)
        if (!ConditionSystem.canTakeActions(hero)) {
            return { canUse: false, reason: 'Hero is stunned' };
        }

        // Check Daily power usage
        if (powerCard.powerType === 'daily') {
            if (hero.usedPowers.includes(powerCard.id)) {
                return { canUse: false, reason: 'Daily power already used' };
            }
        }

        // Check if hero can use Daily powers (not dazed)
        if (powerCard.powerType === 'daily' && !ConditionSystem.canUseDailyPowers(hero)) {
            return { canUse: false, reason: 'Hero is dazed' };
        }

        return { canUse: true };
    }

    /**
     * Uses a power card
     * Returns the result of using the power
     */
    public static usePower(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: any
    ): { success: boolean; message: string; effects: any[] } {
        const canUse = this.canUsePower(hero, powerCard);
        if (!canUse.canUse) {
            return { success: false, message: canUse.reason || 'Cannot use power', effects: [] };
        }

        const effects: any[] = [];

        // Mark Daily power as used
        if (powerCard.powerType === 'daily') {
            hero.usedPowers.push(powerCard.id);
            effects.push({ type: 'power_used', powerId: powerCard.id, powerType: 'daily' });
        }

        // Mark Utility power as used
        if (powerCard.powerType === 'utility') {
            hero.usedPowers.push(powerCard.id);
            effects.push({ type: 'power_used', powerId: powerCard.id, powerType: 'utility' });
        }

        // Process power effects
        for (const effect of powerCard.effects) {
            const result = this.processEffect(effect, hero, target, gameState);
            effects.push(result);
        }

        return {
            success: true,
            message: `${hero.name} uses ${powerCard.name}`,
            effects
        };
    }

    /**
     * Processes a single effect from a power card
     */
    private static processEffect(
        effect: any,
        hero: Hero,
        target: Entity | null,
        gameState: any
    ): any {
        switch (effect.type) {
            case 'damage':
                if (target) {
                    const damage = effect.value || 0;
                    CombatSystem.applyDamage(target, damage);
                    return { type: 'damage_dealt', targetId: target.id, damage };
                }
                return { type: 'damage_failed', reason: 'No target' };

            case 'heal':
                const healAmount = effect.value || 0;
                CombatSystem.applyHealing(hero, healAmount);
                return { type: 'heal_applied', targetId: hero.id, healAmount };

            case 'status_effect':
                if (target && effect.statusEffect) {
                    ConditionSystem.applyCondition(target, effect.statusEffect as any, hero.id, effect.duration || 1);
                    return { type: 'status_applied', targetId: target.id, statusEffect: effect.statusEffect };
                }
                return { type: 'status_failed', reason: 'No target or no status effect' };

            case 'attack_bonus':
                // Temporary attack bonus - would need to track in state
                return { type: 'attack_bonus_applied', value: effect.value, duration: effect.duration };

            case 'defense_bonus':
                // Temporary defense bonus - would need to track in state
                return { type: 'defense_bonus_applied', value: effect.value, duration: effect.duration };

            case 'move':
                if (effect.target === 'self' && effect.value) {
                    // Move hero - would need to integrate with movement system
                    return { type: 'move_applied', value: effect.value };
                }
                return { type: 'move_failed', reason: 'Invalid move target' };

            case 'draw_card':
                // Draw a card - would need to integrate with card system
                return { type: 'draw_card', count: effect.value || 1 };

            default:
                return { type: 'unknown_effect', effectType: effect.type };
        }
    }

    /**
     * Resets a Daily or Utility power (flips it back up)
     * Usually done via Treasure Card effects
     */
    public static resetPower(hero: Hero, powerId: string): void {
        const index = hero.usedPowers.indexOf(powerId);
        if (index !== -1) {
            hero.usedPowers.splice(index, 1);
            console.log(`[PowerSystem] Power ${powerId} reset for ${hero.name}`);
        }
    }

    /**
     * Resets all Daily and Utility powers for a hero
     * Used when starting a new adventure or via special effects
     */
    public static resetAllPowers(hero: Hero): void {
        hero.usedPowers = [];
        console.log(`[PowerSystem] All powers reset for ${hero.name}`);
    }

    /**
     * Gets the effective attack bonus for a hero considering active powers and items
     */
    public static getEffectiveAttackBonus(hero: Hero, baseBonus: number, target?: Entity): number {
        let bonus = baseBonus;

        // Check for active bonuses from powers/items
        // This would need to integrate with a temporary effects system

        return bonus;
    }

    /**
     * Gets the effective damage for a hero considering conditions
     */
    public static getEffectiveDamage(hero: Hero, baseDamage: number): number {
        const modifier = ConditionSystem.getDamageModifier(hero);
        return Math.floor(baseDamage * modifier);
    }

    /**
     * Checks if a hero has a specific power available
     */
    public static hasPower(hero: Hero, powerId: string): boolean {
        return hero.abilities.includes(powerId) || hero.hand.includes(powerId);
    }

    /**
     * Gets all available powers for a hero
     */
    public static getAvailablePowers(hero: Hero, allCards: Card[]): Card[] {
        return allCards.filter(card =>
            hero.abilities.includes(card.id) || hero.hand.includes(card.id)
        );
    }

    /**
     * Gets all used powers for a hero
     */
    public static getUsedPowers(hero: Hero, allCards: Card[]): Card[] {
        return allCards.filter(card => hero.usedPowers.includes(card.id));
    }
}
