/**
 * Simple test to verify villain phase logic works correctly
 */

// Test utilities for console capture, assertions, etc.
import { captureWarn, captureError, captureLog, runWithCapturedConsole } from './testUtils';

import { executeVillainPhase, buildVillainQueue } from '../store/gameStore';
import type { GameState, Hero, Monster, Tile } from '../game/types';

// Create test state: 1 hero, 1 skeleton owned by hero, hero 2 tiles away
const villainHero: Hero = {
    id: 'hero_villain',
    name: 'Test Hero',
    type: 'hero',
    heroClass: 'paladin',
    level: 1,
    xp: 0,
    position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
    hp: 10,
    maxHp: 10,
    ac: 15,
    speed: 6,
    isExhausted: false,
    surgeUsed: false,
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
    phase: 'hero',
    currentHeroId: 'hero_villain',
    heroes: [villainHero],
    monsters: [villainMonster],
    tiles: villainTiles,
    dungeonDeck: [],
    treasureDeck: [],
    encounterDeck: [],
    discardPiles: {},
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
activeConditions: []
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
const afterVillainPhase = executeVillainPhase(villainGameState);

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
console.log('--- VILLAIN PHASE TEST PASSED ---');

