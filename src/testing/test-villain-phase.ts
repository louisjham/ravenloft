/**
 * Simple test to verify villain phase logic works correctly
 */

// Test utilities for console capture, assertions, etc.
import { captureWarn, captureError, captureLog, runWithCapturedConsole } from './testUtils';

import { executeVillainPhase, executeVillainPhaseStaged, buildVillainQueue } from '../store/slices/villainPhaseLogic';
import type { GameState, Hero, Monster, Tile } from '../game/types';

// Create test state: 1 hero, 1 skeleton owned by hero, hero 2 tiles away
const villainHero: Hero = {
    id: 'hero_villain',
    name: 'Test Hero',
    type: 'hero',
    heroClass: 'paladin',
    level: 1,
    surgeValue: 3,
    xp: 0,
    position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
    hp: 10,
    maxHp: 10,
    ac: 15,
    speed: 6,
    isExhausted: false,
    surgeUsed: false,
    attackBonus: 0,
    conditions: [],
    usedPowers: [],
    abilities: [],
    hand: [],
    items: []
};

const villainMonster: Monster = {
    id: 'monster_skeleton_villain',
    name: 'Skeleton',
    type: 'monster',
    monsterType: 'skeleton',
    behavior: { conditions: [], priorityTargets: [], actions: [] },
    attackBonus: 3,
    damage: 1,
    experienceValue: 10,
    ownedByHeroId: 'hero_villain',
    position: { x: 2, z: 0, sqX: 1, sqZ: 1 },
    hp: 5,
    maxHp: 5,
    ac: 12,
    speed: 6,
    isExhausted: false,
    conditions: [],
    usedPowers: []
} as any; // Use 'any' to allow moveRange property

const villainTiles: Tile[] = [
    {
        id: 'tile_0_0',
        name: 'Tile 0,0',
        x: 0,
        z: 0,
        terrainType: 'corridor',
        connections: [
            { edge: 'north', isOpen: false },
            { edge: 'east', isOpen: true, connectedTileId: 'tile_1_0' },
            { edge: 'south', isOpen: false },
            { edge: 'west', isOpen: false }
        ],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: ['hero_villain'],
        items: []
    },
    {
        id: 'tile_1_0',
        name: 'Tile 1,0',
        x: 1,
        z: 0,
        terrainType: 'corridor',
        connections: [
            { edge: 'north', isOpen: false },
            { edge: 'east', isOpen: true, connectedTileId: 'tile_2_0' },
            { edge: 'south', isOpen: false },
            { edge: 'west', isOpen: true, connectedTileId: 'tile_0_0' }
        ],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: []
    },
    {
        id: 'tile_2_0',
        name: 'Tile 2,0',
        x: 2,
        z: 0,
        terrainType: 'corridor',
        connections: [
            { edge: 'north', isOpen: false },
            { edge: 'east', isOpen: false },
            { edge: 'south', isOpen: false },
            { edge: 'west', isOpen: true, connectedTileId: 'tile_1_0' }
        ],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: ['monster_skeleton_villain'],
        heroes: [],
        items: []
    }
];

const villainGameState: GameState = {
    logIdCounter: 0,
    phase: 'hero',
    currentHeroId: 'hero_villain',
    heroes: [villainHero],
    monsters: [villainMonster],
    tiles: villainTiles,
    dungeonDeck: [],
    treasureDeck: [],
    encounterDeck: [],
    discardPiles: {
        treasure: [],
        encounter: [],
        ability: [],
        monster: []
    },
    activeScenario: {
        id: 'scenario-villain',
        name: 'Villain Test Scenario',
        difficulty: 'Easy',
        description: 'Test villain phase',
        introText: 'Test',
        victoryText: 'Test',
        defeatText: 'Test',
        objectives: [],
        specialRules: [],
        startTileId: 'tile_0_0',
        maxSurges: 3
    },
    turnOrder: ['hero_villain'],
    healingSurges: 2,
    turnCount: 1,
    log: [],
    activeEnvironmentCard: null,
    experiencePile: [],
    treasuresDrawnThisTurn: 0,
    traps: [],
    villainPhaseQueue: [],
    activeVillainId: null,
powerSelections: [],
      cardResolution: { phase: 'idle' as const, cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [] },
      treasureAssignments: [],
      tokens: [],
      strahdsCoffinTokenId: null,
      unplacedCoffinTokens: [],
      
      monsterDeck: [], hasExploredThisTurn: false, activeConditions: []
};

