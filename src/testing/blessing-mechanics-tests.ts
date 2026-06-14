import { useGameStore } from '../store/gameStore';
import { useDiceStore } from '../store/diceStore';
import { TreasureSystem } from '../game/engine/TreasureSystem';
import { ConditionSystem } from '../game/engine/ConditionSystem';
import { CombatSystem } from '../game/engine/CombatSystem';
import { DataLoader } from '../game/dataLoader';
import { createTestGameState, createTestHero, createTestMonster } from './ability-system-tests';

// Test runner for blessing mechanics
export async function runBlessingMechanicsTests() {
    console.log('--- Running Blessing Mechanics Tests ---');

    await testBlessingSpeedBonus();
    await testBlessingAttackBonus();
    await testBlessingExpiry();
    await testDeadHeroPurge();
    await testHealingEffectTrailing();

    console.log('--- All Blessing Tests Passed ---');
}

async function testBlessingSpeedBonus() {
    console.log('Testing "Run!" blessing speed bonus (+2 speed)...');
    
    let state = createTestGameState([], [], []);
    const hero1 = createTestHero('hero-1');
    hero1.speed = 6;
    const hero2 = createTestHero('hero-2');
    hero2.speed = 5;
    state.heroes = [hero1, hero2];
    state.currentHeroId = hero1.id;
    state.turnCount = 10;
    
    // Check initial speed
    const initialSpeed1 = ConditionSystem.getEffectiveSpeed(hero1, state);
    const initialSpeed2 = ConditionSystem.getEffectiveSpeed(hero2, state);
    if (initialSpeed1 !== 6 || initialSpeed2 !== 5) {
        throw new Error(`Expected initial speeds 6 and 5, got ${initialSpeed1} and ${initialSpeed2}`);
    }

    // Give Run! blessing to hero1
    const runBlessing = DataLoader.getInstance().getCardById('treasure_blessing_run_154');
    if (!runBlessing) throw new Error('Run! blessing not found in data loader');
    
    const result = TreasureSystem.useBlessing(state, runBlessing, hero1);
    state = result.newState;

    // Check effective speed
    const newHero1 = state.heroes.find(h => h.id === hero1.id)!;
    const newHero2 = state.heroes.find(h => h.id === hero2.id)!;
    
    const buffedSpeed1 = ConditionSystem.getEffectiveSpeed(newHero1, state);
    const buffedSpeed2 = ConditionSystem.getEffectiveSpeed(newHero2, state);

    if (buffedSpeed1 !== 8 || buffedSpeed2 !== 7) {
        throw new Error(`Expected buffed speeds 8 and 7, got ${buffedSpeed1} and ${buffedSpeed2}`);
    }
}

async function testBlessingAttackBonus() {
    console.log('Testing "Surround Them!" blessing attack bonus (+1 attack)...');
    
    let state = createTestGameState([], [], []);
    const hero1 = createTestHero('hero-1');
    hero1.attackBonus = 0; // base attack bonus
    state.heroes = [hero1];
    state.currentHeroId = hero1.id;
    state.turnCount = 10;

    const surroundBlessing = DataLoader.getInstance().getCardById('treasure_blessing_surround_them_155');
    if (!surroundBlessing) throw new Error('Surround Them! blessing not found');

    // No blessing attack
    const roll1 = CombatSystem.resolveAttack(
        hero1,
        createTestMonster('m1', 'skeleton'),
        7, 1, 0, undefined, state
    );
    // Base bonus is 7, no buffs
    if (roll1.roll + 7 !== roll1.total) {
        throw new Error(`Expected total to be roll + 7, got ${roll1.total} vs roll ${roll1.roll}`);
    }

    const result = TreasureSystem.useBlessing(state, surroundBlessing, hero1);
    state = result.newState;

    // With blessing attack
    const roll2 = CombatSystem.resolveAttack(
        hero1,
        createTestMonster('m1', 'skeleton'),
        7, 1, 0, undefined, state
    );
    // Base bonus is 7, Surround gives +1 = 8
    if (roll2.roll + 8 !== roll2.total) {
        throw new Error(`Expected total to be roll + 8 with Surround Them, got ${roll2.total} vs roll ${roll2.roll}`);
    }
}

