import { Card, Entity, Hero, Monster, PowerType, GameState, isMonsterEntity, isHeroEntity, Tile, GameToken, AttackResult } from '../types';
import { CombatSystem } from './CombatSystem';
import { CombatAdapter } from './CombatAdapter';
import { ConditionSystem } from './ConditionSystem';
import { getTileGraphDistance } from './MonsterAI';
import { isDev } from '../../utils/devEnv';

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
        const selectedIds = hero.selectedPowerIds ?? [];
        if (selectedIds.length > 0 && !selectedIds.includes(powerCard.id)) {
            return { canUse: false, reason: 'Power not selected' };
        }

        if (!hero.abilities.includes(powerCard.id) && !hero.hand.includes(powerCard.id)) {
            return { canUse: false, reason: 'Power not in hero abilities or hand' };
        }

        if (!ConditionSystem.canTakeActions(hero)) {
            return { canUse: false, reason: 'Hero is stunned' };
        }

        if (powerCard.powerType === 'daily' || powerCard.powerType === 'utility') {
            const flippedIds = hero.flippedPowerIds ?? [];
            if (flippedIds.includes(powerCard.id)) {
                return { canUse: false, reason: `${powerCard.powerType === 'daily' ? 'Daily' : 'Utility'} power is flipped (face-down)` };
            }
        }

        if (powerCard.powerType === 'daily' && !ConditionSystem.canUseDailyPowers(hero)) {
            return { canUse: false, reason: 'Hero is dazed' };
        }

        return { canUse: true };
    }

    /**
     * Helper to immutably update a hero or monster in the game state
     */
    private static updateEntityInState(state: GameState, updatedEntity: Entity): GameState {
        if (!state) return state;
        const isHero = state.heroes.some(h => h.id === updatedEntity.id);
        if (isHero) {
            return {
                ...state,
                heroes: state.heroes.map(h => h.id === updatedEntity.id ? updatedEntity as Hero : h)
            };
        }
        const isMonster = state.monsters.some(m => m.id === updatedEntity.id);
        if (isMonster) {
            return {
                ...state,
                monsters: state.monsters.map(m => m.id === updatedEntity.id ? updatedEntity as Monster : m)
            };
        }
        return state;
    }

    /**
     * Resolves the target for single/adjacent effect types based on effect.target
     */
    private static resolveSingleTarget(
        effect: { target?: string },
        hero: Hero,
        target: Entity | null
    ): Hero | Entity {
        if (effect.target === 'self') return hero;
        if ((effect.target === 'single' || effect.target === 'adjacent') && target && !isMonsterEntity(target)) {
            return target as Hero;
        }
        return hero;
    }

    /**
     * Applies a function to all heroes on the same tile as the given hero.
     */
    private static applyToTileHeroes(
        state: GameState,
        hero: Hero,
        target: Entity | null,
        fn: (h: Hero) => Hero
    ): { newState: GameState; hero: Hero; target: Entity | null } {
        const tileX = hero.position.x;
        const tileZ = hero.position.z;
        const heroesOnTile = state.heroes.filter(h => h.position.x === tileX && h.position.z === tileZ);

        let tempState = state;
        let tempHero = hero;
        let tempTarget = target;

        for (const hOnTile of heroesOnTile) {
            const updatedH = fn(hOnTile);
            tempState = this.updateEntityInState(tempState, updatedH);
            if (updatedH.id === tempHero.id) {
                tempHero = updatedH;
            }
            if (tempTarget && updatedH.id === tempTarget.id) {
                tempTarget = updatedH;
            }
        }

        return { newState: tempState, hero: tempHero, target: tempTarget };
    }

    /**
     * Shared power execution logic used by both sync and async paths.
     * attackResult should be pre-computed (null if no attack roll needed).
     */
    private static executePower(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState,
        attackResult: import('../types').AttackResult | null
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        const effects: any[] = [];
        const hitTarget = attackResult ? attackResult.hit : true;
        let currentState = { ...gameState };
        let currentHero = { ...hero };
        let currentTarget = target ? { ...target } : null;

        if (attackResult) {
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, attackResult);
            currentState = this.updateEntityInState(currentState, currentHero);
        }

        // Apply attack damage if it hit
        if (attackResult && hitTarget && attackResult.damage > 0 && currentTarget) {
            const updatedTarget = CombatSystem.applyDamage(currentTarget, attackResult.damage);
            const finalTarget = (isMonsterEntity(updatedTarget) && updatedTarget.hp <= 0)
                ? { ...updatedTarget, isDefeated: true }
                : updatedTarget;
            currentState = this.updateEntityInState(currentState, finalTarget);
            currentTarget = finalTarget;
        }

        // Flip Daily or Utility power face-down
        if (powerCard.powerType === 'daily' || powerCard.powerType === 'utility') {
            const isBruteStrike = powerCard.id === 'fighter_brute_strike';
            const isPreciseStrike = powerCard.id === 'fighter_precise_strike';
            const shouldFlip = !((isBruteStrike || isPreciseStrike) && !hitTarget);

            if (shouldFlip) {
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

            // Cackling Skull environment check
            if (currentState.activeEnvironmentCard === 'enc_cackling_skull') {
                console.log(`[PowerSystem] Cackling Skull active: ${currentHero.name} takes 1 damage for using a ${powerCard.powerType} power.`);
                const damagedHero = CombatSystem.applyDamage(currentHero, 1) as Hero;
                currentState = this.updateEntityInState(currentState, damagedHero);
                currentHero = damagedHero;
                effects.push({ type: 'cackling_skull_damage', targetId: currentHero.id, damage: 1 });
            }
        }

        // Process power effects based on hit/miss/always condition
        const eligibleEffects = (powerCard.effects || []).filter(e => {
            const when = e.when || 'hit';
            if (when === 'always') return true;
            if (hitTarget && when === 'hit') return true;
            if (!hitTarget && when === 'miss') return true;
            return false;
        });

        for (const effect of eligibleEffects) {
            const resultObj = this.processEffect(effect, currentHero, currentTarget, currentState, powerCard);
            effects.push(resultObj.result);
            currentState = resultObj.newState;
            currentHero = resultObj.hero;
            currentTarget = resultObj.target;
        }

        let suffix = '';
        const cleaveEffect = effects.find(e => e.type === 'cleave_resolved');
        if (cleaveEffect) {
            const cleaveTarget = currentState.monsters.find(m => m.id === cleaveEffect.cleaveTargetId);
            if (cleaveTarget) {
                suffix = `, cleaving onto ${cleaveTarget.name} for 1 damage${cleaveEffect.newPosition.sqX !== hero.position.sqX || cleaveEffect.newPosition.sqZ !== hero.position.sqZ ? ' and moving adjacent to it' : ''}`;
            }
        }

        return {
            success: true,
            message: hitTarget ? `${hero.name} uses ${powerCard.name}${suffix}` : `${hero.name} misses with ${powerCard.name}`,
            effects,
            newState: currentState
        };
    }

    /**
     * Uses a power card asynchronously, waiting for a dice roll if it involves an attack
     */
    public static async usePowerAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        const canUse = this.canUsePower(hero, powerCard);
        if (!canUse.canUse) {
            return { success: false, message: canUse.reason || 'Cannot use power', effects: [], newState: gameState };
        }

        if (powerCard.id === 'fighter_come_and_get_it') {
            return this.executeComeAndGetItAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'ranger_twin_shot') {
            return this.executeTwinShotAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'ranger_attacks_on_the_run') {
            return this.executeAttacksOnTheRunAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'ranger_split_the_tree') {
            return this.executeSplitTheTreeAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'rogue_dagger_barrage') {
            return this.executeDaggerBarrageAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_scorching_burst') {
            return this.executeScorchingBurstAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_fireball') {
            return this.executeFireballAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_lightning_bolt') {
            return this.executeLightningBoltAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_thunderwave') {
            return this.executeThunderwaveAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_freezing_cloud') {
            return this.executeFreezingCloudAsync(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_illusionary_crowd') {
            return this.executeIllusionaryCrowdAsync(hero, powerCard, target, gameState);
        }

        let currentHero = { ...hero };
        let currentGameState = { ...gameState };
        let currentTarget = target ? { ...target } : null;

        if (powerCard.id === 'rogue_deft_strike' && target) {
            const newPos = this.getDeftStrikeSquare(hero, target, gameState);
            if (newPos) {
                currentHero.position = newPos;
                currentGameState = this.updateEntityInState(currentGameState, currentHero);
            }
        }

        let currentAttackBonus = powerCard.attackBonus;
        if (powerCard.id === 'rogue_snipe_shot' && target) {
            const tileDist = Math.abs(currentHero.position.x - target.position.x) + Math.abs(currentHero.position.z - target.position.z);
            if (tileDist === 1) {
                currentAttackBonus = (currentAttackBonus ?? 7) + 2;
            }
        }

        let attackResult: AttackResult | null = null;

        if (currentAttackBonus !== undefined && currentTarget) {
            const damage = powerCard.damage || 0;
            const resolved = await CombatAdapter.resolveAttackAsync(currentHero, currentTarget, currentAttackBonus, damage);
            attackResult = resolved;
        }

        return this.executePower(currentHero, powerCard, currentTarget, currentGameState, attackResult);
    }

    /**
     * Synchronous wrapper for usePower (for testing/legacy)
     */
    public static usePower(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        const canUse = this.canUsePower(hero, powerCard);
        if (!canUse.canUse) {
            return { success: false, message: canUse.reason || 'Cannot use power', effects: [], newState: gameState };
        }

        if (powerCard.id === 'fighter_come_and_get_it') {
            return this.executeComeAndGetIt(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'ranger_twin_shot') {
            return this.executeTwinShot(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'ranger_attacks_on_the_run') {
            return this.executeAttacksOnTheRun(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'ranger_split_the_tree') {
            return this.executeSplitTheTree(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'rogue_dagger_barrage') {
            return this.executeDaggerBarrage(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_scorching_burst') {
            return this.executeScorchingBurst(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_fireball') {
            return this.executeFireball(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_lightning_bolt') {
            return this.executeLightningBolt(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_thunderwave') {
            return this.executeThunderwave(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_freezing_cloud') {
            return this.executeFreezingCloud(hero, powerCard, target, gameState);
        }
        if (powerCard.id === 'wizard_illusionary_crowd') {
            return this.executeIllusionaryCrowd(hero, powerCard, target, gameState);
        }

        let currentHero = { ...hero };
        let currentGameState = { ...gameState };
        let currentTarget = target ? { ...target } : null;

        if (powerCard.id === 'rogue_deft_strike' && target) {
            const newPos = this.getDeftStrikeSquare(hero, target, gameState);
            if (newPos) {
                currentHero.position = newPos;
                currentGameState = this.updateEntityInState(currentGameState, currentHero);
            }
        }

        let currentAttackBonus = powerCard.attackBonus;
        if (powerCard.id === 'rogue_snipe_shot' && target) {
            const tileDist = Math.abs(currentHero.position.x - target.position.x) + Math.abs(currentHero.position.z - target.position.z);
            if (tileDist === 1) {
                currentAttackBonus = (currentAttackBonus ?? 7) + 2;
            }
        }

        let attackResult: AttackResult | null = null;

        if (currentAttackBonus !== undefined && currentTarget) {
            const damage = powerCard.damage || 0;
            const resolved = CombatSystem.resolveAttack(currentHero,  currentTarget, currentAttackBonus, damage);
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, resolved);
            currentGameState = this.updateEntityInState(currentGameState, currentHero);
            attackResult = resolved;
        }

        return this.executePower(currentHero, powerCard, currentTarget, currentGameState, attackResult);
    }

    private static getDeftStrikeSquare(
        hero: Hero,
        target: Entity,
        gameState: GameState
    ): { x: number; z: number; sqX: number; sqZ: number } | null {
        const heroAbsX = hero.position.x * 4 + hero.position.sqX;
        const heroAbsZ = hero.position.z * 4 + hero.position.sqZ;
        const targetAbsX = target.position.x * 4 + target.position.sqX;
        const targetAbsZ = target.position.z * 4 + target.position.sqZ;

        // If already adjacent to target, no need to move
        if (Math.abs(heroAbsX - targetAbsX) + Math.abs(heroAbsZ - targetAbsZ) === 1) {
            return hero.position;
        }

        let bestSquare: { x: number; z: number; sqX: number; sqZ: number } | null = null;
        let minDistance = 999;

        for (const tile of gameState.tiles) {
            for (let sqX = 0; sqX < 4; sqX++) {
                for (let sqZ = 0; sqZ < 4; sqZ++) {
                    const absX = tile.x * 4 + sqX;
                    const absZ = tile.z * 4 + sqZ;
                    
                    const distToHero = Math.abs(absX - heroAbsX) + Math.abs(absZ - heroAbsZ);
                    const distToTarget = Math.abs(absX - targetAbsX) + Math.abs(absZ - targetAbsZ);

                    if (distToHero <= 2 && distToTarget === 1) {
                        const occupied = 
                            gameState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                            gameState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                        if (!occupied) {
                            if (distToHero < minDistance) {
                                minDistance = distToHero;
                                bestSquare = { x: tile.x, z: tile.z, sqX, sqZ };
                            }
                        }
                    }
                }
            }
        }

        return bestSquare;
    }

    private static async executeDaggerBarrageAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Dagger Barrage requires a target', effects: [], newState: gameState };
        }

        let newState = { ...gameState };
        let currentHero = { ...hero };

        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;

        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated &&
            m.hp > 0 &&
            m.position.x === targetTileX &&
            m.position.z === targetTileZ
        );

        const effects: any[] = [];

        // Flip power card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            const updatedHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, updatedHero);
            currentHero = updatedHero;
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        for (const t of monstersOnTile) {
            const resolved = await CombatAdapter.resolveAttackAsync(
                currentHero,
                t,
                powerCard.attackBonus || 7,
                powerCard.damage || 2,
                0,
                newState
            );

            let damageDealt = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, damageDealt, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: damageDealt
            });
        }

        return {
            success: true,
            message: `${hero.name} uses Dagger Barrage on tile (${targetTileX}, ${targetTileZ})`,
            effects,
            newState
        };
    }

    private static executeDaggerBarrage(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Dagger Barrage requires a target', effects: [], newState: gameState };
        }

        let newState = { ...gameState };
        let currentHero = { ...hero };

        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;

        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated &&
            m.hp > 0 &&
            m.position.x === targetTileX &&
            m.position.z === targetTileZ
        );

        const effects: any[] = [];

        // Flip power card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            const updatedHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, updatedHero);
            currentHero = updatedHero;
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        for (const t of monstersOnTile) {
            const resolved = CombatSystem.resolveAttack(currentHero, 
                t,
                powerCard.attackBonus || 7,
                powerCard.damage || 2,
                0,
                undefined,
                newState
            );
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, resolved);
            newState = this.updateEntityInState(newState, currentHero);

            let damageDealt = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, damageDealt, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: damageDealt
            });
        }

        return {
            success: true,
            message: `${hero.name} uses Dagger Barrage on tile (${targetTileX}, ${targetTileZ})`,
            effects,
            newState
        };
    }

    private static pullMonstersForComeAndGetIt(
        hero: Hero,
        target: Entity,
        gameState: GameState
    ): { newState: GameState; movedMonsterIds: string[] } {
        let newState = { ...gameState };
        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;

        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated &&
            m.hp > 0 &&
            m.position.x === targetTileX &&
            m.position.z === targetTileZ
        );

        const adjOffsets = [
            { dx: 1, dz: 0 },
            { dx: -1, dz: 0 },
            { dx: 0, dz: 1 },
            { dx: 0, dz: -1 }
        ];

        const movedMonsterIds: string[] = [];

        // Track occupied squares on hero's tile to avoid overlaps as we move monsters
        const occupiedSquares = new Set<string>();
        for (const h of newState.heroes) {
            if (h.position.x === hero.position.x && h.position.z === hero.position.z) {
                occupiedSquares.add(`${h.position.sqX},${h.position.sqZ}`);
            }
        }
        for (const m of newState.monsters) {
            if (!m.isDefeated && m.hp > 0 && m.position.x === hero.position.x && m.position.z === hero.position.z) {
                occupiedSquares.add(`${m.position.sqX},${m.position.sqZ}`);
            }
        }

        for (const monster of monstersOnTile) {
            // Find a free adjacent square on the hero's tile
            let targetSq = null;
            for (const offset of adjOffsets) {
                const checkSqX = hero.position.sqX + offset.dx;
                const checkSqZ = hero.position.sqZ + offset.dz;

                if (checkSqX >= 0 && checkSqX < 4 && checkSqZ >= 0 && checkSqZ < 4) {
                    const key = `${checkSqX},${checkSqZ}`;
                    if (!occupiedSquares.has(key)) {
                        targetSq = { sqX: checkSqX, sqZ: checkSqZ };
                        break;
                    }
                }
            }

            if (targetSq) {
                // Remove monster's previous square from occupied if it was on hero's tile
                if (monster.position.x === hero.position.x && monster.position.z === hero.position.z) {
                    occupiedSquares.delete(`${monster.position.sqX},${monster.position.sqZ}`);
                }
                // Add new square to occupied
                occupiedSquares.add(`${targetSq.sqX},${targetSq.sqZ}`);

                const updatedMonster = {
                    ...monster,
                    position: {
                        x: hero.position.x,
                        z: hero.position.z,
                        sqX: targetSq.sqX,
                        sqZ: targetSq.sqZ
                    }
                };

                newState = this.updateEntityInState(newState, updatedMonster);
                movedMonsterIds.push(monster.id);
            }
        }

        return { newState, movedMonsterIds };
    }

    private static async executeComeAndGetItAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Come and Get It requires a target monster/tile', effects: [], newState: gameState };
        }

        // 1. Pull monsters
        const pullResult = this.pullMonstersForComeAndGetIt(hero, target, gameState);
        let newState = pullResult.newState;
        let currentHero = newState.heroes.find(h => h.id === hero.id) || hero;

        // 2. Find adjacent monsters
        const adjacentMonsters = newState.monsters.filter(m =>
            !m.isDefeated &&
            m.hp > 0 &&
            m.position.x === currentHero.position.x &&
            m.position.z === currentHero.position.z &&
            Math.abs(m.position.sqX - currentHero.position.sqX) + Math.abs(m.position.sqZ - currentHero.position.sqZ) === 1
        );

        const effects: any[] = [];
        let attackMessages = [];

        // 3. Attack each adjacent monster
        for (const m of adjacentMonsters) {
            const resolved = await CombatAdapter.resolveAttackAsync(
                currentHero,
                m,
                powerCard.attackBonus || 6,
                powerCard.damage || 1,
                0,
                newState
            );

            const updatedMonster = CombatSystem.applyDamage(m, resolved.damage, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            effects.push({
                type: 'attack_resolved',
                targetId: m.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.damage
            });

            attackMessages.push(`${m.name} (${resolved.hit ? 'HIT' : 'MISS'}, damage: ${resolved.damage})`);
        }

        // 4. Flip the daily power card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        const msg = `${hero.name} uses Come and Get It! Pulled ${pullResult.movedMonsterIds.length} monster(s) and attacked adjacent: ${attackMessages.join(', ')}`;
        return {
            success: true,
            message: msg,
            effects,
            newState
        };
    }

    private static executeComeAndGetIt(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Come and Get It requires a target monster/tile', effects: [], newState: gameState };
        }

        // 1. Pull monsters
        const pullResult = this.pullMonstersForComeAndGetIt(hero, target, gameState);
        let newState = pullResult.newState;
        let currentHero = newState.heroes.find(h => h.id === hero.id) || hero;

        // 2. Find adjacent monsters
        const adjacentMonsters = newState.monsters.filter(m =>
            !m.isDefeated &&
            m.hp > 0 &&
            m.position.x === currentHero.position.x &&
            m.position.z === currentHero.position.z &&
            Math.abs(m.position.sqX - currentHero.position.sqX) + Math.abs(m.position.sqZ - currentHero.position.sqZ) === 1
        );

        const effects: any[] = [];
        let attackMessages = [];

        // 3. Attack each adjacent monster
        for (const m of adjacentMonsters) {
            const resolved = CombatSystem.resolveAttack(currentHero, 
                m,
                powerCard.attackBonus || 6,
                powerCard.damage || 1,
                0,
                undefined,
                newState
            );
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, resolved);
            newState = this.updateEntityInState(newState, currentHero);

            const updatedMonster = CombatSystem.applyDamage(m, resolved.damage, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            effects.push({
                type: 'attack_resolved',
                targetId: m.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.damage
            });

            attackMessages.push(`${m.name} (${resolved.hit ? 'HIT' : 'MISS'}, damage: ${resolved.damage})`);
        }

        // 4. Flip the daily power card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        const msg = `${hero.name} uses Come and Get It! Pulled ${pullResult.movedMonsterIds.length} monster(s) and attacked adjacent: ${attackMessages.join(', ')}`;
        return {
            success: true,
            message: msg,
            effects,
            newState
        };
    }

    private static async executeTwinShotAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Twin Shot requires a target', effects: [], newState: gameState };
        }

        let newState = { ...gameState };
        const heroTile = newState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
        
        const otherMonster = newState.monsters.find(m => {
            if (m.id === target.id || m.isDefeated || m.hp <= 0) return false;
            const mTile = newState.tiles.find(t => t.x === m.position.x && t.z === m.position.z);
            if (!heroTile || !mTile) return false;
            return getTileGraphDistance(heroTile, mTile, newState.tiles) <= 1;
        });

        const targets = [target];
        if (otherMonster) targets.push(otherMonster);

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of targets) {
            const resolved = await CombatAdapter.resolveAttackAsync(
                hero,
                t,
                powerCard.attackBonus || 4,
                powerCard.damage || 1,
                0,
                newState
            );

            let updatedMonster = t;
            if (resolved.hit) {
                updatedMonster = CombatSystem.applyDamage(t, resolved.damage, newState);
                newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            }

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.hit ? resolved.damage : 0
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'})`);
        }

        return {
            success: true,
            message: `${hero.name} uses Twin Shot: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    private static executeTwinShot(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Twin Shot requires a target', effects: [], newState: gameState };
        }

        let newState = { ...gameState };
        const heroTile = newState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
        
        const otherMonster = newState.monsters.find(m => {
            if (m.id === target.id || m.isDefeated || m.hp <= 0) return false;
            const mTile = newState.tiles.find(t => t.x === m.position.x && t.z === m.position.z);
            if (!heroTile || !mTile) return false;
            return getTileGraphDistance(heroTile, mTile, newState.tiles) <= 1;
        });

        const targets = [target];
        if (otherMonster) targets.push(otherMonster);

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of targets) {
            const resolved = CombatSystem.resolveAttack(hero, 
                t,
                powerCard.attackBonus || 4,
                powerCard.damage || 1,
                0,
                undefined,
                newState
            );
            hero = CombatSystem.applyAttackResultEffects(hero, resolved);
            newState = this.updateEntityInState(newState, hero);

            let updatedMonster = t;
            if (resolved.hit) {
                updatedMonster = CombatSystem.applyDamage(t, resolved.damage, newState);
                newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            }

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.hit ? resolved.damage : 0
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'})`);
        }

        return {
            success: true,
            message: `${hero.name} uses Twin Shot: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    private static async executeAttacksOnTheRunAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Attacks on the Run requires a target', effects: [], newState: gameState };
        }

        const moveRes = this.processEffect({ type: 'move', value: 6 }, hero, target, gameState, powerCard);
        let newState = moveRes.newState;
        let currentHero = moveRes.hero;

        const otherMonster = newState.monsters.find(m => {
            if (m.id === target.id || m.isDefeated || m.hp <= 0) return false;
            return m.position.x === currentHero.position.x &&
                m.position.z === currentHero.position.z &&
                Math.abs(m.position.sqX - currentHero.position.sqX) + Math.abs(m.position.sqZ - currentHero.position.sqZ) === 1;
        });

        const targets = [target];
        if (otherMonster) targets.push(otherMonster);

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of targets) {
            const resolved = await CombatAdapter.resolveAttackAsync(
                currentHero,
                t,
                powerCard.attackBonus || 4,
                powerCard.damage || 2,
                0,
                newState
            );

            let damageDealt = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            const updatedMonster = CombatSystem.applyDamage(t, damageDealt, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: damageDealt
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'}, damage: ${damageDealt})`);
        }

        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        return {
            success: true,
            message: `${currentHero.name} uses Attacks on the Run: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    private static executeAttacksOnTheRun(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Attacks on the Run requires a target', effects: [], newState: gameState };
        }

        const moveRes = this.processEffect({ type: 'move', value: 6 }, hero, target, gameState, powerCard);
        let newState = moveRes.newState;
        let currentHero = moveRes.hero;

        const otherMonster = newState.monsters.find(m => {
            if (m.id === target.id || m.isDefeated || m.hp <= 0) return false;
            return m.position.x === currentHero.position.x &&
                m.position.z === currentHero.position.z &&
                Math.abs(m.position.sqX - currentHero.position.sqX) + Math.abs(m.position.sqZ - currentHero.position.sqZ) === 1;
        });

        const targets = [target];
        if (otherMonster) targets.push(otherMonster);

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of targets) {
            const resolved = CombatSystem.resolveAttack(currentHero, 
                t,
                powerCard.attackBonus || 4,
                powerCard.damage || 2,
                0,
                undefined,
                newState
            );
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, resolved);
            newState = this.updateEntityInState(newState, currentHero);

            let damageDealt = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            const updatedMonster = CombatSystem.applyDamage(t, damageDealt, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: damageDealt
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'}, damage: ${damageDealt})`);
        }

        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        return {
            success: true,
            message: `${currentHero.name} uses Attacks on the Run: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    private static async executeSplitTheTreeAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Split the Tree requires a target', effects: [], newState: gameState };
        }

        let newState = { ...gameState };
        let currentHero = { ...hero };

        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;

        const otherMonster = newState.monsters.find(m => {
            return m.id !== target.id &&
                !m.isDefeated &&
                m.hp > 0 &&
                m.position.x === targetTileX &&
                m.position.z === targetTileZ;
        });

        const targets = [target];
        if (otherMonster) targets.push(otherMonster);

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of targets) {
            const resolved = await CombatAdapter.resolveAttackAsync(
                currentHero,
                t,
                powerCard.attackBonus || 6,
                powerCard.damage || 2,
                0,
                newState
            );

            let damageDealt = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, damageDealt, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: damageDealt
            });

            if (!resolved.hit) {
                const moveRes = this.processEffect({ type: 'move', value: 1 }, currentHero, updatedMonster, newState, powerCard);
                newState = moveRes.newState;
                currentHero = moveRes.hero;
                if (moveRes.target) {
                    updatedMonster = moveRes.target as Monster;
                }
            }

            msgParts.push(`${updatedMonster.name} (${resolved.hit ? 'HIT' : 'MISS'}, damage: ${damageDealt})`);
        }

        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        return {
            success: true,
            message: `${currentHero.name} uses Split the Tree: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    private static executeSplitTheTree(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Split the Tree requires a target', effects: [], newState: gameState };
        }

        let newState = { ...gameState };
        let currentHero = { ...hero };

        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;

        const otherMonster = newState.monsters.find(m => {
            return m.id !== target.id &&
                !m.isDefeated &&
                m.hp > 0 &&
                m.position.x === targetTileX &&
                m.position.z === targetTileZ;
        });

        const targets = [target];
        if (otherMonster) targets.push(otherMonster);

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of targets) {
            const resolved = CombatSystem.resolveAttack(currentHero, 
                t,
                powerCard.attackBonus || 6,
                powerCard.damage || 2,
                0,
                undefined,
                newState
            );
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, resolved);
            newState = this.updateEntityInState(newState, currentHero);

            let damageDealt = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, damageDealt, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);

            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: damageDealt
            });

            if (!resolved.hit) {
                const moveRes = this.processEffect({ type: 'move', value: 1 }, currentHero, updatedMonster, newState, powerCard);
                newState = moveRes.newState;
                currentHero = moveRes.hero;
                if (moveRes.target) {
                    updatedMonster = moveRes.target as Monster;
                }
            }

            msgParts.push(`${updatedMonster.name} (${resolved.hit ? 'HIT' : 'MISS'}, damage: ${damageDealt})`);
        }

        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        return {
            success: true,
            message: `${currentHero.name} uses Split the Tree: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    /**
     * Processes a single effect from a power card
     */
     private static processEffect(
         effect: any,
         hero: Hero,
         target: Entity | null,
         gameState: GameState,
         powerCard?: Card
     ): { result: any; newState: GameState; hero: Hero; target: Entity | null } {
         let newState = { ...gameState };
         let currentHero = { ...hero };
         let currentTarget = target ? { ...target } : null;
 
         switch (effect.type) {
             case 'damage': {
                 if (effect.target === 'area' && currentTarget) {
                     // For area damage like Cleave, find another monster on the same tile
                     const otherMonster = newState.monsters.find(m =>
                         m.id !== currentTarget!.id &&
                         !m.isDefeated &&
                         m.hp > 0 &&
                         m.position.x === currentTarget!.position.x &&
                         m.position.z === currentTarget!.position.z
                     );
 
                     if (otherMonster) {
                         const damage = effect.value || 0;
                         const isCleave = powerCard?.id === 'fighter_cleave';
 
                         // Cleave specific movement: move hero adjacent to otherMonster on same tile
                         if (isCleave) {
                             const adjOffsets = [
                                 { dx: 1, dz: 0 },
                                 { dx: -1, dz: 0 },
                                 { dx: 0, dz: 1 },
                                 { dx: 0, dz: -1 }
                             ];
 
                             let foundSquare = null;
                             for (const offset of adjOffsets) {
                                 const checkSqX = otherMonster.position.sqX + offset.dx;
                                 const checkSqZ = otherMonster.position.sqZ + offset.dz;
 
                                 if (checkSqX >= 0 && checkSqX < 4 && checkSqZ >= 0 && checkSqZ < 4) {
                                     const isHeroOccupied = newState.heroes.some(h =>
                                         h.position.x === otherMonster.position.x &&
                                         h.position.z === otherMonster.position.z &&
                                         h.position.sqX === checkSqX &&
                                         h.position.sqZ === checkSqZ
                                     );
                                     const isMonsterOccupied = newState.monsters.some(m =>
                                         !m.isDefeated &&
                                         m.hp > 0 &&
                                         m.position.x === otherMonster.position.x &&
                                         m.position.z === otherMonster.position.z &&
                                         m.position.sqX === checkSqX &&
                                         m.position.sqZ === checkSqZ
                                     );
 
                                     if (!isHeroOccupied && !isMonsterOccupied) {
                                         foundSquare = { sqX: checkSqX, sqZ: checkSqZ };
                                         break;
                                     }
                                 }
                             }
 
                             if (foundSquare) {
                                 currentHero = {
                                     ...currentHero,
                                     position: {
                                         ...currentHero.position,
                                         x: otherMonster.position.x,
                                         z: otherMonster.position.z,
                                         sqX: foundSquare.sqX,
                                         sqZ: foundSquare.sqZ
                                     }
                                 };
                                 newState = this.updateEntityInState(newState, currentHero);
                             }
                         }
 
                         const updatedOther = CombatSystem.applyDamage(otherMonster, damage);
                         newState = this.updateEntityInState(newState, updatedOther.hp <= 0 ? { ...updatedOther, isDefeated: true } : updatedOther);
 
                         return {
                             result: {
                                 type: 'cleave_resolved',
                                 cleaveTargetId: otherMonster.id,
                                 damage,
                                 newPosition: currentHero.position
                             },
                             newState,
                             hero: currentHero,
                             target: currentTarget
                         };
                     }
 
                     return {
                         result: { type: 'cleave_failed', reason: 'No other monster on tile' },
                         newState,
                         hero: currentHero,
                         target: currentTarget
                     };
                 }
 
                 if (currentTarget) {
                    if (effect.condition) {
                        const cond = effect.condition.toLowerCase();
                        const targetHp = currentTarget.hp ?? 0;
                        const targetMaxHp = currentTarget.maxHp ?? targetHp;
                        const isDamaged = targetHp < targetMaxHp;
                        const monsterType = isMonsterEntity(currentTarget) ? currentTarget.monsterType.toLowerCase() : '';
                        const isUndead = monsterType.includes('undead') || monsterType.includes('dracolich');
                        let conditionMet: boolean;
                        switch (cond) {
                            case 'damaged':
                                conditionMet = isDamaged;
                                break;
                            case 'undead':
                                conditionMet = isUndead;
                                break;
                            case 'adjacent_to_hero':
                                conditionMet = newState.heroes.some(h =>
                                    h.id !== currentHero.id &&
                                    Math.abs(h.position.x - currentTarget!.position.x) + Math.abs(h.position.z - currentTarget!.position.z) <= 1
                                );
                                break;
                            default:
                                if (isDev()) console.warn(`[PowerSystem] Unknown damage condition: ${effect.condition}`);
                                conditionMet = false;
                        }
                        if (!conditionMet) {
                            return { result: { type: 'damage_skipped', reason: `Condition not met: ${effect.condition}` }, newState, hero: currentHero, target: currentTarget };
                        }
                    }
                    const damage = effect.value || 0;
                    const updatedTarget = CombatSystem.applyDamage(currentTarget, damage);
                    const finalTarget = (isMonsterEntity(updatedTarget) && updatedTarget.hp <= 0)
                        ? { ...updatedTarget, isDefeated: true }
                        : updatedTarget;
                    newState = this.updateEntityInState(newState, finalTarget);

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
            }

            case 'heal': {
                let healAmount = 0;
                const healTarget = this.resolveSingleTarget(effect, currentHero, currentTarget);

                if (effect.target === 'tile' || effect.target === 'area') {
                    const healVal = effect.value === 'surge' ? Math.ceil(currentHero.maxHp / 2) : (Number(effect.value) || 0);
                    const result = this.applyToTileHeroes(newState, currentHero, currentTarget, h =>
                        CombatSystem.applyHealing(h, healVal)
                    );
                    return {
                        result: { type: 'heal_applied_area', healAmount: healVal },
                        newState: result.newState,
                        hero: result.hero,
                        target: result.target
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
            }

            case 'remove_condition': {
                const removeTarget = this.resolveSingleTarget(effect, currentHero, currentTarget);

                if (effect.target === 'tile' || effect.target === 'area') {
                    const result = this.applyToTileHeroes(newState, currentHero, currentTarget, h =>
                        ConditionSystem.clearAllConditions(h)
                    );
                    return {
                        result: { type: 'condition_removed_area' },
                        newState: result.newState,
                        hero: result.hero,
                        target: result.target
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
            }

            case 'status_effect': {
                if (currentTarget && effect.statusEffect) {
                    const updatedTarget = CombatSystem.applyCondition(currentTarget, effect.statusEffect!, currentHero.id, effect.duration || 1);
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
            }

            case 'attack_bonus': {
                const bonusVal = effect.value || 0;
                const duration = effect.duration || 1;
                
                let targetHeroes: Hero[] = [];
                if (effect.target === 'self') {
                    targetHeroes = [currentHero];
                } else if (effect.target === 'all_heroes') {
                    const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
                    targetHeroes = newState.heroes.filter(h => {
                        const hTile = newState.tiles.find(t => t.x === h.position.x && t.z === h.position.z);
                        if (!heroTile || !hTile) return false;
                        return getTileGraphDistance(heroTile, hTile, newState.tiles) <= 1;
                    });
                } else if (currentTarget && !isMonsterEntity(currentTarget)) {
                    targetHeroes = [currentTarget as Hero];
                }

                for (const th of targetHeroes) {
                    const updated = ConditionSystem.applyCondition(th, 'attack_bonus', currentHero.id, duration, bonusVal);
                    newState = this.updateEntityInState(newState, updated);
                    if (updated.id === currentHero.id) {
                        currentHero = updated as Hero;
                    }
                    if (currentTarget && updated.id === currentTarget.id) {
                        currentTarget = updated;
                    }
                }

                return {
                    result: { type: 'attack_bonus_applied', value: bonusVal, duration },
                    newState,
                    hero: currentHero,
                    target: currentTarget
                };
            }

            case 'damage_bonus': {
                const bonusVal = effect.value || 0;
                const duration = effect.duration || 1;
                
                let targetHeroes: Hero[] = [];
                if (effect.target === 'self') {
                    targetHeroes = [currentHero];
                } else if (effect.target === 'all_heroes') {
                    const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
                    targetHeroes = newState.heroes.filter(h => {
                        const hTile = newState.tiles.find(t => t.x === h.position.x && t.z === h.position.z);
                        if (!heroTile || !hTile) return false;
                        return getTileGraphDistance(heroTile, hTile, newState.tiles) <= 1;
                    });
                } else if (currentTarget && !isMonsterEntity(currentTarget)) {
                    targetHeroes = [currentTarget as Hero];
                }

                for (const th of targetHeroes) {
                    const updated = ConditionSystem.applyCondition(th, 'damage_bonus', currentHero.id, duration, bonusVal);
                    newState = this.updateEntityInState(newState, updated);
                    if (updated.id === currentHero.id) {
                        currentHero = updated as Hero;
                    }
                    if (currentTarget && updated.id === currentTarget.id) {
                        currentTarget = updated;
                    }
                }

                return {
                    result: { type: 'damage_bonus_applied', value: bonusVal, duration },
                    newState,
                    hero: currentHero,
                    target: currentTarget
                };
            }

            case 'defense_bonus':
                // TODO: implement temporary defense bonus (needs effects layer on hero with expiry)
                return { result: { type: 'defense_bonus_applied', value: effect.value, duration: effect.duration }, newState, hero: currentHero, target: currentTarget };

            case 'move': {
                const isTideOfIron = powerCard?.id === 'fighter_tide_of_iron';
                const isGetOverThere = powerCard?.id === 'fighter_get_over_there';

                if (isTideOfIron && currentTarget && !isHeroEntity(currentTarget)) {
                    const monster = currentTarget as Monster;

                    // 1. Move the Monster (if not destroyed) to a tile within 1 tile of the hero
                    if (monster.hp > 0 && !monster.isDefeated) {
                        const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
                        
                        // Find a valid tile within graph distance <= 1
                        const validTiles = newState.tiles.filter(t => {
                            if (!heroTile) return false;
                            return getTileGraphDistance(heroTile, t, newState.tiles) <= 1;
                        });

                        // Find first available unoccupied square on any valid tile
                        let foundMonsterPos = null;
                        for (const tile of validTiles) {
                            for (let sqX = 0; sqX < 4; sqX++) {
                                for (let sqZ = 0; sqZ < 4; sqZ++) {
                                    const occupied = 
                                        newState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                        newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                                    if (!occupied) {
                                        foundMonsterPos = { x: tile.x, z: tile.z, sqX, sqZ };
                                        break;
                                    }
                                }
                                if (foundMonsterPos) break;
                            }
                            if (foundMonsterPos) break;
                        }

                        if (foundMonsterPos) {
                            const updatedMonster = {
                                ...monster,
                                position: foundMonsterPos
                            };
                            newState = this.updateEntityInState(newState, updatedMonster);
                            currentTarget = updatedMonster;
                        }
                    }

                    // 2. Move the Hero to any unoccupied square on their current tile
                    let foundHeroPos = null;
                    for (let sqX = 0; sqX < 4; sqX++) {
                        for (let sqZ = 0; sqZ < 4; sqZ++) {
                            const occupied = 
                                newState.heroes.some(h => h.position.x === currentHero.position.x && h.position.z === currentHero.position.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === currentHero.position.x && m.position.z === currentHero.position.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                            if (!occupied) {
                                foundHeroPos = { sqX, sqZ };
                                break;
                            }
                        }
                        if (foundHeroPos) break;
                    }

                    if (foundHeroPos) {
                        currentHero = {
                            ...currentHero,
                            position: {
                                ...currentHero.position,
                                sqX: foundHeroPos.sqX,
                                sqZ: foundHeroPos.sqZ
                            }
                        };
                        newState = this.updateEntityInState(newState, currentHero);
                    }

                    return {
                        result: { type: 'tide_of_iron_resolved', monsterNewPos: currentTarget.position, heroNewPos: currentHero.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                if (isGetOverThere && currentTarget && !isHeroEntity(currentTarget)) {
                    // Place hero adjacent to the monster (currentTarget) on the monster's tile
                    const targetPos = currentTarget.position;
                    const adjOffsets = [
                        { dx: 1, dz: 0 },
                        { dx: -1, dz: 0 },
                        { dx: 0, dz: 1 },
                        { dx: 0, dz: -1 }
                    ];

                    let foundSquare = null;
                    for (const offset of adjOffsets) {
                        const checkSqX = targetPos.sqX + offset.dx;
                        const checkSqZ = targetPos.sqZ + offset.dz;

                        if (checkSqX >= 0 && checkSqX < 4 && checkSqZ >= 0 && checkSqZ < 4) {
                            const isHeroOccupied = newState.heroes.some(h =>
                                h.position.x === targetPos.x &&
                                h.position.z === targetPos.z &&
                                h.position.sqX === checkSqX &&
                                h.position.sqZ === checkSqZ
                            );
                            const isMonsterOccupied = newState.monsters.some(m =>
                                !m.isDefeated &&
                                m.hp > 0 &&
                                m.position.x === targetPos.x &&
                                m.position.z === targetPos.z &&
                                m.position.sqX === checkSqX &&
                                m.position.sqZ === checkSqZ
                            );

                            if (!isHeroOccupied && !isMonsterOccupied) {
                                foundSquare = { sqX: checkSqX, sqZ: checkSqZ };
                                break;
                            }
                        }
                    }

                    if (foundSquare) {
                        currentHero = {
                            ...currentHero,
                            position: {
                                ...currentHero.position,
                                x: currentTarget.position.x,
                                z: currentTarget.position.z,
                                sqX: foundSquare.sqX,
                                sqZ: foundSquare.sqZ
                            }
                        };
                        newState = this.updateEntityInState(newState, currentHero);
                    }

                    return {
                        result: { type: 'get_over_there_resolved', newPosition: currentHero.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                const isDeftStrike = powerCard?.id === 'rogue_deft_strike';
                if (isDeftStrike) {
                    return {
                        result: { type: 'deft_strike_move_done', newPosition: currentHero.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                const isGreatLeap = powerCard?.id === 'rogue_great_leap';
                const isGenericMoveSelf = effect.target === 'self' && effect.type === 'move';
                if (isGreatLeap || isGenericMoveSelf) {
                    const rangeVal = effect.value || 0;
                    const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
                    const validTiles = newState.tiles.filter(t => {
                        if (!heroTile) return false;
                        return getTileGraphDistance(heroTile, t, newState.tiles) <= rangeVal;
                    }).sort((a, b) => {
                        if (!heroTile) return 0;
                        const distA = getTileGraphDistance(heroTile, a, newState.tiles);
                        const distB = getTileGraphDistance(heroTile, b, newState.tiles);
                        return distB - distA;
                    });

                    let foundHeroPos = null;
                    for (const tile of validTiles) {
                        for (let sqX = 0; sqX < 4; sqX++) {
                            for (let sqZ = 0; sqZ < 4; sqZ++) {
                                const occupied = 
                                    newState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                    newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                                if (!occupied) {
                                    foundHeroPos = { x: tile.x, z: tile.z, sqX, sqZ };
                                    break;
                                }
                            }
                            if (foundHeroPos) break;
                        }
                        if (foundHeroPos) break;
                    }

                    if (foundHeroPos) {
                        currentHero = {
                            ...currentHero,
                            position: {
                                ...currentHero.position,
                                x: foundHeroPos.x,
                                z: foundHeroPos.z,
                                sqX: foundHeroPos.sqX,
                                sqZ: foundHeroPos.sqZ
                            }
                        };
                        newState = this.updateEntityInState(newState, currentHero);
                    }

                    return {
                        result: { type: isGreatLeap ? 'great_leap_resolved' : 'move_applied', newPosition: currentHero.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                const isHitAndRun = powerCard?.id === 'ranger_hit_and_run';
                if (isHitAndRun) {
                    let foundHeroPos = null;
                    for (let sqX = 0; sqX < 4; sqX++) {
                        for (let sqZ = 0; sqZ < 4; sqZ++) {
                            const occupied = 
                                newState.heroes.some(h => h.position.x === currentHero.position.x && h.position.z === currentHero.position.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === currentHero.position.x && m.position.z === currentHero.position.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                            if (!occupied) {
                                foundHeroPos = { sqX, sqZ };
                                break;
                            }
                        }
                        if (foundHeroPos) break;
                    }

                    if (foundHeroPos) {
                        currentHero = {
                            ...currentHero,
                            position: {
                                ...currentHero.position,
                                sqX: foundHeroPos.sqX,
                                sqZ: foundHeroPos.sqZ
                            }
                        };
                        newState = this.updateEntityInState(newState, currentHero);
                    }

                    return {
                        result: { type: 'hit_and_run_resolved', newPosition: currentHero.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                const isHuntersShot = powerCard?.id === 'ranger_hunters_shot';
                const isSplitTheTree = powerCard?.id === 'ranger_split_the_tree';
                const isMagicMissile = powerCard?.id === 'wizard_magic_missile';
                if ((isHuntersShot || isSplitTheTree || isMagicMissile) && currentTarget && !isHeroEntity(currentTarget)) {
                    const monster = currentTarget as Monster;
                    if (monster.hp > 0 && !monster.isDefeated) {
                        const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
                        const monsterTile = newState.tiles.find(t => t.x === monster.position.x && t.z === monster.position.z);
                        if (heroTile && monsterTile) {
                            const dist = getTileGraphDistance(heroTile, monsterTile, newState.tiles);
                            if (dist > 1) {
                                // Find an adjacent tile to the monster's current tile whose graph distance to hero is less than dist
                                const adjacentTiles = newState.tiles.filter(t => {
                                    return getTileGraphDistance(monsterTile, t, newState.tiles) === 1;
                                });

                                const closerTile = adjacentTiles.find(t => {
                                    return getTileGraphDistance(heroTile, t, newState.tiles) < dist;
                                });

                                if (closerTile) {
                                    // Find unoccupied square on closerTile
                                    let foundMonsterPos = null;
                                    for (let sqX = 0; sqX < 4; sqX++) {
                                        for (let sqZ = 0; sqZ < 4; sqZ++) {
                                            const occupied = 
                                                newState.heroes.some(h => h.position.x === closerTile.x && h.position.z === closerTile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                                newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === closerTile.x && m.position.z === closerTile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                                            if (!occupied) {
                                                foundMonsterPos = { x: closerTile.x, z: closerTile.z, sqX, sqZ };
                                                break;
                                            }
                                        }
                                        if (foundMonsterPos) break;
                                    }

                                    if (foundMonsterPos) {
                                        const updatedMonster = {
                                            ...monster,
                                            position: foundMonsterPos
                                        };
                                        newState = this.updateEntityInState(newState, updatedMonster);
                                        currentTarget = updatedMonster;
                                    }
                                }
                            }
                        }
                    }

                    return {
                        result: { type: 'monster_moved_closer', monsterNewPos: currentTarget.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                const isBoundingAttack = powerCard?.id === 'ranger_bounding_attack';
                if (isBoundingAttack) {
                    const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
                    const validTiles = newState.tiles.filter(t => {
                        if (!heroTile) return false;
                        return getTileGraphDistance(heroTile, t, newState.tiles) <= 1;
                    });

                    let foundHeroPos = null;
                    for (const tile of validTiles) {
                        for (let sqX = 0; sqX < 4; sqX++) {
                            for (let sqZ = 0; sqZ < 4; sqZ++) {
                                const occupied = 
                                    newState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                    newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                                if (!occupied) {
                                    foundHeroPos = { x: tile.x, z: tile.z, sqX, sqZ };
                                    break;
                                }
                            }
                            if (foundHeroPos) break;
                        }
                        if (foundHeroPos) break;
                    }

                    if (foundHeroPos) {
                        currentHero = {
                            ...currentHero,
                            position: {
                                ...currentHero.position,
                                x: foundHeroPos.x,
                                z: foundHeroPos.z,
                                sqX: foundHeroPos.sqX,
                                sqZ: foundHeroPos.sqZ
                            }
                        };
                        newState = this.updateEntityInState(newState, currentHero);
                    }

                    return {
                        result: { type: 'bounding_attack_resolved', newPosition: currentHero.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                const isAttacksOnTheRun = powerCard?.id === 'ranger_attacks_on_the_run';
                if (isAttacksOnTheRun) {
                    const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
                    const validTiles = newState.tiles.filter(t => {
                        if (!heroTile) return false;
                        return getTileGraphDistance(heroTile, t, newState.tiles) <= 1;
                    });

                    let foundHeroPos = null;
                    for (const tile of validTiles) {
                        for (let sqX = 0; sqX < 4; sqX++) {
                            for (let sqZ = 0; sqZ < 4; sqZ++) {
                                let distance = 0;
                                if (tile.x === currentHero.position.x && tile.z === currentHero.position.z) {
                                    distance = Math.abs(sqX - currentHero.position.sqX) + Math.abs(sqZ - currentHero.position.sqZ);
                                } else {
                                    distance = 4 + Math.abs(sqX - currentHero.position.sqX) + Math.abs(sqZ - currentHero.position.sqZ);
                                }

                                if (distance <= 6) {
                                    const occupied = 
                                        newState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                        newState.monsters.some(m => !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sqX && m.position.sqZ === sqZ);

                                    if (!occupied) {
                                        foundHeroPos = { x: tile.x, z: tile.z, sqX, sqZ };
                                        break;
                                    }
                                }
                            }
                            if (foundHeroPos) break;
                        }
                        if (foundHeroPos) break;
                    }

                    if (foundHeroPos) {
                        currentHero = {
                            ...currentHero,
                            position: {
                                ...currentHero.position,
                                x: foundHeroPos.x,
                                z: foundHeroPos.z,
                                sqX: foundHeroPos.sqX,
                                sqZ: foundHeroPos.sqZ
                            }
                        };
                        newState = this.updateEntityInState(newState, currentHero);
                    }

                    return {
                        result: { type: 'attacks_on_the_run_resolved', newPosition: currentHero.position },
                        newState,
                        hero: currentHero,
                        target: currentTarget
                    };
                }

                return { result: { type: 'move_applied', value: effect.value }, newState, hero: currentHero, target: currentTarget };
            }

            case 'draw_card':
                // TODO: implement draw_card effect — currently returns result without modifying state
                return { result: { type: 'draw_card', count: effect.value || 1 }, newState, hero: currentHero, target: currentTarget };

            default:
                return { result: { type: 'unknown_effect', effectType: effect.type }, newState, hero: currentHero, target: currentTarget };
        }
    }

    private static executeScorchingBurst(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Scorching Burst requires a target to select the tile', effects: [], newState: gameState };
        }
        let newState = { ...gameState };
        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;
        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated && m.hp > 0 && m.position.x === targetTileX && m.position.z === targetTileZ
        );
        const effects: any[] = [];
        const msgParts: string[] = [];
        for (const t of monstersOnTile) {
            const resolved = CombatSystem.resolveAttack(hero,  t, powerCard.attackBonus || 7, powerCard.damage || 1, 0, undefined, newState);
            hero = CombatSystem.applyAttackResultEffects(hero, resolved);
            newState = this.updateEntityInState(newState, hero);
            let updatedMonster = t;
            if (resolved.hit) {
                updatedMonster = CombatSystem.applyDamage(t, resolved.damage, newState);
                newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            }
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.hit ? resolved.damage : 0
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'})`);
        }
        return {
            success: true,
            message: `${hero.name} uses Scorching Burst on tile (${targetTileX}, ${targetTileZ}): ${msgParts.length > 0 ? msgParts.join(', ') : 'No monsters on tile'}`,
            effects,
            newState
        };
    }

    private static async executeScorchingBurstAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Scorching Burst requires a target to select the tile', effects: [], newState: gameState };
        }
        let newState = { ...gameState };
        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;
        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated && m.hp > 0 && m.position.x === targetTileX && m.position.z === targetTileZ
        );
        const effects: any[] = [];
        const msgParts: string[] = [];
        for (const t of monstersOnTile) {
            const resolved = await CombatAdapter.resolveAttackAsync(hero, t, powerCard.attackBonus || 7, powerCard.damage || 1, 0, newState);
            let updatedMonster = t;
            if (resolved.hit) {
                updatedMonster = CombatSystem.applyDamage(t, resolved.damage, newState);
                newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            }
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.hit ? resolved.damage : 0
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'})`);
        }
        return {
            success: true,
            message: `${hero.name} uses Scorching Burst on tile (${targetTileX}, ${targetTileZ}): ${msgParts.length > 0 ? msgParts.join(', ') : 'No monsters on tile'}`,
            effects,
            newState
        };
    }

    private static executeFireball(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Fireball requires a target to select the tile', effects: [], newState: gameState };
        }
        let newState = { ...gameState };
        let currentHero = { ...hero };
        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;
        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated && m.hp > 0 && m.position.x === targetTileX && m.position.z === targetTileZ
        );
        const effects: any[] = [];
        const msgParts: string[] = [];

        // Flip daily card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        for (const t of monstersOnTile) {
            const resolved = CombatSystem.resolveAttack(currentHero,  t, powerCard.attackBonus || 7, powerCard.damage || 3, 0, undefined, newState);
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, resolved);
            newState = this.updateEntityInState(newState, currentHero);
            const finalDamage = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, finalDamage, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: finalDamage
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'}, Damage: ${finalDamage})`);
        }
        return {
            success: true,
            message: `${currentHero.name} uses Fireball on tile (${targetTileX}, ${targetTileZ}): ${msgParts.length > 0 ? msgParts.join(', ') : 'No monsters on tile'}`,
            effects,
            newState
        };
    }

    private static async executeFireballAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Fireball requires a target to select the tile', effects: [], newState: gameState };
        }
        let newState = { ...gameState };
        let currentHero = { ...hero };
        const targetTileX = target.position.x;
        const targetTileZ = target.position.z;
        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated && m.hp > 0 && m.position.x === targetTileX && m.position.z === targetTileZ
        );
        const effects: any[] = [];
        const msgParts: string[] = [];

        // Flip daily card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        for (const t of monstersOnTile) {
            const resolved = await CombatAdapter.resolveAttackAsync(currentHero, t, powerCard.attackBonus || 7, powerCard.damage || 3, 0, newState);
            const finalDamage = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, finalDamage, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: finalDamage
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'}, Damage: ${finalDamage})`);
        }
        return {
            success: true,
            message: `${currentHero.name} uses Fireball on tile (${targetTileX}, ${targetTileZ}): ${msgParts.length > 0 ? msgParts.join(', ') : 'No monsters on tile'}`,
            effects,
            newState
        };
    }

    private static executeLightningBolt(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        if (!target) {
            return { success: false, message: 'Lightning Bolt requires a target', effects: [], newState: gameState };
        }
        let newState = { ...gameState };
        let currentHero = { ...hero };
        const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
        const otherMonsters = newState.monsters.filter(m => {
            if (m.id === target.id || m.isDefeated || m.hp <= 0) return false;
            const mTile = newState.tiles.find(t => t.x === m.position.x && t.z === m.position.z);
            if (!heroTile || !mTile) return false;
            return getTileGraphDistance(heroTile, mTile, newState.tiles) <= 1;
        }).slice(0, 2);
        const targets = [target, ...otherMonsters];
        const effects: any[] = [];
        const msgParts: string[] = [];

        // Flip daily card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        for (const t of targets) {
            const resolved = CombatSystem.resolveAttack(currentHero,  t, powerCard.attackBonus || 7, powerCard.damage || 2, 0, undefined, newState);
            currentHero = CombatSystem.applyAttackResultEffects(currentHero, resolved);
            newState = this.updateEntityInState(newState, currentHero);
            const finalDamage = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, finalDamage, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: finalDamage
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'}, Damage: ${finalDamage})`);
        }
        return {
            success: true,
            message: `${currentHero.name} uses Lightning Bolt: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    private static async executeLightningBoltAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        if (!target) {
            return { success: false, message: 'Lightning Bolt requires a target', effects: [], newState: gameState };
        }
        let newState = { ...gameState };
        let currentHero = { ...hero };
        const heroTile = newState.tiles.find(t => t.x === currentHero.position.x && t.z === currentHero.position.z);
        const otherMonsters = newState.monsters.filter(m => {
            if (m.id === target.id || m.isDefeated || m.hp <= 0) return false;
            const mTile = newState.tiles.find(t => t.x === m.position.x && t.z === m.position.z);
            if (!heroTile || !mTile) return false;
            return getTileGraphDistance(heroTile, mTile, newState.tiles) <= 1;
        }).slice(0, 2);
        const targets = [target, ...otherMonsters];
        const effects: any[] = [];
        const msgParts: string[] = [];

        // Flip daily card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        for (const t of targets) {
            const resolved = await CombatAdapter.resolveAttackAsync(currentHero, t, powerCard.attackBonus || 7, powerCard.damage || 2, 0, newState);
            const finalDamage = resolved.hit ? resolved.damage : 1; // Miss: 1 Damage
            let updatedMonster = CombatSystem.applyDamage(t, finalDamage, newState);
            newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: finalDamage
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'}, Damage: ${finalDamage})`);
        }
        return {
            success: true,
            message: `${currentHero.name} uses Lightning Bolt: ${msgParts.join(', ')}`,
            effects,
            newState
        };
    }

    private static executeThunderwave(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        let newState = { ...gameState };
        const heroTile = newState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
        if (!heroTile) {
            return { success: false, message: 'Hero tile not found', effects: [], newState: gameState };
        }
        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated && m.hp > 0 && m.position.x === hero.position.x && m.position.z === hero.position.z
        );

        let destTile = newState.tiles.find(t => {
            if (t.id === heroTile.id) return false;
            return getTileGraphDistance(heroTile, t, newState.tiles) === 1;
        });
        if (target && (target.position.x !== hero.position.x || target.position.z !== hero.position.z)) {
            const targetTile = newState.tiles.find(t => t.x === target.position.x && t.z === target.position.z);
            if (targetTile && getTileGraphDistance(heroTile, targetTile, newState.tiles) === 1) {
                destTile = targetTile;
            }
        }

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of monstersOnTile) {
            const resolved = CombatSystem.resolveAttack(hero,  t, powerCard.attackBonus || 7, powerCard.damage || 1, 0, undefined, newState);
            hero = CombatSystem.applyAttackResultEffects(hero, resolved);
            newState = this.updateEntityInState(newState, hero);
            let updatedMonster = t;
            if (resolved.hit) {
                updatedMonster = CombatSystem.applyDamage(t, resolved.damage, newState);
                newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            }
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.hit ? resolved.damage : 0
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'})`);
        }

        if (destTile) {
            for (const m of monstersOnTile) {
                const currentM = newState.monsters.find(mon => mon.id === m.id);
                if (!currentM || currentM.isDefeated || currentM.hp <= 0) continue;

                let foundPos = null;
                for (let sqX = 0; sqX < 4; sqX++) {
                    for (let sqZ = 0; sqZ < 4; sqZ++) {
                        const occupied = 
                            newState.heroes.some(h => h.position.x === destTile!.x && h.position.z === destTile!.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                            newState.monsters.some(mon => !mon.isDefeated && mon.hp > 0 && mon.position.x === destTile!.x && mon.position.z === destTile!.z && mon.position.sqX === sqX && mon.position.sqZ === sqZ);
                        if (!occupied) {
                            foundPos = { x: destTile!.x, z: destTile!.z, sqX, sqZ };
                            break;
                        }
                    }
                    if (foundPos) break;
                }
                if (foundPos) {
                    const updatedMonster = { ...currentM, position: foundPos };
                    newState = this.updateEntityInState(newState, updatedMonster);
                    effects.push({ type: 'monster_moved', targetId: m.id, newPosition: foundPos });
                }
            }
        }

        const destTileCoords = destTile ? `to tile (${destTile.x}, ${destTile.z})` : '';
        return {
            success: true,
            message: `${hero.name} uses Thunderwave and pushes monsters ${destTileCoords}: ${msgParts.length > 0 ? msgParts.join(', ') : 'No monsters affected'}`,
            effects,
            newState
        };
    }

    private static async executeThunderwaveAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        let newState = { ...gameState };
        const heroTile = newState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
        if (!heroTile) {
            return { success: false, message: 'Hero tile not found', effects: [], newState: gameState };
        }
        const monstersOnTile = newState.monsters.filter(m =>
            !m.isDefeated && m.hp > 0 && m.position.x === hero.position.x && m.position.z === hero.position.z
        );

        let destTile = newState.tiles.find(t => {
            if (t.id === heroTile.id) return false;
            return getTileGraphDistance(heroTile, t, newState.tiles) === 1;
        });
        if (target && (target.position.x !== hero.position.x || target.position.z !== hero.position.z)) {
            const targetTile = newState.tiles.find(t => t.x === target.position.x && t.z === target.position.z);
            if (targetTile && getTileGraphDistance(heroTile, targetTile, newState.tiles) === 1) {
                destTile = targetTile;
            }
        }

        const effects: any[] = [];
        const msgParts: string[] = [];

        for (const t of monstersOnTile) {
            const resolved = await CombatAdapter.resolveAttackAsync(hero, t, powerCard.attackBonus || 7, powerCard.damage || 1, 0, newState);
            let updatedMonster = t;
            if (resolved.hit) {
                updatedMonster = CombatSystem.applyDamage(t, resolved.damage, newState);
                newState = this.updateEntityInState(newState, updatedMonster.hp <= 0 ? { ...updatedMonster, isDefeated: true } : updatedMonster);
            }
            effects.push({
                type: 'attack_resolved',
                targetId: t.id,
                hit: resolved.hit,
                roll: resolved.roll,
                damage: resolved.hit ? resolved.damage : 0
            });
            msgParts.push(`${t.name} (${resolved.hit ? 'HIT' : 'MISS'})`);
        }

        if (destTile) {
            for (const m of monstersOnTile) {
                const currentM = newState.monsters.find(mon => mon.id === m.id);
                if (!currentM || currentM.isDefeated || currentM.hp <= 0) continue;

                let foundPos = null;
                for (let sqX = 0; sqX < 4; sqX++) {
                    for (let sqZ = 0; sqZ < 4; sqZ++) {
                        const occupied = 
                            newState.heroes.some(h => h.position.x === destTile!.x && h.position.z === destTile!.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                            newState.monsters.some(mon => !mon.isDefeated && mon.hp > 0 && mon.position.x === destTile!.x && mon.position.z === destTile!.z && mon.position.sqX === sqX && mon.position.sqZ === sqZ);
                        if (!occupied) {
                            foundPos = { x: destTile!.x, z: destTile!.z, sqX, sqZ };
                            break;
                        }
                    }
                    if (foundPos) break;
                }
                if (foundPos) {
                    const updatedMonster = { ...currentM, position: foundPos };
                    newState = this.updateEntityInState(newState, updatedMonster);
                    effects.push({ type: 'monster_moved', targetId: m.id, newPosition: foundPos });
                }
            }
        }

        const destTileCoords = destTile ? `to tile (${destTile.x}, ${destTile.z})` : '';
        return {
            success: true,
            message: `${hero.name} uses Thunderwave and pushes monsters ${destTileCoords}: ${msgParts.length > 0 ? msgParts.join(', ') : 'No monsters affected'}`,
            effects,
            newState
        };
    }

    private static executeFreezingCloud(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        let newState = { ...gameState };
        let currentHero = { ...hero };
        const targetTileX = target ? target.position.x : hero.position.x;
        const targetTileZ = target ? target.position.z : hero.position.z;
        const tile = newState.tiles.find(t => t.x === targetTileX && t.z === targetTileZ);
        const effects: any[] = [];

        // Flip daily card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        if (tile) {
            const newToken = {
                id: 'token_freezing_cloud',
                type: 'encounter' as const,
                name: 'Freezing Cloud',
                tileId: tile.id,
                position: { x: tile.x, z: tile.z, sqX: 2, sqZ: 2 },
                isRevealed: true,
                isSearched: false,
                imageUrl: '/assets/tokens/Token_Encounter_FreezingCloud.png',
                metadata: { cloudTokens: 3 }
            };
            newState.tokens = [...(newState.tokens || []).filter(t => t.id !== 'token_freezing_cloud'), newToken];
            effects.push({ type: 'token_placed', tokenId: newToken.id, tileId: tile.id });
        }

        return {
            success: true,
            message: `${currentHero.name} places Freezing Cloud marker on tile (${targetTileX}, ${targetTileZ})`,
            effects,
            newState
        };
    }

    private static async executeFreezingCloudAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        return this.executeFreezingCloud(hero, powerCard, target, gameState);
    }

    private static executeIllusionaryCrowd(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): { success: boolean; message: string; effects: any[]; newState: GameState } {
        let newState = { ...gameState };
        let currentHero = { ...hero };
        const targetTileX = target ? target.position.x : hero.position.x;
        const targetTileZ = target ? target.position.z : hero.position.z;
        const tile = newState.tiles.find(t => t.x === targetTileX && t.z === targetTileZ);
        const effects: any[] = [];

        // Flip utility card
        const currentFlipped = currentHero.flippedPowerIds ?? [];
        if (!currentFlipped.includes(powerCard.id)) {
            currentHero = {
                ...currentHero,
                flippedPowerIds: [...currentFlipped, powerCard.id]
            };
            newState = this.updateEntityInState(newState, currentHero);
            effects.push({ type: 'power_flipped', powerId: powerCard.id, powerType: powerCard.powerType });
        }

        if (tile) {
            const newToken = {
                id: 'token_illusionary_crowd',
                type: 'encounter' as const,
                name: 'Illusionary Crowd',
                tileId: tile.id,
                position: { x: tile.x, z: tile.z, sqX: 2, sqZ: 2 },
                isRevealed: true,
                isSearched: false,
                imageUrl: '/assets/tokens/Token_Encounter_IllusionaryCrowd.png'
            };
            newState.tokens = [...(newState.tokens || []).filter(t => t.id !== 'token_illusionary_crowd'), newToken];

            const dummyHero: Hero = {
                id: 'ally_illusionary_crowd',
                type: 'hero',
                name: 'Illusionary Crowd',
                heroClass: 'wizard',
                level: 1,
                xp: 0,
                surgeUsed: false,
                hp: 1,
                maxHp: 1,
                ac: 14,
                speed: 0,
                surgeValue: 0,
                position: { x: tile.x, z: tile.z, sqX: 2, sqZ: 2 },
                abilities: [],
                hand: [],
                flippedPowerIds: [],
                conditions: [],
                escaped: false,
                items: [],
                isExhausted: false,
                usedPowers: [],
                attackBonus: 0
            };
            newState.heroes = [...newState.heroes.filter(h => h.id !== 'ally_illusionary_crowd'), dummyHero];

            const activeMonsters = newState.monsters.filter(m => !m.isDefeated && m.hp > 0);
            const adjacentTiles = newState.tiles.filter(t => {
                return getTileGraphDistance(tile, t, newState.tiles) <= 1;
            });

            for (const m of activeMonsters) {
                let foundPos = null;
                for (const t of adjacentTiles) {
                    for (let sqX = 0; sqX < 4; sqX++) {
                        for (let sqZ = 0; sqZ < 4; sqZ++) {
                            const occupied = 
                                newState.heroes.some(h => h.position.x === t.x && h.position.z === t.z && h.position.sqX === sqX && h.position.sqZ === sqZ) ||
                                newState.monsters.some(mon => !mon.isDefeated && mon.hp > 0 && mon.position.x === t.x && mon.position.z === t.z && mon.position.sqX === sqX && mon.position.sqZ === sqZ);
                            if (!occupied) {
                                foundPos = { x: t.x, z: t.z, sqX, sqZ };
                                break;
                            }
                        }
                        if (foundPos) break;
                    }
                    if (foundPos) break;
                }
                if (foundPos) {
                    const updatedMonster = { ...m, position: foundPos };
                    newState = this.updateEntityInState(newState, updatedMonster);
                    effects.push({ type: 'monster_moved', targetId: m.id, newPosition: foundPos });
                }
            }
        }

        return {
            success: true,
            message: `${currentHero.name} plays Illusionary Crowd and places the marker on tile (${targetTileX}, ${targetTileZ})`,
            effects,
            newState
        };
    }

    private static async executeIllusionaryCrowdAsync(
        hero: Hero,
        powerCard: Card,
        target: Entity | null,
        gameState: GameState
    ): Promise<{ success: boolean; message: string; effects: any[]; newState: GameState }> {
        return this.executeIllusionaryCrowd(hero, powerCard, target, gameState);
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
            if (isDev()) console.log(`[PowerSystem] Power ${powerId} reset (flipped back up) for ${hero.name}`);
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
        if (isDev()) console.log(`[PowerSystem] All powers reset (flipped back up) for ${hero.name}`);
        return updated;
    }

    /**
     * Gets the effective attack bonus for a hero considering active powers and items.
     * TODO: integrate with a temporary effects system — currently returns baseBonus unchanged.
     */
    public static getEffectiveAttackBonus(hero: Hero, baseBonus: number, target?: Entity): number {
        let bonus = baseBonus;
        // Sum any temporary attack bonus conditions
        const attackBonusConditions = hero.conditions.filter(c => c.type === 'attack_bonus');
        for (const c of attackBonusConditions) {
            bonus += (c.value ?? 0);
        }
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
     * Gets all available (non-flipped) powers for a hero
     */
    public static getAvailablePowers(hero: Hero, allCards: Card[]): Card[] {
        const flippedIds = hero.flippedPowerIds ?? [];
        return allCards.filter(card =>
            (hero.abilities.includes(card.id) || hero.hand.includes(card.id))
            && !flippedIds.includes(card.id)
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