console.log('--- VILLAIN PHASE TEST ---');
console.log('Initial monster position:', villainMonster.position);
console.log('Hero position:', villainHero.position);
console.log('Monster ownedByHeroId:', villainMonster.ownedByHeroId);
console.log('Current hero ID:', villainGameState.currentHeroId);
console.log('Monster hp:', villainMonster.hp);

// Test buildVillainQueue directly
const queue = buildVillainQueue(villainGameState, villainGameState.currentHeroId);
console.log('Direct buildVillainQueue call result:', queue);

// Test: After executeVillainPhase(), skeleton should be 1 tile closer
const run = async () => {
const afterVillainPhase = await executeVillainPhase(villainGameState);

console.log('After villain phase monster position:', afterVillainPhase.monsters[0].position);
console.log('Villain queue after processing:', afterVillainPhase.villainPhaseQueue);
console.log('Active villain ID after processing:', afterVillainPhase.activeVillainId);

// Find skeleton after villain phase
const skeletonAfter = afterVillainPhase.monsters.find(m => m.id === 'monster_skeleton_villain');
if (!skeletonAfter) {
    throw new Error('Skeleton not found after villain phase');
}

// Skeleton should have moved from x=2 to x=1 (1 tile closer to hero at x=0)
if (skeletonAfter.position.x !== 1) {
    throw new Error(`Expected skeleton at x=1 after villain phase, got x=${skeletonAfter.position.x}`);
}
if (skeletonAfter.position.z !== 0) {
    throw new Error(`Expected skeleton at z=0 after villain phase, got z=${skeletonAfter.position.z}`);
}

// Verify villainPhaseQueue is empty after processing
if (afterVillainPhase.villainPhaseQueue.length !== 0) {
    throw new Error(`Expected villainPhaseQueue to be empty after processing, got length ${afterVillainPhase.villainPhaseQueue.length}`);
}

// Verify activeVillainId is null after processing
if (afterVillainPhase.activeVillainId !== null) {
    throw new Error(`Expected activeVillainId to be null after processing, got ${afterVillainPhase.activeVillainId}`);
}

// Verify original state is unchanged (immutability)
if (villainGameState.monsters[0].position.x !== 2) {
    throw new Error('executeVillainPhase: should not mutate original state');
}

console.log('  Villain Phase Sequencer PASSED: Skeleton moved 1 tile closer to hero');

    // -------------------------------------------------------------------------
    // TEST 2: executeVillainPhaseStaged with multiple monsters
    // Verifies that for each monster, its AI card is shown BEFORE it acts
    // -------------------------------------------------------------------------
    console.log('Testing executeVillainPhaseStaged with multiple monsters...');
    const zombieMonster: Monster = {
        id: 'monster_zombie_villain',
        name: 'Zombie',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 3,
        damage: 1,
        experienceValue: 10,
        ownedByHeroId: 'hero_villain',
        position: { x: 2, z: 0, sqX: 1, sqZ: 1 },
        hp: 5,
        maxHp: 5,
        ac: 12,
        speed: 6,
        isExhausted: false,
        conditions: [],
        usedPowers: []
    } as any;

    const hero2: Hero = {
        ...villainHero,
        id: 'hero_villain_2',
        name: 'Second Hero'
    };

    const multiMonsterState: GameState = {
        ...villainGameState,
        turnOrder: ['hero_villain', 'hero_villain_2'],
        heroes: [villainHero, hero2],
        monsters: [villainMonster, zombieMonster]
    };

    const recordedSnapshots: { phase: string; activeVillainId: string | null; queueIndex?: number; skeletonPos: any; zombiePos: any }[] = [];

    let currentStoreState = { gameState: multiMonsterState } as any;
    const mockSet = (update: any) => {
        const partial = typeof update === 'function' ? update(currentStoreState) : update;
        currentStoreState = { ...currentStoreState, ...partial };
        if (currentStoreState.gameState) {
            const gs = currentStoreState.gameState;
            const sk = gs.monsters.find((m: any) => m.id === 'monster_skeleton_villain');
            const zm = gs.monsters.find((m: any) => m.id === 'monster_zombie_villain');
            recordedSnapshots.push({
                phase: gs.phase,
                activeVillainId: gs.activeVillainId,
                queueIndex: gs.villainQueueIndex,
                skeletonPos: { ...sk?.position },
                zombiePos: { ...zm?.position }
            });
        }
    };
    const mockGet = () => currentStoreState;

    await executeVillainPhaseStaged(multiMonsterState, mockSet, mockGet, { cardDisplayDelayMs: 0, actionDelayMs: 0 });

    // Assertions on recorded sequence
    // Step 1: Initial villain state set with queue
    if (recordedSnapshots[0].phase !== 'villain') {
        throw new Error(`Expected first snapshot phase to be 'villain', got ${recordedSnapshots[0].phase}`);
    }

    // Step 2: Skeleton card shown BEFORE skeleton moves
    const skeletonCardShown = recordedSnapshots.find(s => s.activeVillainId === 'monster_skeleton_villain');
    if (!skeletonCardShown) {
        throw new Error('Expected snapshot showing Skeleton AI card (activeVillainId === monster_skeleton_villain)');
    }
    if (skeletonCardShown.skeletonPos.x !== 2) {
        throw new Error(`Expected Skeleton at x=2 while its AI card was shown, got x=${skeletonCardShown.skeletonPos.x}`);
    }

    // Step 3: Skeleton acted (position moved to x=1, activeVillainId cleared)
    const afterSkeletonActed = recordedSnapshots.find(s => s.skeletonPos.x === 1 && s.zombiePos.x === 2);
    if (!afterSkeletonActed) {
        throw new Error('Expected snapshot after Skeleton acted where Skeleton is at x=1 and Zombie is still at x=2');
    }
    if (afterSkeletonActed.activeVillainId !== null) {
        throw new Error(`Expected activeVillainId to be null while action resolves on board, got ${afterSkeletonActed.activeVillainId}`);
    }

    // Step 4: Zombie card shown BEFORE zombie moves
    const zombieCardShown = recordedSnapshots.find(s => s.activeVillainId === 'monster_zombie_villain');
    if (!zombieCardShown) {
        throw new Error('Expected snapshot showing Zombie AI card (activeVillainId === monster_zombie_villain)');
    }
    if (zombieCardShown.zombiePos.x !== 2) {
        throw new Error(`Expected Zombie at x=2 while its AI card was shown, got x=${zombieCardShown.zombiePos.x}`);
    }

    // Step 5: Zombie acted (position moved to x=1)
    const afterZombieActed = recordedSnapshots.find(s => s.skeletonPos.x === 1 && s.zombiePos.x === 1);
    if (!afterZombieActed) {
        throw new Error('Expected snapshot after Zombie acted where both monsters are at x=1');
    }

    // Step 6: Final snapshot transitions to next hero turn ('hero_villain_2') with phase 'hero'
    const finalSnapshot = recordedSnapshots[recordedSnapshots.length - 1];
    if (finalSnapshot.phase !== 'hero') {
        throw new Error(`Expected final snapshot phase to be 'hero', got ${finalSnapshot.phase}`);
    }
    if (currentStoreState.gameState.currentHeroId !== 'hero_villain_2') {
        throw new Error(`Expected turn transition to hero_villain_2, got ${currentStoreState.gameState.currentHeroId}`);
    }

    console.log('  executeVillainPhaseStaged with multiple monsters PASSED');
    console.log('  Verified: Skeleton AI card shown -> Skeleton moves -> Zombie AI card shown -> Zombie moves -> Turn advances');

console.log('--- VILLAIN PHASE TEST PASSED ---');
};
export const runVillainPhaseTests = run;
if (typeof window === 'undefined' && (globalThis as any).process?.argv?.[1]?.includes('test-villain-phase')) {
  run().catch(console.error);
}

