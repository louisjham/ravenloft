import { Entity, Condition, ConditionType } from '../types';

/**
 * DEBUG: Condition System - Manages condition application, removal, and effects
 * 
 * Conditions:
 * - slowed: Movement speed reduced by half (rounded down)
 * - immobilized: Cannot move at all
 * - poisoned: Takes damage at start of turn
 * - dazed: Cannot use Daily powers
 * - weakened: Damage dealt is halved
 * - stunned: Cannot take any actions
 */
export class ConditionSystem {
    /**
     * Applies a condition to an entity
     */
    public static applyCondition(
        entity: Entity,
        conditionType: ConditionType,
        sourceId?: string,
        duration: number = 1
    ): void {
        console.log(`[DEBUG ConditionSystem] Applying condition '${conditionType}' to ${entity.name} from ${sourceId || 'unknown'}`);

        // Check if entity already has this condition
        const existingCondition = entity.conditions.find(c => c.type === conditionType);
        if (existingCondition) {
            // Refresh duration
            existingCondition.turnsRemaining = duration;
            console.log(`[DEBUG ConditionSystem] Condition '${conditionType}' refreshed on ${entity.name}, duration: ${duration}`);
        } else {
            // Add new condition
            entity.conditions.push({
                type: conditionType,
                sourceId,
                turnsRemaining: duration
            });
            console.log(`[DEBUG ConditionSystem] Condition '${conditionType}' added to ${entity.name}, duration: ${duration}`);
        }
    }

    /**
     * Removes a condition from an entity
     */
    public static removeCondition(entity: Entity, conditionType: ConditionType): void {
        const initialCount = entity.conditions.length;
        entity.conditions = entity.conditions.filter(c => c.type !== conditionType);

        if (entity.conditions.length < initialCount) {
            console.log(`[DEBUG ConditionSystem] Condition '${conditionType}' removed from ${entity.name}`);
        }
    }

    /**
     * Removes all conditions from an entity
     */
    public static clearAllConditions(entity: Entity): void {
        const count = entity.conditions.length;
        entity.conditions = [];
        console.log(`[DEBUG ConditionSystem] Cleared ${count} conditions from ${entity.name}`);
    }

    /**
     * Decrements turn counters for all conditions and removes expired ones
     */
    public static processTurnEnd(entity: Entity): void {
        console.log(`[DEBUG ConditionSystem] Processing turn end for ${entity.name}, conditions: ${entity.conditions.map(c => c.type).join(', ') || 'none'}`);

        entity.conditions = entity.conditions.filter(condition => {
            condition.turnsRemaining--;

            if (condition.turnsRemaining <= 0) {
                console.log(`[DEBUG ConditionSystem] Condition '${condition.type}' expired on ${entity.name}`);
                return false; // Remove expired condition
            }

            console.log(`[DEBUG ConditionSystem] Condition '${condition.type}' on ${entity.name}, turns remaining: ${condition.turnsRemaining}`);
            return true;
        });
    }

    /**
     * Checks if an entity has a specific condition
     */
    public static hasCondition(entity: Entity, conditionType: ConditionType): boolean {
        return entity.conditions.some(c => c.type === conditionType);
    }

    /**
     * Gets the effective speed of an entity considering conditions
     */
    public static getEffectiveSpeed(entity: Entity): number {
        let effectiveSpeed = entity.speed;

        if (this.hasCondition(entity, 'slowed')) {
            effectiveSpeed = Math.floor(effectiveSpeed / 2);
            console.log(`[DEBUG ConditionSystem] ${entity.name} is slowed, speed reduced from ${entity.speed} to ${effectiveSpeed}`);
        }

        if (this.hasCondition(entity, 'immobilized')) {
            effectiveSpeed = 0;
            console.log(`[DEBUG ConditionSystem] ${entity.name} is immobilized, speed is 0`);
        }

        return effectiveSpeed;
    }

    /**
     * Checks if an entity can take actions
     */
    public static canTakeActions(entity: Entity): boolean {
        if (this.hasCondition(entity, 'stunned')) {
            console.log(`[DEBUG ConditionSystem] ${entity.name} is stunned and cannot take actions`);
            return false;
        }
        return true;
    }

    /**
     * Checks if an entity can use Daily powers
     */
    public static canUseDailyPowers(entity: Entity): boolean {
        if (this.hasCondition(entity, 'dazed')) {
            console.log(`[DEBUG ConditionSystem] ${entity.name} is dazed and cannot use Daily powers`);
            return false;
        }
        return true;
    }

    /**
     * Gets damage modifier based on conditions
     */
    public static getDamageModifier(entity: Entity): number {
        if (this.hasCondition(entity, 'weakened')) {
            console.log(`[DEBUG ConditionSystem] ${entity.name} is weakened, damage will be halved`);
            return 0.5; // Half damage
        }
        return 1.0;
    }

    /**
     * Processes poison damage at start of turn
     */
    public static processPoisonDamage(entity: Entity): number {
        if (this.hasCondition(entity, 'poisoned')) {
            const poisonDamage = 1; // Standard poison damage
            console.log(`[DEBUG ConditionSystem] ${entity.name} is poisoned, taking ${poisonDamage} damage`);
            return poisonDamage;
        }
        return 0;
    }
}