async function testBlessingExpiry() {
    console.log('Testing Blessing Expiry Logic...');
    
    let state = createTestGameState([], [], []);
    const hero1 = createTestHero('hero-1');
    const hero2 = createTestHero('hero-2');
    state.heroes = [hero1, hero2];
    state.currentHeroId = hero1.id;
    state.turnCount = 10; // Let's say it's turn 10

    const surroundBlessing = DataLoader.getInstance().getCardById('treasure_blessing_surround_them_155');
    if (!surroundBlessing) throw new Error('Surround Them! blessing not found');

    const result = TreasureSystem.useBlessing(state, surroundBlessing, hero1);
    state = result.newState;

    if (state.activeBlessings!.length !== 1) {
        throw new Error('Blessing should be active');
    }

    // Simulating turn progression correctly:
    // When hero1 ends turn, checkBlessingExpiry is called BEFORE turnCount increments.
    // turnCount is still 10. drawnOnTurnCount is 10.
    const expiry1 = TreasureSystem.checkBlessingExpiry(state, hero1.id);
    if (expiry1.expired || expiry1.newState.activeBlessings!.length !== 1) {
        throw new Error('Blessing should NOT expire on the same turn it was drawn');
    }
    state = expiry1.newState;

    // Now turn passes to hero2, turnCount becomes 11
    state.turnCount = 11;
    state.currentHeroId = hero2.id;
    
    // When hero2 ends turn, checkBlessingExpiry is called.
    const expiry2 = TreasureSystem.checkBlessingExpiry(state, hero2.id);
    if (expiry2.expired || expiry2.newState.activeBlessings!.length !== 1) {
        throw new Error('Blessing should NOT expire on another hero\'s turn');
    }
    state = expiry2.newState;

    // Now turn passes back to hero1, turnCount becomes 12
    state.turnCount = 12;
    state.currentHeroId = hero1.id;

    // When hero1 ends turn, checkBlessingExpiry is called.
    // drawnOnTurnCount (10) < currentTurnCount (12). So it EXPIRES.
    const expiry3 = TreasureSystem.checkBlessingExpiry(state, hero1.id);
    if (!expiry3.expired || expiry3.newState.activeBlessings!.length !== 0) {
        throw new Error('Blessing should EXPIRE at the end of the drawing hero\'s next turn');
    }
}

async function testDeadHeroPurge() {
    console.log('Testing Dead Hero Purge...');
    
    let state = createTestGameState([], [], []);
    const hero1 = createTestHero('hero-1');
    state.heroes = [hero1];
    state.currentHeroId = hero1.id;
    state.turnCount = 10;

    const surroundBlessing = DataLoader.getInstance().getCardById('treasure_blessing_surround_them_155');
    if (!surroundBlessing) throw new Error('Surround Them! blessing not found');

    const result = TreasureSystem.useBlessing(state, surroundBlessing, hero1);
    state = result.newState;

    if (state.activeBlessings!.length !== 1) {
        throw new Error('Blessing should be active');
    }

    // Hero 1 dies
    state.heroes = state.heroes.map(h => ({ ...h, hp: 0 }));

    // checkBlessingExpiry should purge it
    const expiry = TreasureSystem.checkBlessingExpiry(state, hero1.id);
    
    if (expiry.newState.activeBlessings!.length !== 0) {
        throw new Error('Blessing should be purged when the drawing hero is dead');
    }
}

async function testHealingEffectTrailing() {
    console.log('Testing Rejuvenating Onslaught healing trail...');
    
    let state = createTestGameState([], [], []);
    const hero1 = createTestHero('hero-1');
    hero1.hp = 5;
    hero1.maxHp = 10;
    state.heroes = [hero1];
    state.currentHeroId = hero1.id;

    // Make an attack result with healAttacker
    const result = {
        hit: true,
        roll: 15,
        total: 20,
        damage: 2,
        critical: false,
        healAttacker: 2,
        attackerId: hero1.id,
        targetId: 'm1'
    };

    const newHero = CombatSystem.applyAttackResultEffects(hero1, result);
    
    if (newHero.hp !== 7) {
        throw new Error(`Expected hero hp to heal to 7, got ${newHero.hp}`);
    }
}
