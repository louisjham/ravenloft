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
        // Power selection guard - only fires when selectedPowerIds is populated
        const selectedIds = hero.selectedPowerIds ?? [];
        if (selectedIds.length > 0 && !selectedIds.includes(powerCard.id)) {
            return { canUse: false, reason: 'Power not selected' };
        }

        // Check if power is in hero's abilities
        if (!hero.abilities.includes(powerCard.id) && !hero.hand.includes(powerCard.id)) {
            return { canUse: false, reason: 'Power not in hero abilities or hand' };
        }

        // Check if hero can take actions (not stunned)
        if (!ConditionSystem.canTakeActions(hero)) {
            return { canUse: false, reason: 'Hero is stunned' };
        }

        // Check flip state: Daily/Utility powers are unavailable while flipped
        if (powerCard.powerType === 'daily' || powerCard.powerType === 'utility') {
            const flippedIds = hero.flippedPowerIds ?? [];
            if (flippedIds.includes(powerCard.id)) {
                return { canUse: false, reason: `${powerCard.powerType === 'daily' ? 'Daily' : 'Utility'} power is flipped (face-down)` };
            }
        }

        // Check if hero can use Daily powers (not dazed)
        if (powerCard.powerType === 'daily' && !ConditionSystem.canUseDailyPowers(hero)) {
            return { canUse: false, reason: 'Hero is dazed' };
        }

        return { canUse: true };
    }

    /**
     * Helper to immutably update a hero or monster in the game state
     */
    private static updateEntityInState(state: any, updatedEntity: Entity): any {
        if (!state) return state;
        const isHero = state.heroes.some((h: any) => h.id === updatedEntity.id);
        if (isHero) {
            return {
                ...state,
                heroes: state.heroes.map((h: any) => h.id === updatedEntity.id ? updatedEntity : h)
            };
        }
        const isMonster = state.monsters.some((m: any) => m.id === updatedEntity.id);
        if (isMonster) {
            return {
                ...state,
                monsters: state.monsters.map((m: any) => m.id === updatedEntity.id ? updatedEntity : m)
            };
        }
        return state;
    }

    /**
     * Uses a power card asynchronously, potentially waiting for a dice roll if it involves an attack
     */
    public static async usePowerAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: any
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: any }> {
        // Power selection guard - only fires when selectedPowerIds is populated
        const selectedIds = hero.selectedPowerIds ?? [];
        if (selectedIds.length > 0 && !selectedIds.includes(powerCard.id)) {
            return {
                success: false,
                message: `${hero.heroClass ?? 'Hero'} has not selected power: ${powerCard.name}`,
                effects: [],
                newState: gameState
            };
        }

        const canUse = this.canUsePower(hero, powerCard);
        if (!canUse.canUse) {
            return { success: false, message: canUse.reason || 'Cannot use power', effects: [], newState: gameState };
        }

        const effects: any[] = [];
        let hitTarget = true; // Assume hit if no attack roll is needed
        let currentState = { ...gameState };
        let currentHero = { ...hero };
        let currentTarget = target ? { ...target } : null;

        // If the power has an attack roll
        if (powerCard.attackBonus !== undefined && currentTarget) {
            let damage = powerCard.damage || 0;

            const attackResult = await CombatSystem.resolveAttackAsync(currentHero, currentTarget, powerCard.attackBonus, damage);
            effects.push({ type: 'attack_result', attackResult });
            hitTarget = attackResult.hit;

            // Apply attack damage to target if it hit
            if (hitTarget && attackResult.damage > 0) {
                const updatedTarget = CombatSystem.applyDamage(currentTarget, attackResult.damage);
                currentState = this.updateEntityInState(currentState, updatedTarget);
                currentTarget = updatedTarget;
            }
        }

        // Flip Daily or Utility power face-down
        if (powerCard.powerType === 'daily' || powerCard.powerType === 'utility') {
            const currentFlipped = currentHero.flippedPowerIds ?? [];
            if (!currentFlipped.includes(powerCard.id)) {
                const updatedHero = {
                    ...currentHero,
                    flippedPowerIds: [...currentFlipped, powerCard.id]
                };
                currentState = this.updateEntityInState(currentState, updatedHero);
                currentHero = updatedHero;
                effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
            }
        }

        // Process power effects based on hit/miss/always condition
        const eligibleEffects = (powerCard.effects || []).filter((e: any) => {
            const when = e.when || 'hit';
            if (when === 'always') return true;
            if (hitTarget && when === 'hit') return true;
            if (!hitTarget && when === 'miss') return true;
            return false;
        });

        for (const effect of eligibleEffects) {
            const resultObj = this.processEffect(effect, currentHero, currentTarget, currentState);
            effects.push(resultObj.result);
            currentState = resultObj.newState;
            currentHero = resultObj.hero;
            currentTarget = resultObj.target;
        }

        return {
            success: true,
            message: hitTarget ? `${hero.name} uses ${powerCard.name}` : `${hero.name} misses with ${powerCard.name}`,
            effects,
            newState: currentState
        };
    }

    /**
     * Synchronous wrapper for usePower (for testing/legacy)
     */
    public static usePower(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: any
    ): { success: boolean; message: string; effects: any[]; newState: any } {
        // Power selection guard - only fires when selectedPowerIds is populated
        const selectedIds = hero.selectedPowerIds ?? [];
        if (selectedIds.length > 0 && !selectedIds.includes(powerCard.id)) {
            return {
                success: false,
                message: `${hero.heroClass ?? 'Hero'} has not selected power: ${powerCard.name}`,
                effects: [],
                newState: gameState
            };
        }

        const canUse = this.canUsePower(hero, powerCard);
        if (!canUse.canUse) {
            return { success: false, message: canUse.reason || 'Cannot use power', effects: [], newState: gameState };
        }

        const effects: any[] = [];
        let hitTarget = true; // Assume hit if no attack roll is needed
        let currentState = { ...gameState };
        let currentHero = { ...hero };
        let currentTarget = target ? { ...target } : null;

        // If the power has an attack roll
        if (powerCard.attackBonus !== undefined && currentTarget) {
            let damage = powerCard.damage || 0;

            const attackResult = CombatSystem.resolveAttack(currentHero, currentTarget, powerCard.attackBonus, damage);
            effects.push({ type: 'attack_result', attackResult });
            hitTarget = attackResult.hit;

            // Apply attack damage to target if it hit
            if (hitTarget && attackResult.damage > 0) {
                const updatedTarget = CombatSystem.applyDamage(currentTarget, attackResult.damage);
                currentState = this.updateEntityInState(currentState, updatedTarget);
                currentTarget = updatedTarget;
            }
        }

        // Flip Daily or Utility power face-down
        if (powerCard.powerType === 'daily' || powerCard.powerType === 'utility') {
            const currentFlipped = currentHero.flippedPowerIds ?? [];
            if (!currentFlipped.includes(powerCard.id)) {
                const updatedHero = {
                    ...currentHero,
                    flippedPowerIds: [...currentFlipped, powerCard.id]
                };
                currentState = this.updateEntityInState(currentState, updatedHero);
                currentHero = updatedHero;
                effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
            }
        }

        // Process power effects based on hit/miss/always condition
        const eligibleEffects = (powerCard.effects || []).filter((e: any) => {
            const when = e.when || 'hit';
            if (when === 'always') return true;
            if (hitTarget && when === 'hit') return true;
            if (!hitTarget && when === 'miss') return true;
            return false;
        });

        for (const effect of eligibleEffects) {
            const resultObj = this.processEffect(effect, currentHero, currentTarget, currentState);
            effects.push(resultObj.result);
            currentState = resultObj.newState;
            currentHero = resultObj.hero;
            currentTarget = resultObj.target;
        }

        return {
            success: true,
            message: hitTarget ? `${hero.name} uses ${powerCard.name}` : `${hero.name} misses with ${powerCard.name}`,
            effects,
            newState: currentState
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
    ): { result: any; newState: any; hero: Hero; target: Entity | null } {
        let newState = { ...gameState };
        let currentHero = { ...hero };
        let currentTarget = target ? { ...target } : null;

        switch (effect.type) {
            case 'damage':
                if (currentTarget) {
                    if (effect.condition) {
                        const cond = effect.condition.toLowerCase();
                        const targetHp = currentTarget.hp ?? 0;
                        const targetMaxHp = currentTarget.maxHp ?? targetHp;
                        const isDamaged = targetHp < targetMaxHp;
                        const monsterType = 'monsterType' in currentTarget ? String((currentTarget as any).monsterType).toLowerCase() : '';
                        const isUndead = monsterType.includes('undead') || monsterType.includes('dracolich');
                        const conditionMet = cond === 'damaged' ? isDamaged : isUndead;
                        if (!conditionMet) {
                            return { result: { type: 'damage_skipped', reason: `Condition not met: ${effect.condition}` }, newState, hero: currentHero, target: currentTarget };
                        }
                    }
                    const damage = effect.value || 0;
                    const updatedTarget = CombatSystem.applyDamage(currentTarget, damage);
                    newState = this.updateEntityInState(newState, updatedTarget);
                    
                    if (updatedTarget.id === currentHero.id) {
                        currentHero = updatedTarget as Hero;
                    }
                    return {
                        result: { type: 'damage_dealt', targetId: updatedTarget.id, damage },
                        newState,
                        hero: currentHero,
                        target: updatedTarget
                    };
                }
                return { result: { type: 'damage_failed', reason: 'No target' }, newState, hero: currentHero, target: currentTarget };

            case 'heal':
                let healAmount = 0;
                let healTarget = currentHero;
                if (effect.target === 'self') {
                    healTarget = currentHero;
                } else if (effect.target === 'single' || effect.target === 'adjacent') {
                    if (currentTarget && 'level' in currentTarget) {
                        healTarget = currentTarget as Hero;
                    } else {
                        healTarget = currentHero;
                    }
                } else if (effect.target === 'tile' || effect.target === 'area') {
                    // Heal all heroes on currentHero's tile
                    const tileX = currentHero.position.x;
                    const tileZ = currentHero.position.z;
                    const heroesOnTile = newState.heroes.filter((h: any) => h.position.x === tileX && h.position.z === tileZ);
                    
                    const healVal = effect.value === 'surge' ? Math.ceil(currentHero.maxHp / 2) : (Number(effect.value) || 0);
                    
                    let tempState = newState;
                    let tempHero = currentHero;
                    let tempTarget = currentTarget;
                    
                    for (const hOnTile of heroesOnTile) {
                        const updatedH = CombatSystem.applyHealing(hOnTile, healVal);
                        tempState = this.updateEntityInState(tempState, updatedH);
                        if (updatedH.id === tempHero.id) {
                            tempHero = updatedH;
                        }
                        if (tempTarget && updatedH.id === tempTarget.id) {
                            tempTarget = updatedH;
                        }
                    }
                    
                    return {
                        result: { type: 'heal_applied_area', healAmount: healVal },
                        newState: tempState,
                        hero: tempHero,
                        target: tempTarget
                    };
                }

                if (effect.value === 'surge') {
                    healAmount = Math.ceil(healTarget.maxHp / 2);
                } else {
                    healAmount = Number(effect.value) || 0;
                }

                const updatedHealTarget = CombatSystem.applyHealing(healTarget, healAmount);
                newState = this.updateEntityInState(newState, updatedHealTarget);
                
                if (updatedHealTarget.id === currentHero.id) {
                    currentHero = updatedHealTarget as Hero;
                }
                if (currentTarget && updatedHealTarget.id === currentTarget.id) {
                    currentTarget = updatedHealTarget;
                }
                return {
                    result: { type: 'heal_applied', targetId: updatedHealTarget.id, healAmount },
                    newState,
                    hero: currentHero,
                    target: currentTarget
                };

            case 'remove_condition':
                let removeTarget = currentHero;
                if (effect.target === 'self') {
                    removeTarget = currentHero;
                } else if (effect.target === 'single' || effect.target === 'adjacent') {
                    if (currentTarget && 'level' in currentTarget) {
                        removeTarget = currentTarget as Hero;
                    } else {
                        removeTarget = currentHero;
                    }
                } else if (effect.target === 'tile' || effect.target === 'area') {
                    // Remove all conditions from all heroes on currentHero's tile
                    const tileX = currentHero.position.x;
                    const tileZ = currentHero.position.z;
                    const heroesOnTile = newState.heroes.filter((h: any) => h.position.x === tileX && h.position.z === tileZ);
                    
                    let tempState = newState;
                    let tempHero = currentHero;
                    let tempTarget = currentTarget;
                    
                    for (const hOnTile of heroesOnTile) {
                        const updatedH = ConditionSystem.clearAllConditions(hOnTile);
                        tempState = this.updateEntityInState(tempState, updatedH);
                        if (updatedH.id === tempHero.id) {
                            tempHero = updatedH;
                        }
                        if (tempTarget && updatedH.id === tempTarget.id) {
                            tempTarget = updatedH;
                        }
                    }
                    
                    return {
                        result: { type: 'condition_removed_area' },
                        newState: tempState,
                        hero: tempHero,
                        target: tempTarget
                    };
                }

                const updatedRemoveTarget = ConditionSystem.clearAllConditions(removeTarget);
                newState = this.updateEntityInState(newState, updatedRemoveTarget);
                
                if (updatedRemoveTarget.id === currentHero.id) {
                    currentHero = updatedRemoveTarget as Hero;
                }
                if (currentTarget && updatedRemoveTarget.id === currentTarget.id) {
                    currentTarget = updatedRemoveTarget;
                }
                return {
                    result: { type: 'condition_removed', targetId: updatedRemoveTarget.id },
                    newState,
                    hero: currentHero,
                    target: currentTarget
                };

            case 'status_effect':
                if (currentTarget && effect.statusEffect) {
                    const updatedTarget = CombatSystem.applyCondition(currentTarget, effect.statusEffect as any, currentHero.id, effect.duration || 1);
                    newState = this.updateEntityInState(newState, updatedTarget);
                    if (updatedTarget.id === currentHero.id) {
                        currentHero = updatedTarget as Hero;
                    }
                    return {
                        result: { type: 'status_applied', targetId: updatedTarget.id, statusEffect: effect.statusEffect },
                        newState,
                        hero: currentHero,
                        target: updatedTarget
                    };
                }
                return { result: { type: 'status_failed', reason: 'No target or no status effect' }, newState, hero: currentHero, target: currentTarget };

            case 'attack_bonus':
                return { result: { type: 'attack_bonus_applied', value: effect.value, duration: effect.duration }, newState, hero: currentHero, target: currentTarget };

            case 'defense_bonus':
                return { result: { type: 'defense_bonus_applied', value: effect.value, duration: effect.duration }, newState, hero: currentHero, target: currentTarget };

            case 'move':
                return { result: { type: 'move_applied', value: effect.value }, newState, hero: currentHero, target: currentTarget };

            case 'draw_card':
                return { result: { type: 'draw_card', count: effect.value || 1 }, newState, hero: currentHero, target: currentTarget };

            default:
                return { result: { type: 'unknown_effect', effectType: effect.type }, newState, hero: currentHero, target: currentTarget };
        }
    }

    /**
     * Resets a Daily or Utility power (flips it back up)
     * Usually done via Treasure Card effects
     */
    public static resetPower(hero: Hero, powerId: string): Hero {
        const flippedIds = hero.flippedPowerIds ?? [];
        const index = flippedIds.indexOf(powerId);
        if (index !== -1) {
            const updated: Hero = {
                ...hero,
                flippedPowerIds: [...flippedIds.slice(0, index), ...flippedIds.slice(index + 1)]
            };
            console.log(`[PowerSystem] Power ${powerId} reset (flipped back up) for ${hero.name}`);
            return updated;
        }
        return hero;
    }

    /**
     * Resets all Daily and Utility powers for a hero
     * Used when starting a new adventure or via special effects
     */
    public static resetAllPowers(hero: Hero): Hero {
        const updated: Hero = { ...hero, flippedPowerIds: [] };
        console.log(`[PowerSystem] All powers reset (flipped back up) for ${hero.name}`);
        return updated;
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
     * Gets all flipped (face-down) powers for a hero
     */
    public static getUsedPowers(hero: Hero, allCards: Card[]): Card[] {
        const flippedIds = hero.flippedPowerIds ?? [];
        return allCards.filter(card => flippedIds.includes(card.id));
    }
}
