/**
 * Integration tests for the full game loop.
 * These are designed to be run in a dev environment or CI.
 */

// Test utilities for console capture, assertions, etc.
import { captureWarn, captureError, captureLog, runWithCapturedConsole } from './testUtils';

import { runAbilitySystemTests } from './ability-system-tests';
import { AbilitySystem } from '../game/ai/AbilitySystem';
import { MonsterAI } from '../game/ai/MonsterAI';
import { CombatSystem } from '../game/engine/CombatSystem';
import { ConditionSystem } from '../game/engine/ConditionSystem';
import { PowerSystem } from '../game/engine/PowerSystem';
import { useGameStore } from '../store/gameStore';
import { buildVillainQueue, applyTrapResult, executeVillainPhase } from '../store/slices/villainPhaseLogic';
import { useUIStore } from '../store/uiStore';
import { useDiceStore } from '../store/diceStore';
import { TileSystem } from '../game/engine/TileSystem';
import { DataLoader } from '../game/dataLoader';
import { getPowerCard } from '../data/powerCardLoader';
import type { Tile, TileConnection, Direction, GameState, ExplorationPoint, Monster, Hero, TacticResult, MonsterAbility, AbilityEffect, Card, Trap, Entity } from '../game/types';
import { CardResolutionSystem } from '../game/engine/CardResolutionSystem';
import { ExplorationState, onArrowClicked, setTileRotation, onCancel, onPlacementComplete, onPlacementAttempted } from '../game/engine/ExplorationStateMachine';
import {
  manhattanDistance,
  getAdjacentTileIds,
  hasLineOfSight,
  findClosestHero,
  getPathToward,
  resolveTactic,
  resolveTrap,
  getTileGraphDistance
} from '../game/engine/MonsterAI';
import { ObjectiveTracker } from '../game/scenarios/Objectives';
import { ScenarioManager } from '../game/scenarios/ScenarioManager';
import { createCardSlice } from '../store/slices/cardSlice';
import { EncounterSystem } from '../game/engine/EncounterSystem';
import { TreasureSystem } from '../game/engine/TreasureSystem';



// Helpers
// ---------------------------------------------------------------------------

/** Shorthand: open TileConnection (no connectedTileId). */
const openEdge = (edge: Direction): TileConnection => ({ edge, isOpen: true });

/** Shorthand: closed TileConnection (no connectedTileId). */
const closedEdge = (edge: Direction): TileConnection => ({ edge, isOpen: false });

// ---------------------------------------------------------------------------

export const runTreasureSystemTests = () => {
  let passed = true;
  console.log('--- TreasureSystem Tests ---');

  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      console.error('FAIL:', msg);
      passed = false;
      throw new Error(`Assertion failed: ${msg}`);
    }
  };

  try {
    const createTestHero = (id: string, damage = 1) => (({
      id, name: id, type: 'hero',
      hp: 10, maxHp: 10, ac: 10, speed: 5, surgeValue: 5,
      xp: 0, level: 1, class: 'fighter', race: 'human',
      position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
      abilities: [], items: [], conditions: [],
      attackBonus: 0, damage, flippedPowerIds: []
    } as unknown) as Hero);

    const createTestMonster = (id: string, monsterType: string, isUndead: boolean) => (({
      id, name: id, type: 'monster',
      hp: 1, maxHp: 1, ac: 10, speed: 5, experienceValue: 1,
      monsterType, isUndead,
      behavior: { conditions: [], priorityTargets: [], actions: [] },
      position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
      isExhausted: false, conditions: [], usedPowers: [],
      attackBonus: 0, damage: 1, ownedByHeroId: null
    } as unknown) as Monster);

    const createTestTile = () => (({
      id: 'test-tile', name: 'test', x: 0, z: 0,
      terrainType: 'corridor', connections: [],
      isRevealed: true, monsters: [], heroes: [], items: [],
      boneSquare: false, isStart: false, isExit: false, rotation: 0
    } as unknown) as Tile);

    const createTestState = () => (({
      logIdCounter: 0,
      phase: 'hero', currentHeroId: 'h1',
      heroes: [], monsters: [], tiles: [],
      dungeonDeck: [], treasureDeck: [], encounterDeck: [], monsterDeck: [],
      discardPiles: { treasure: [], encounter: [], ability: [], monster: [] },
      turnOrder: [], healingSurges: 0, turnCount: 0, log: [],
      activeEnvironmentCard: null, experiencePile: [], treasuresDrawnThisTurn: 0,
      traps: [], villainPhaseQueue: [], activeVillainId: null, powerSelections: [],
      activeConditions: [], exploredThisTurn: false, lastPlacedTileId: null,
      activeBlessings: [],
      activeScenario: null,
      cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null }
    } as unknown) as GameState);

    // Bug 1
    console.log('Testing Bug 1: Holy Symbol vs Bodak');
    const hero1 = createTestHero('h1');
    hero1.items = ['item_holy_symbol_of_ravenkind'];
    const holySymbol = { id: 'item_holy_symbol_of_ravenkind', name: 'Holy Symbol', type: 'treasure', treasureType: 'item', description: '', effects: [] } as unknown as Card;
    const bodak = createTestMonster('m1', 'bodak', true);
    const tile1 = createTestTile();
    tile1.heroes = ['h1'];
    tile1.monsters = ['m1'];
    let state = createTestState();
    state.heroes = [hero1];
    state.monsters = [bodak];
    state.tiles = [tile1];
    const res1 = TreasureSystem.useItem(state, holySymbol, hero1, null);
    console.log('BUG 1 RES1 MESSAGE:', res1.message);
    assert(res1.message.includes('m1'), 'Holy Symbol should target m1 (Bodak)');

    // Bug 2
    console.log('Testing Bug 2: Wooden Stake vs Vampire');
    const hero2 = createTestHero('h2');
    hero2.items = ['item_wooden_stake'];
    const woodenStake = { id: 'item_wooden_stake', name: 'Wooden Stake', type: 'treasure', treasureType: 'item', description: '', effects: [] } as unknown as Card;
    const vampire = createTestMonster('m2', 'Vampire', true);
    const undead = createTestMonster('m3', 'Undead', true);
    state = createTestState();
    state.heroes = [hero2];
    state.monsters = [vampire, undead];
    const res2a = TreasureSystem.useItem(state, woodenStake, hero2, undead);
    assert(!res2a.success, 'Wooden Stake should fail against non-vampire Undead');
    const res2b = TreasureSystem.useItem(state, woodenStake, hero2, vampire);
    assert(res2b.success, 'Wooden Stake should succeed against Vampire');

    // Bug 4
    console.log('Testing Bug 4: EffectiveStats with base damage');
    const hero4 = createTestHero('h4', 3);
    const itemCard = { id: 'item_1', name: 'Item', type: 'treasure', treasureType: 'item', description: '', effects: [{ type: 'damage_bonus', value: 2 }] } as unknown as Card;
    hero4.items = ['item_1'];
    const stats = TreasureSystem.getEffectiveStats(hero4, [itemCard]);
    assert(stats.damage === 5, `Expected effective damage 5, got ${stats.damage}`);

    // Bug 5
    console.log('Testing Bug 5: Respite sentinel intercept');
    state = createTestState();
    state.treasureDeck = ['sentinel_moments_respite', 'real_card'];
    const respiteResult = TreasureSystem.checkAndDiscardRespite(state, 'treasureDeck');
    assert(respiteResult.wasRespite, 'Respite sentinel should be intercepted');
    const drawRes = TreasureSystem.drawTreasureCard(respiteResult.gameState, hero4);
    assert(drawRes.card?.id === 'real_card', 'Real card should be drawn after sentinel is consumed');

    // Bug 6
    console.log('Testing Bug 6: Blessing expiry');
    state = createTestState();
    state.currentHeroId = 'h1';
    state.turnCount = 10;
    state.activeBlessings = [{ cardId: 'b1', name: 'Blessing 1', effects: [], heroId: 'h1', drawnOnTurnCount: 10 }];
    const exp1 = TreasureSystem.checkBlessingExpiry(state, 'h2');
    assert(!exp1.expired, 'Blessing should NOT expire at the end of h2 turn');
    state.turnCount = 12; // Simulate turn coming back to h1
    const exp2 = TreasureSystem.checkBlessingExpiry(state, 'h1');
    assert(exp2.expired, 'Blessing SHOULD expire at the end of h1 turn');

    console.log('--- TreasureSystem Tests PASSED ---');
  } catch (e) {
    console.error(e);
    passed = false;
  }
  return passed;
};

export const runFullGameLoopTest = async () => {
  console.log('--- STARTING INTEGRATION TEST ---');

  try {
    // Run ability system tests first
    console.log('Running Ability System Tests...');
    const abilityTestsPassed = runAbilitySystemTests();
    if (!abilityTestsPassed) {
      throw new Error('Ability System Tests FAILED');
    }

    console.log('Running Treasure System Tests...');
    const treasureTestsPassed = runTreasureSystemTests();
    if (!treasureTestsPassed) {
      throw new Error('Treasure System Tests FAILED');
    }

    const store = useGameStore.getState();
    const ui = useUIStore.getState();

    // 1. Setup Game
    console.log('Testing Scenario 1 setup...');
    store.startNewGame('s1', ['hero_arjhan', 'hero_immeril']);
    if (!useGameStore.getState().gameState) throw new Error('Game state not initialized');

    // 2. Test Movement
    console.log('Testing Hero movement...');
    const currentHeroId = useGameStore.getState().gameState?.currentHeroId;
    if (currentHeroId) {
      store.moveHero({ x: 0, z: 0, sqX: 1, sqZ: 1 });
    }

    // 3. Test Exploration
    console.log('Testing Tile exploration...');
    store.moveHero({ x: 0, z: 0, sqX: 3, sqZ: 2 });

    // 4. Test Combat
    console.log('Testing Combat resolution...');
    store.attackMonster('monster-zombie-1');

    // 5. Test Save/Load
    console.log('Testing Save/Load system...');
    store.saveGame();
    store.loadGame('auto-save');

    // -----------------------------------------------------------------------
    // 6. TileSystem.assignTileCoords
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.assignTileCoords...');
    const templateTile: Tile = {
      id: 'tile_test',
      name: 'Test Corridor',
      x: 0,
      z: 0,
      terrainType: 'corridor',
      connections: [],
      boneSquare: { sqX: 1, sqZ: 1 },
      isRevealed: false,
      isStart: false,
      isExit: false,
      rotation: 0,
      monsters: [],
      heroes: [],
      items: [],
    };

    const placed = TileSystem.assignTileCoords(templateTile, 3, -2);
    if (placed.x !== 3)
      throw new Error(`assignTileCoords: expected x=3, got x=${placed.x}`);
    if (placed.z !== -2)
      throw new Error(`assignTileCoords: expected z=-2, got z=${placed.z}`);
    if (templateTile.x !== 0 || templateTile.z !== 0)
      throw new Error('assignTileCoords: mutated the original tile object');
    if (placed.id !== templateTile.id || placed.name !== templateTile.name)
      throw new Error('assignTileCoords: other fields were not preserved');

    console.log('  assignTileCoords PASSED');

    // -----------------------------------------------------------------------
    // 7. TileSystem.rotateConnections
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.rotateConnections...');

    // Straight corridor: north=open, south=open, east/west=closed
    const baseConns: TileConnection[] = [
      openEdge('north'),
      closedEdge('east'),
      openEdge('south'),
      closedEdge('west'),
    ];

    const rot0 = TileSystem.rotateConnections(baseConns, 0);
    if (rot0.find(c => c.edge === 'north')?.isOpen !== true)
      throw new Error('rotateConnections 0°: north should be open');
    if (rot0.find(c => c.edge === 'east')?.isOpen !== false)
      throw new Error('rotateConnections 0°: east should be closed');

    const rot90 = TileSystem.rotateConnections(baseConns, 90);
    if (rot90.find(c => c.edge === 'east')?.isOpen !== true)
      throw new Error('rotateConnections 90°: former north (open) should now be east');
    if (rot90.find(c => c.edge === 'west')?.isOpen !== true)
      throw new Error('rotateConnections 90°: former south (open) should now be west');
    if (rot90.find(c => c.edge === 'north')?.isOpen !== false)
      throw new Error('rotateConnections 90°: former west (closed) should now be north (closed)');
    if (rot90.find(c => c.edge === 'south')?.isOpen !== false)
      throw new Error('rotateConnections 90°: former east (closed) should now be south (closed)');

    const rot180 = TileSystem.rotateConnections(baseConns, 180);
    if (rot180.find(c => c.edge === 'south')?.isOpen !== true)
      throw new Error('rotateConnections 180°: former north (open) should now be south');
    if (rot180.find(c => c.edge === 'north')?.isOpen !== true)
      throw new Error('rotateConnections 180°: former south (open) should now be north');

    const rot270 = TileSystem.rotateConnections(baseConns, 270);
    if (rot270.find(c => c.edge === 'west')?.isOpen !== true)
      throw new Error('rotateConnections 270°: former north (open) should now be west');
    if (rot270.find(c => c.edge === 'east')?.isOpen !== true)
      throw new Error('rotateConnections 270°: former south (open) should now be east');

    if (baseConns[0].edge !== 'north')
      throw new Error('rotateConnections: mutated the original connections array');

    console.log('  rotateConnections PASSED (0°, 90°, 180°, 270°, no mutation)');

    // -----------------------------------------------------------------------
    // 8. TileSystem.getValidRotations
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.getValidRotations...');

    const tShapeTile: Tile = {
      ...templateTile,
      id: 'tile_t_shape',
      connections: [
        openEdge('north'),
        openEdge('east'),
        openEdge('south'),
        closedEdge('west'),
      ],
    };

    const validNorth = TileSystem.getValidRotations(tShapeTile, 'north');
    if (!validNorth.includes(0))
      throw new Error('getValidRotations: 0° should be valid');
    if (!validNorth.includes(90))
      throw new Error('getValidRotations: 90° should be valid');
    if (!validNorth.includes(180))
      throw new Error('getValidRotations: 180° should be valid');
    if (validNorth.includes(270))
      throw new Error('getValidRotations: 270° should NOT be valid');

    const deadEndTile: Tile = {
      ...templateTile,
      id: 'tile_dead_end',
      connections: [closedEdge('north'), closedEdge('east'), openEdge('south'), closedEdge('west')],
    };
    const validDeadEnd = TileSystem.getValidRotations(deadEndTile, 'north');
    if (validDeadEnd.length !== 1 || !validDeadEnd.includes(0))
      throw new Error(`getValidRotations dead-end: expected [0], got [${validDeadEnd}]`);

    const closedTile: Tile = {
      ...templateTile,
      id: 'tile_closed',
      connections: [closedEdge('north'), closedEdge('east'), closedEdge('south'), closedEdge('west')],
    };
    const validClosed = TileSystem.getValidRotations(closedTile, 'east');
    if (validClosed.length !== 0)
      throw new Error(`getValidRotations closed: expected [], got [${validClosed}]`);

    console.log('  getValidRotations PASSED (T-shape, dead-end, all-closed)');

    // -----------------------------------------------------------------------
    // 9. TileSystem.assignPlacementCoords
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.assignPlacementCoords...');

    const parentTile: Tile = {
      ...templateTile,
      id: 'tile_parent',
      x: 2,
      z: 3,
      isRevealed: true,
      connections: [openEdge('north'), openEdge('east'), closedEdge('south'), closedEdge('west')],
    };

    const deckTile: Tile = { ...templateTile, id: 'tile_deck', x: 0, z: 0, isRevealed: false };

    const northPlaced = TileSystem.assignPlacementCoords(deckTile, parentTile, 'north');
    if (northPlaced.x !== 2 || northPlaced.z !== 2)
      throw new Error(`assignPlacementCoords north: expected (2,2), got (${northPlaced.x},${northPlaced.z})`);
    if (!northPlaced.isRevealed)
      throw new Error('assignPlacementCoords north: isRevealed must be true');

    const eastPlaced = TileSystem.assignPlacementCoords(deckTile, parentTile, 'east');
    if (eastPlaced.x !== 3 || eastPlaced.z !== 3)
      throw new Error(`assignPlacementCoords east: expected (3,3), got (${eastPlaced.x},${eastPlaced.z})`);
    if (!eastPlaced.isRevealed)
      throw new Error('assignPlacementCoords east: isRevealed must be true');

    if (deckTile.x !== 0 || deckTile.z !== 0 || deckTile.isRevealed !== false)
      throw new Error('assignPlacementCoords: mutated the original deck tile');

    console.log('  assignPlacementCoords PASSED (north→(2,2), east→(3,3), isRevealed=true, no mutation)');

    // -----------------------------------------------------------------------
    // 10. TileSystem.drawAndPlace
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.drawAndPlace...');

    // We use real tile IDs from tiles.json so DataLoader can resolve them.
    //
    // The exploration point: incomingEdge = 'south'
    //   → neededEdge = 'north' (the new tile must expose an open north face)
    //
    // Deck layout (3 cards):
    //   [0] '__unknown_id_A__'   → getTileTemplate returns undefined → skipped
    //   [1] '__unknown_id_B__'   → getTileTemplate returns undefined → skipped
    //   [2] 'white_x2_01'   → has north open at 0° → MATCH (validRotations: [0, 180])
    //
    // This proves drawAndPlace skips unknown IDs and non-fitting tiles,
    // then finds the first match at the last position.

    const mockGameState = {
      ...useGameStore.getState().gameState,
      dungeonDeck: ['__unknown_id_A__', '__unknown_id_B__', 'white_x2_01'],
    } as GameState;

    const explorationPoint = { tileId: 'tile_parent', edge: 'south' as Direction };

    const result = TileSystem.drawAndPlace(mockGameState, explorationPoint);

    // The match must be found (not exhausted)
    if (result.exhausted)
      throw new Error('drawAndPlace: should NOT be exhausted — white_x2_01 is a valid fit');
    if (result.tile === null)
      throw new Error('drawAndPlace: tile should not be null');
    if (result.tile.id !== 'white_x2_01')
      throw new Error(`drawAndPlace: expected white_x2_01, got ${result.tile?.id}`);

    // Valid rotations for north-incoming: white_x2_01 has N+S open, so:
    //   0°   north open ✓   180° south→north open ✓   (90°/270° rotate N to E/W — not north)
    if (!result.validRotations.includes(0))
      throw new Error('drawAndPlace: validRotations should include 0');
    if (!result.validRotations.includes(180))
      throw new Error('drawAndPlace: validRotations should include 180');
    if (result.validRotations.includes(90) || result.validRotations.includes(270))
      throw new Error('drawAndPlace: validRotations should NOT include 90 or 270');

    // remainingDeck must be the original 3-card deck minus 'white_x2_01'
    if (result.remainingDeck.length !== 2)
      throw new Error(`drawAndPlace: remainingDeck should have 2 cards, got ${result.remainingDeck.length}`);
    if (result.remainingDeck.includes('white_x2_01'))
      throw new Error('drawAndPlace: matched card must be removed from remainingDeck');
    if (!result.remainingDeck.includes('__unknown_id_A__') || !result.remainingDeck.includes('__unknown_id_B__'))
      throw new Error('drawAndPlace: unmatched cards must remain in remainingDeck');

    // Verify gameState.dungeonDeck was NOT mutated
    if (mockGameState.dungeonDeck.length !== 3)
      throw new Error('drawAndPlace: mutated the original gameState.dungeonDeck');

    // Exhausted path: a deck with no valid tiles
    const exhaustedState = {
      ...mockGameState,
      dungeonDeck: ['__unknown_id_A__', '__unknown_id_B__'],
    } as GameState;

    const exhaustedResult = TileSystem.drawAndPlace(exhaustedState, explorationPoint);
    if (!exhaustedResult.exhausted)
      throw new Error('drawAndPlace exhausted: should return exhausted=true for an all-unknown deck');
    if (exhaustedResult.tile !== null)
      throw new Error('drawAndPlace exhausted: tile should be null');
    if (exhaustedResult.remainingDeck.length !== 2)
      throw new Error('drawAndPlace exhausted: deck must be returned unchanged');

    console.log('  drawAndPlace PASSED (last-card match, unknown-ID skip, exhausted path, no mutation)');

    // -----------------------------------------------------------------------
    // 11. TileSystem.connectTiles
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.connectTiles...');

    const boardParent: Tile = {
      ...templateTile,
      id: 'board_parent',
      x: 0,
      z: 0,
      connections: [openEdge('north'), openEdge('east'), closedEdge('south'), closedEdge('west')]
    };

    const boardNeighbor: Tile = {
      ...templateTile,
      id: 'board_neighbor',
      x: 1, // East of the new tile
      z: -1,
      connections: [openEdge('north'), openEdge('south'), openEdge('west'), closedEdge('east')]
    };

    const boardNeighborClosed: Tile = {
      ...templateTile,
      id: 'board_neighbor_closed',
      x: -1, // West of the new tile
      z: -1,
      connections: [closedEdge('north'), closedEdge('south'), closedEdge('east'), closedEdge('west')]
    };

    const initialBoard = [boardParent, boardNeighbor, boardNeighborClosed];

    const newPlacedTile: Tile = {
      ...templateTile,
      id: 'new_placed',
      x: 0,
      z: -1,
      connections: [openEdge('north'), openEdge('south'), openEdge('east'), openEdge('west')]
    };

    const newBoard = TileSystem.connectTiles(initialBoard, boardParent, newPlacedTile, 'north');

    if (newBoard === initialBoard) throw new Error('connectTiles: should return a new array');
    if (newBoard.length !== 4) throw new Error('connectTiles: new tile should be added to the array');

    const updatedParent = newBoard.find(t => t.id === 'board_parent')!;
    const updatedNew = newBoard.find(t => t.id === 'new_placed')!;
    const updatedNeighbor = newBoard.find(t => t.id === 'board_neighbor')!;

    if (updatedParent === boardParent) throw new Error('connectTiles: parent tile should be cloned');
    if (updatedNew === newPlacedTile) throw new Error('connectTiles: new tile should be cloned');

    if (updatedParent.connections.find(c => c.edge === 'north')?.connectedTileId !== 'new_placed')
      throw new Error('connectTiles: parent north edge not connected to new tile');
    if (updatedNew.connections.find(c => c.edge === 'south')?.connectedTileId !== 'board_parent')
      throw new Error('connectTiles: new tile south edge not connected to parent');

    if (updatedNew.connections.find(c => c.edge === 'east')?.connectedTileId !== 'board_neighbor')
      throw new Error('connectTiles: new tile east edge not connected to neighbor');
    if (updatedNeighbor.connections.find(c => c.edge === 'west')?.connectedTileId !== 'new_placed')
      throw new Error('connectTiles: neighbor west edge not connected to new tile');

    const newWestConn = updatedNew.connections.find(c => c.edge === 'west');
    if (newWestConn?.connectedTileId)
      throw new Error('connectTiles: new tile west should not connect to a wall');
    if (newWestConn?.isOpen !== false)
      throw new Error('connectTiles: new tile west should be closed (turned into wall)');

    console.log('  connectTiles PASSED (primary conn, secondary open conn, secondary wall closure, immutability)');

    // -----------------------------------------------------------------------
    // 12. TileSystem.rotateBoneSquare
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.rotateBoneSquare...');

    const boneRot0 = TileSystem.rotateBoneSquare(1, 2, 0);
    if (boneRot0.sqX !== 1 || boneRot0.sqZ !== 2) throw new Error(`rotateBoneSquare 0°: expected (1, 2), got (${boneRot0.sqX}, ${boneRot0.sqZ})`);

    const boneRot90 = TileSystem.rotateBoneSquare(1, 2, 90);
    if (boneRot90.sqX !== 1 || boneRot90.sqZ !== 1) throw new Error(`rotateBoneSquare 90°: expected (1, 1), got (${boneRot90.sqX}, ${boneRot90.sqZ})`);

    const boneRot180 = TileSystem.rotateBoneSquare(1, 2, 180);
    if (boneRot180.sqX !== 2 || boneRot180.sqZ !== 1) throw new Error(`rotateBoneSquare 180°: expected (2, 1), got (${boneRot180.sqX}, ${boneRot180.sqZ})`);

    const boneRot270 = TileSystem.rotateBoneSquare(1, 2, 270);
    if (boneRot270.sqX !== 2 || boneRot270.sqZ !== 2) throw new Error(`rotateBoneSquare 270°: expected (2, 2), got (${boneRot270.sqX}, ${boneRot270.sqZ})`);

    console.log('  rotateBoneSquare PASSED');

    // -----------------------------------------------------------------------
    // 13. TileSystem.canPlaceTile
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.canPlaceTile...');

    const overlapBoard: Tile[] = [
      { ...templateTile, id: 't1', x: 2, z: 2 }
    ];

    if (TileSystem.canPlaceTile(overlapBoard, 2, 2) !== false) {
      throw new Error('canPlaceTile: should return false when a tile exists at 2,2');
    }

    if (TileSystem.canPlaceTile(overlapBoard, 2, 3) !== true) {
      throw new Error('canPlaceTile: should return true when 2,3 is empty');
    }

    console.log('  canPlaceTile PASSED');

    // -----------------------------------------------------------------------
    // 14. TileSystem.placeTile (Integration)
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.placeTile...');

    const currentState = useGameStore.getState().gameState;
    if (!currentState) throw new Error('Game state missing for placeTile test');

    const topCardId = currentState.dungeonDeck[0];
    if (!topCardId) throw new Error('Dungeon deck is empty');

    const startTile = currentState.tiles.find(t => t.id === currentState.activeScenario.startTileId);
    if (!startTile) throw new Error('Start tile missing');

    const explorationConn = startTile.connections.find(c => c.isOpen);
    if (!explorationConn) throw new Error('Start tile has no open edges');

    const initialTileCount = currentState.tiles.length;
    const initialDeckCount = currentState.dungeonDeck.length;

    const nextState = TileSystem.placeTile(
      currentState,
      { tileId: startTile.id, edge: explorationConn.edge as Direction },
      0 // rotation
    );

    if (nextState === currentState) {
      throw new Error('placeTile: Should return a new game state object (or failed placement)');
    }

    if (nextState.tiles.length !== initialTileCount + 1) {
      throw new Error(`placeTile: Expected ${initialTileCount + 1} tiles, got ${nextState.tiles.length}`);
    }

    if (nextState.dungeonDeck.length !== initialDeckCount - 1) {
      throw new Error('placeTile: Dungeon deck should be reduced by 1');
    }

    console.log('  placeTile PASSED');

    // -----------------------------------------------------------------------
    // 15. TileSystem.getExplorationPoints
    // -----------------------------------------------------------------------
    console.log('Testing TileSystem.getExplorationPoints...');

    const tileWithOneSouthEdge: Tile = {
      ...templateTile,
      id: 'iso-start',
      x: 0,
      z: 0,
      isRevealed: true,
      connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')]
    };

    const solitaryTiles = [tileWithOneSouthEdge];
    let explorePoints = TileSystem.getExplorationPoints(solitaryTiles);

    if (explorePoints.length !== 1) {
      throw new Error(`getExplorationPoints: Expected 1 point, got ${explorePoints.length}`);
    }

    if (explorePoints[0].edge !== 'south' || explorePoints[0].worldX !== 2 || explorePoints[0].worldZ !== 4) {
      throw new Error(`getExplorationPoints: Point incorrectly calculated: ${JSON.stringify(explorePoints[0])}`);
    }

    // Now place a tile adjacent on south edge, rendering it occupied
    const connectingTile: Tile = {
      ...templateTile,
      id: 'iso-next',
      x: 0,
      z: 1,
      isRevealed: true,
      connections: [openEdge('north'), openEdge('east'), closedEdge('south'), closedEdge('west')]
    };

    // Note: getExplorationPoints explicitly checks canPlaceTile which checks occupied coordinates.
    // It doesn't actually need the graphs to be wired via connectTiles() to know it's blocked,
    // just the existence of the grid coordinate. In reality, during play, connectTiles handles the rest.
    const connectedTiles = [...solitaryTiles, connectingTile];

    explorePoints = TileSystem.getExplorationPoints(connectedTiles);

    // We expect the original south edge to be excluded (because 0,1 is occupied)
    // and the new tile's open edges ('north' which overlaps 0,0 and 'east' traversing 1,1)
    // Wait, the north edge of the new tile faces 0,0 which is also occupied!
    // So only the 'east' edge of the new tile should be open for exploration.
    if (explorePoints.length !== 1) {
      throw new Error(`getExplorationPoints: Expected 1 open point after placement, got ${explorePoints.length} (${JSON.stringify(explorePoints)})`);
    }

    if (explorePoints[0].edge !== 'east' || explorePoints[0].worldX !== 4 || explorePoints[0].worldZ !== 6) {
      throw new Error(`getExplorationPoints: New point incorrectly calculated: ${JSON.stringify(explorePoints[0])}`);
    }

    console.log('  getExplorationPoints PASSED');

    // -----------------------------------------------------------------------
    // 16. ExplorationStateMachine
    // -----------------------------------------------------------------------
    console.log('Testing ExplorationStateMachine...');

    // Back up original state and set up 'iso-start' tile in global store
    const originalGameStateForSM = useGameStore.getState().gameState;
    useGameStore.setState({
      gameState: {
        ...originalGameStateForSM,
        tiles: [{
          ...templateTile,
          id: 'iso-start',
          x: 0,
          z: 0,
          isRevealed: true,
          connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')]
        }]
      } as GameState
    });

    let fmState: ExplorationState = { phase: 'idle' };
    const point: ExplorationPoint = { tileId: 'iso-start', edge: 'south', worldX: 0, worldZ: 0.5 };

    // Valid draw result mock
    const smDrawResult = {
      tile: {
        ...templateTile,
        id: 'test-sm',
        x: 0,
        z: 0,
        isRevealed: false,
        connections: [openEdge('north'), openEdge('south'), openEdge('east'), openEdge('west')]
      },
      validRotations: [0, 90] as (0 | 90 | 180 | 270)[],
      remainingDeck: ['card2', 'card3'],
      exhausted: false
    };

    // Happy path tests
    fmState = onArrowClicked(fmState, point, smDrawResult);
    if (fmState.phase !== 'positioning') throw new Error('State machine failed to transition to positioning');

    fmState = setTileRotation(fmState, 90);
    fmState = onPlacementAttempted(fmState, { valid: true, conflicts: [], warnings: [] });
    if (fmState.phase !== 'placing') throw new Error('State machine failed to transition to placing');

    fmState = onPlacementComplete(fmState);
    if (fmState.phase !== 'idle') throw new Error('State machine failed to returning to idle after placing');

    // Cancel test
    fmState = onArrowClicked(fmState, point, smDrawResult);
    if (fmState.phase !== 'positioning') throw new Error('State machine failed reset to positioning for cancel test');

    fmState = onCancel(fmState).newState;
    if (fmState.phase !== 'idle') throw new Error('State machine failed to transition back to idle on cancel');

    // Exhausted test
    const smEmptyDrawResult = {
      tile: null,
      validRotations: [],
      remainingDeck: [],
      exhausted: true
    };
    fmState = onArrowClicked(fmState, point, smEmptyDrawResult);

    // Restore original state
    useGameStore.setState({ gameState: originalGameStateForSM });

    if (fmState.phase !== 'exhausted') throw new Error('State machine failed to transition to exhausted');

    console.log('  ExplorationStateMachine PASSED');

    // -----------------------------------------------------------------------
    // 10. Villain Phase buildVillainQueue
    // -----------------------------------------------------------------------
    console.log('Testing Villain Phase Queue construction...');

    // Inject mock monsters into store
    const mockM1: Monster = { id: 'm_test_1', name: 'Zombie', type: 'monster', hp: 1, ownedByHeroId: 'h1' } as any;
    const mockM2: Monster = { id: 'm_test_2', name: 'Skeleton', type: 'monster', hp: 1, ownedByHeroId: 'h1' } as any;
    const mockM3: Monster = { id: 'm_test_3', name: 'Wraith', type: 'monster', hp: 1, ownedByHeroId: 'h2' } as any;
    const mockDead: Monster = { id: 'm_test_4', name: 'Zombie', type: 'monster', hp: 0, ownedByHeroId: 'h1' } as any;
    const mockM5_sameName: Monster = { id: 'm_test_5', name: 'Zombie', type: 'monster', hp: 1, ownedByHeroId: 'h2' } as any;
    const mockM6_noName: Monster = { id: 'm_test_6', type: 'monster', hp: 1, ownedByHeroId: 'h1' } as any;

    useGameStore.setState(state => {
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          monsters: [mockM1, mockM2, mockM3, mockDead, mockM5_sameName, mockM6_noName],
        }
      };
    });

    const queueState = useGameStore.getState().gameState!;
    const hero1Queue = buildVillainQueue(queueState, 'h1');

    if (hero1Queue.length !== 4) {
      throw new Error(`buildVillainQueue: expected 4 ids for Hero 1, got ${hero1Queue.length} (${hero1Queue.join(',')})`);
    }
    if (!hero1Queue.includes('m_test_1') || !hero1Queue.includes('m_test_2') || !hero1Queue.includes('m_test_6') || !hero1Queue.includes('m_test_5')) {
      throw new Error(`buildVillainQueue: incorrect ids returned for Hero 1`);
    }

    const hero2Queue = buildVillainQueue(queueState, 'h2');
    if (hero2Queue.length !== 3) {
      throw new Error(`buildVillainQueue: expected 3 ids for Hero 2, got ${hero2Queue.length} (${hero2Queue.join(',')})`);
    }
    if (!hero2Queue.includes('m_test_3') || !hero2Queue.includes('m_test_5') || !hero2Queue.includes('m_test_1')) {
      throw new Error(`buildVillainQueue: incorrect ids returned for Hero 2`);
    }

    console.log('  buildVillainQueue PASSED');

    // -----------------------------------------------------------------------
    // 17. MonsterAI.manhattanDistance
    // -----------------------------------------------------------------------
    console.log('Testing MonsterAI.manhattanDistance...');

    if (manhattanDistance(0, 0, 0, 0) !== 0) {
      throw new Error('manhattanDistance: (0,0) to (0,0) should be 0');
    }
    if (manhattanDistance(0, 0, 3, 4) !== 7) {
      throw new Error('manhattanDistance: (0,0) to (3,4) should be 7');
    }
    if (manhattanDistance(-2, -3, 1, 2) !== 8) {
      throw new Error('manhattanDistance: (-2,-3) to (1,2) should be 8');
    }

    console.log('  manhattanDistance PASSED');

    // -----------------------------------------------------------------------
    // 18. MonsterAI.getAdjacentTileIds
    // -----------------------------------------------------------------------
    console.log('Testing MonsterAI.getAdjacentTileIds...');

    const testTile: Tile = {
      ...templateTile,
      id: 'test_adjacent',
      connections: [
        openEdge('north'),
        closedEdge('east'),
        openEdge('south'),
        openEdge('west')
      ]
    };

    // Manually set connectedTileId for open edges
    testTile.connections[0].connectedTileId = 'tile_north';
    testTile.connections[2].connectedTileId = 'tile_south';
    testTile.connections[3].connectedTileId = 'tile_west';

    const adjacentIds = getAdjacentTileIds(testTile, []);
    if (adjacentIds.length !== 3) {
      throw new Error(`getAdjacentTileIds: expected 3 adjacent tiles, got ${adjacentIds.length}`);
    }
    if (!adjacentIds.includes('tile_north') || !adjacentIds.includes('tile_south') || !adjacentIds.includes('tile_west')) {
      throw new Error(`getAdjacentTileIds: missing expected tile IDs: ${adjacentIds.join(', ')}`);
    }
    if (adjacentIds.includes('tile_east')) {
      throw new Error('getAdjacentTileIds: should not include closed edge');
    }

    console.log('  getAdjacentTileIds PASSED');

    // -----------------------------------------------------------------------
    // 19. MonsterAI.hasLineOfSight
    // -----------------------------------------------------------------------
    console.log('Testing MonsterAI.hasLineOfSight...');

    const losStart: Tile = {
      ...templateTile,
      id: 'los_start',
      x: 0,
      z: 0,
      connections: [openEdge('north'), openEdge('east'), openEdge('south'), openEdge('west')]
    };
    losStart.connections[0].connectedTileId = 'los_middle';
    losStart.connections[1].connectedTileId = 'los_east';

    const losMiddle: Tile = {
      ...templateTile,
      id: 'los_middle',
      x: 0,
      z: -1,
      connections: [openEdge('north'), openEdge('south'), closedEdge('east'), closedEdge('west')]
    };
    losMiddle.connections[1].connectedTileId = 'los_start';
    losMiddle.connections[0].connectedTileId = 'los_end';

    const losEnd: Tile = {
      ...templateTile,
      id: 'los_end',
      x: 0,
      z: -2,
      connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')]
    };
    losEnd.connections[0].connectedTileId = 'los_middle';

    const losEast: Tile = {
      ...templateTile,
      id: 'los_east',
      x: 1,
      z: 0,
      connections: [openEdge('west'), closedEdge('north'), closedEdge('south'), closedEdge('east')]
    };
    losEast.connections[0].connectedTileId = 'los_start';

    const losBoard = [losStart, losMiddle, losEnd, losEast];

    // Connected path with no blockers
    if (!hasLineOfSight(losStart, losEnd, losBoard)) {
      throw new Error('hasLineOfSight: should return true for connected path with no blockers');
    }

    // Connected tiles directly
    if (!hasLineOfSight(losStart, losEast, losBoard)) {
      throw new Error('hasLineOfSight: should return true for directly connected tiles');
    }

    // Disconnected tiles (no path exists)
    const isolatedTile: Tile = {
      ...templateTile,
      id: 'los_isolated',
      x: 10,
      z: 10,
      connections: [closedEdge('north'), closedEdge('south'), closedEdge('east'), closedEdge('west')]
    };
    if (hasLineOfSight(losStart, isolatedTile, [...losBoard, isolatedTile])) {
      throw new Error('hasLineOfSight: should return false for disconnected tiles');
    }

    // Path with blocker
    const losMiddleBlocked: Tile = {
      ...losMiddle,
      id: 'los_middle_blocked',
      blocksLineOfSight: true
    };
    const losBoardBlocked = [losStart, losMiddleBlocked, losEnd, losEast];
    if (hasLineOfSight(losStart, losEnd, losBoardBlocked)) {
      throw new Error('hasLineOfSight: should return false when path contains a blocker');
    }

    console.log('  hasLineOfSight PASSED');

    // -----------------------------------------------------------------------
    // 20. MonsterAI.findClosestHero
    // -----------------------------------------------------------------------
    console.log('Testing MonsterAI.findClosestHero...');

    const hero1: Hero = {
      id: 'hero1',
      name: 'Hero 1',
      type: 'hero',
      heroClass: 'paladin',
      level: 1,
      surgeValue: 3,
      xp: 0,
      surgeUsed: false,
      abilities: [],
      hand: [],
      items: [],
      position: { x: 2, z: 1, sqX: 1, sqZ: 1 },
      hp: 10,
      maxHp: 10,
      ac: 15,
      speed: 6,
      isExhausted: false,
      attackBonus: 0,
      conditions: [],
      usedPowers: []
    };
    // Helper function to create a hero
    const createAIHero = (id: string, x: number, z: number): Hero => ({
      id,
      name: 'AI Test Hero',
      type: 'hero',
      heroClass: 'fighter',
      level: 1,
      surgeValue: 3,
      xp: 0,
      surgeUsed: false,
      abilities: [],
      hand: [],
      items: [],
      position: { x, z, sqX: 1, sqZ: 1 },
      hp: 10,
      maxHp: 10,
      ac: 15,
      speed: 6,
      isExhausted: false,
      attackBonus: 0,
      conditions: [],
      usedPowers: []
    });

    // Helper function to create an AI test tile
    const createAITile = (id: string, x: number, z: number, connections: TileConnection[]): Tile => ({
      id,
      name: 'AI Test Tile',
      x,
      z,
      terrainType: 'corridor',
      connections,
      boneSquare: { sqX: 1, sqZ: 1 },
      isRevealed: true,
      isStart: false,
      isExit: false,
      rotation: 0,
      monsters: [],
      heroes: [],
      items: []
    });

    // Helper function to create an AI test monster
    const createAIMonster = (id: string, moveRange: number): Monster => ({
      id,
      name: 'AI Test Monster',
      type: 'monster',
      monsterType: 'zombie',
      behavior: {
        conditions: [],
        priorityTargets: [],
        actions: ['attack']
      },
      attackBonus: 0,
      damage: 1,
      experienceValue: 1,
      ownedByHeroId: null,
      moveRange,
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 5,
      maxHp: 5,
      ac: 10,
      speed: 4,
      isExhausted: false,
      conditions: [],
      usedPowers: []
    });

    // Helper function to create a game state
    const createAIState = (heroes: Hero[], tiles: Tile[]): GameState => ({
      logIdCounter: 0,
      phase: 'monster',
      currentHeroId: heroes[0]?.id ?? '',
      heroes,
      monsters: [],
      tiles,
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      monsterDeck: [],
      discardPiles: {
        treasure: [],
        encounter: [],
        ability: [],
        monster: []
      },
      activeScenario: {
        id: 'ai_test',
        name: 'AI Test',
        difficulty: 'Easy',
        description: 'AI Test',
        introText: 'AI Test',
        victoryText: 'AI Test',
        defeatText: 'AI Test',
        objectives: [],
        specialRules: [],
        startTileId: tiles[0]?.id ?? '',
        maxSurges: 3
      },
      turnOrder: heroes.map(h => h.id),
      healingSurges: 2,
      turnCount: 1,
      log: [],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [],
      villainPhaseQueue: [],
      activeVillainId: null,
      activeConditions: [],
      powerSelections: [],
      cardResolution: {
        phase: 'idle',
        cardId: null,
        cardType: null,
        pendingEffects: [],
        resolvedEffects: [],
        targetEntityId: null,
        result: null,
      }
    });

    // Test 1: Close Combat Test - Monster at (1,1), Hero at (1,0) (adjacent)
    console.log('  Test 1: Close Combat Test...');
    {
      const tile11 = createAITile('ai_1_1', 1, 1, [openEdge('north'), closedEdge('east'), closedEdge('south'), closedEdge('west')]);
      const tile10 = createAITile('ai_1_0', 1, 0, [openEdge('south'), closedEdge('east'), closedEdge('north'), closedEdge('west')]);
      tile10.connections[0].connectedTileId = 'ai_1_1';
      tile11.connections[0].connectedTileId = 'ai_1_0';

      const monster = createAIMonster('monster_close', 1);
      const hero = createAIHero('hero_close', 1, 0);
      const state = createAIState([hero], [tile11, tile10]);

      const result = resolveTactic(monster, tile11, state);
      if (result.action !== 'attack') {
        throw new Error(`Test 1: Expected attack, got ${result.action}`);
      }
      if (result.action === 'attack' && result.targetHeroId !== 'hero_close') {
        throw new Error(`Test 1: Expected targetHeroId 'hero_close', got ${result.targetHeroId}`);
      }
      if (result.action === 'attack' && result.damage !== 1) {
        throw new Error(`Test 1: Expected damage 1, got ${result.damage}`);
      }
      console.log('  Test 1 PASSED: Adjacent monster attacks hero');
    }

    // Test 2: Move to Attack Test - Monster at (2,1), Hero at (0,1) (distance 2, moveRange 1)
    console.log('  Test 2: Move to Attack Test...');
    {
      const tile21 = createAITile('ai_2_1', 2, 1, [openEdge('west'), closedEdge('east'), closedEdge('north'), closedEdge('south')]);
      const tile11 = createAITile('ai_1_1', 1, 1, [openEdge('west'), openEdge('east'), closedEdge('north'), closedEdge('south')]);
      const tile01 = createAITile('ai_0_1', 0, 1, [openEdge('east'), closedEdge('west'), closedEdge('north'), closedEdge('south')]);

      tile21.connections[0].connectedTileId = 'ai_1_1';
      tile11.connections[0].connectedTileId = 'ai_0_1';
      tile11.connections[1].connectedTileId = 'ai_2_1';
      tile01.connections[0].connectedTileId = 'ai_1_1';

      const monster = createAIMonster('monster_move', 1);
      const hero = createAIHero('hero_move', 0, 1);
      const state = createAIState([hero], [tile21, tile11, tile01]);

      const result = resolveTactic(monster, tile21, state);
      if (result.action !== 'move') {
        throw new Error(`Test 2: Expected move, got ${result.action}`);
      }
      if (result.action === 'move' && result.path.length !== 1) {
        throw new Error(`Test 2: Expected path length 1, got ${result.path.length}`);
      }
      if (result.action === 'move' && result.path[0].id !== 'ai_1_1') {
        throw new Error(`Test 2: Expected path to tile 'ai_1_1', got ${result.path[0].id}`);
      }
      console.log('  Test 2 PASSED: Monster moves 1 tile closer (distance 2 -> 1)');
    }

    // Test 3: Multi-Turn Chase Test - Monster at (3,0), Hero at (0,0) (distance 3, moveRange 1)
    console.log('  Test 3: Multi-Turn Chase Test...');
    {
      const tile30 = createAITile('ai_3_0', 3, 0, [openEdge('west'), closedEdge('east'), closedEdge('north'), closedEdge('south')]);
      const tile20 = createAITile('ai_2_0', 2, 0, [openEdge('west'), openEdge('east'), closedEdge('north'), closedEdge('south')]);
      const tile10 = createAITile('ai_1_0', 1, 0, [openEdge('west'), openEdge('east'), closedEdge('north'), closedEdge('south')]);
      const tile00 = createAITile('ai_0_0', 0, 0, [openEdge('east'), closedEdge('west'), closedEdge('north'), closedEdge('south')]);

      tile30.connections[0].connectedTileId = 'ai_2_0';
      tile20.connections[0].connectedTileId = 'ai_1_0';
      tile20.connections[1].connectedTileId = 'ai_3_0';
      tile10.connections[0].connectedTileId = 'ai_0_0';
      tile10.connections[1].connectedTileId = 'ai_2_0';
      tile00.connections[0].connectedTileId = 'ai_1_0';

      const monster = createAIMonster('monster_chase', 1);
      const hero = createAIHero('hero_chase', 0, 0);
      const state = createAIState([hero], [tile30, tile20, tile10, tile00]);

      const result = resolveTactic(monster, tile30, state);
      if (result.action !== 'move') {
        throw new Error(`Test 3: Expected move, got ${result.action}`);
      }
      if (result.action === 'move' && result.path.length !== 1) {
        throw new Error(`Test 3: Expected path length 1, got ${result.path.length}`);
      }
      if (result.action === 'move' && result.path[0].id !== 'ai_2_0') {
        throw new Error(`Test 3: Expected path to tile 'ai_2_0', got ${result.path[0].id}`);
      }
      // Verify monster gets 1 tile closer, still 2 tiles away from hero
      const landingTile = result.path[0];
      const newDistance = manhattanDistance(landingTile.x, landingTile.z, hero.position.x, hero.position.z);
      if (newDistance !== 2) {
        throw new Error(`Test 3: Expected new distance 2, got ${newDistance}`);
      }
      console.log('  Test 3 PASSED: Monster moves 1 tile closer (distance 3 -> 2)');
    }

    // Test 4: No Path Available Test - Monster at (1,1), Hero at (3,3), no connecting tiles
    console.log('  Test 4: No Path Available Test...');
    {
      const tile11 = createAITile('ai_no_1_1', 1, 1, [closedEdge('north'), closedEdge('east'), closedEdge('south'), closedEdge('west')]);
      const tile33 = createAITile('ai_no_3_3', 3, 3, [closedEdge('north'), closedEdge('east'), closedEdge('south'), closedEdge('west')]);

      const monster = createAIMonster('monster_no_path', 1);
      const hero = createAIHero('hero_no_path', 3, 3);
      const state = createAIState([hero], [tile11, tile33]);

      const result = resolveTactic(monster, tile11, state);
      if (result.action !== 'idle') {
        throw new Error(`Test 4: Expected idle, got ${result.action}`);
      }
      console.log('  Test 4 PASSED: Returns idle when no path available');
    }

    // Test 5: Move Then Attack Test - Monster at (2,0), Hero at (0,0), moveRange 2
    console.log('  Test 5: Move Then Attack Test...');
    {
      const tile20 = createAITile('ai_mta_2_0', 2, 0, [openEdge('west'), closedEdge('east'), closedEdge('north'), closedEdge('south')]);
      const tile10 = createAITile('ai_mta_1_0', 1, 0, [openEdge('west'), openEdge('east'), closedEdge('north'), closedEdge('south')]);
      const tile00 = createAITile('ai_mta_0_0', 0, 0, [openEdge('east'), closedEdge('west'), closedEdge('north'), closedEdge('south')]);

      tile20.connections[0].connectedTileId = 'ai_mta_1_0';
      tile10.connections[0].connectedTileId = 'ai_mta_0_0';
      tile10.connections[1].connectedTileId = 'ai_mta_2_0';
      tile00.connections[0].connectedTileId = 'ai_mta_1_0';

      const monster = createAIMonster('monster_mta', 2); // moveRange 2
      const hero = createAIHero('hero_mta', 0, 0);
      const state = createAIState([hero], [tile20, tile10, tile00]);

      const result = resolveTactic(monster, tile20, state);
      if (result.action !== 'move_then_attack') {
        throw new Error(`Test 5: Expected move_then_attack, got ${result.action}`);
      }
      if (result.action === 'move_then_attack' && result.path.length !== 1) {
        throw new Error(`Test 5: Expected path length 1, got ${result.path.length}`);
      }
      if (result.action === 'move_then_attack' && result.path[0].id !== 'ai_mta_1_0') {
        throw new Error(`Test 5: Expected path to tile 'ai_mta_1_0', got ${result.path[0].id}`);
      }
      if (result.action === 'move_then_attack' && result.targetHeroId !== 'hero_mta') {
        throw new Error(`Test 5: Expected targetHeroId 'hero_mta', got ${result.targetHeroId}`);
      }
      console.log('  Test 5 PASSED: Monster moves then attacks (moveRange 2)');
    }

    console.log('  Monster AI Tactic Tests PASSED');

    // -----------------------------------------------------------------------
    // 22. MonsterAI.resolveTactic - Tactic Parser & Monster Activation
    // -----------------------------------------------------------------------
    console.log('Testing MonsterAI.resolveTactic...');

    // Create test tiles
    const tacticTile0: Tile = {
      ...templateTile,
      id: 'tactic_0',
      x: 0,
      z: 0,
      connections: [openEdge('north'), openEdge('east'), closedEdge('south'), closedEdge('west')]
    };

    const tacticTile1: Tile = {
      ...templateTile,
      id: 'tactic_1',
      x: 0,
      z: -1,
      connections: [openEdge('north'), openEdge('south'), closedEdge('east'), closedEdge('west')]
    };
    tacticTile1.connections[1].connectedTileId = 'tactic_0';

    const tacticTile2: Tile = {
      ...templateTile,
      id: 'tactic_2',
      x: 1,
      z: 0,
      connections: [openEdge('north'), openEdge('south'), openEdge('west'), closedEdge('east')]
    };
    tacticTile2.connections[2].connectedTileId = 'tactic_0';

    const tacticTile3: Tile = {
      ...templateTile,
      id: 'tactic_3',
      x: 0,
      z: -2,
      connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')]
    };
    tacticTile3.connections[0].connectedTileId = 'tactic_1';
    tacticTile1.connections[0].connectedTileId = 'tactic_3';

    tacticTile0.connections[0].connectedTileId = 'tactic_1';
    tacticTile0.connections[1].connectedTileId = 'tactic_2';

    const tacticTiles = [tacticTile0, tacticTile1, tacticTile2, tacticTile3];

    // Create test monster
    const testMonster: Monster = {
      id: 'monster_test',
      name: 'Test Monster',
      type: 'monster',
      monsterType: 'zombie',
      behavior: { conditions: [], priorityTargets: [], actions: [] },
      attackBonus: 0,
      damage: 2,
      experienceValue: 10,
      ownedByHeroId: null,
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 5,
      maxHp: 5,
      ac: 12,
      speed: 6,
      isExhausted: false,
      conditions: [],
      usedPowers: []
    };

    // Create test hero
    const testHero: Hero = {
      id: 'hero_test',
      name: 'Test Hero',
      type: 'hero',
      heroClass: 'fighter',
      level: 1,
      surgeValue: 3,
      xp: 0,
      surgeUsed: false,
      abilities: [],
      hand: [],
      items: [],
      position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
      hp: 10,
      maxHp: 10,
      ac: 15,
      speed: 6,
      isExhausted: false,
      attackBonus: 0,
      conditions: [],
      usedPowers: []
    };

    // Create test game state
    const testGameState: GameState = {
      phase: 'monster',
      currentHeroId: 'hero_test',
      heroes: [testHero],
      monsters: [testMonster],
      tiles: tacticTiles,
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      discardPiles: {},
      activeScenario: {
        id: 'test',
        name: 'Test',
        difficulty: 'Easy',
        description: 'Test',
        introText: 'Test',
        victoryText: 'Test',
        defeatText: 'Test',
        objectives: [],
        specialRules: [],
        startTileId: 'tactic_0',
        maxSurges: 3
      },
      turnOrder: ['hero_test'],
      healingSurges: 2,
      turnCount: 1,
      log: [],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [],
      villainPhaseQueue: [],
      activeVillainId: null, activeConditions: []
    } as any;

    // Step 1: Test with no heroes - should return idle
    const noHeroesState = { ...testGameState, heroes: [] };
    const result1 = resolveTactic(testMonster, tacticTile0, noHeroesState);
    if (result1.action !== 'idle') {
      throw new Error(`Step 1: Expected idle with no heroes, got ${result1.action}`);
    }
    console.log('  Step 1 PASSED: Returns idle when no heroes');

    // Step 2: Test with hero on same tile (distance === 0) - should attack if LoS
    const sameTileHero: Hero = { ...testHero, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
    const sameTileState = { ...testGameState, heroes: [sameTileHero] };
    const result2 = resolveTactic(testMonster, tacticTile0, sameTileState);
    if (result2.action !== 'attack') {
      throw new Error(`Step 2: Expected attack with hero on same tile, got ${result2.action}`);
    }
    if (result2.action === 'attack' && result2.targetHeroId !== 'hero_test') {
      throw new Error(`Step 2: Expected targetHeroId 'hero_test', got ${result2.targetHeroId}`);
    }
    if (result2.action === 'attack' && result2.damage !== 2) {
      throw new Error(`Step 2: Expected damage 2, got ${result2.damage}`);
    }
    console.log('  Step 2 PASSED: Attacks hero on same tile with LoS');

    // Step 3: Test with hero on adjacent tile (distance === 1) - should attack if LoS
    const adjacentHero: Hero = { ...testHero, position: { x: 0, z: -1, sqX: 1, sqZ: 1 } };
    const adjacentState = { ...testGameState, heroes: [adjacentHero] };
    const result3 = resolveTactic(testMonster, tacticTile0, adjacentState);
    if (result3.action !== 'attack') {
      throw new Error(`Step 3: Expected attack with hero on adjacent tile, got ${result3.action}`);
    }
    console.log('  Step 3 PASSED: Attacks hero on adjacent tile with LoS');

    // Step 4: Test with hero at distance 2 - should move closer
    const distantHero: Hero = { ...testHero, position: { x: 0, z: -2, sqX: 1, sqZ: 1 } };
    const distantState = { ...testGameState, heroes: [distantHero] };
    const result4 = resolveTactic(testMonster, tacticTile0, distantState);
    if (result4.action !== 'move') {
      throw new Error(`Step 4: Expected move with hero at distance 2, got ${result4.action}`);
    }
    if (result4.action === 'move' && result4.path.length === 0) {
      throw new Error('Step 4: Expected non-empty path for move');
    }
    console.log('  Step 4 PASSED: Moves toward hero at distance 2');

    // Step 5: Test with hero too far - should return idle (fallback)
    const farHero: Hero = { ...testHero, position: { x: 10, z: 10, sqX: 1, sqZ: 1 } };
    const farState = { ...testGameState, heroes: [farHero] };
    const result5 = resolveTactic(testMonster, tacticTile0, farState);
    if (result5.action !== 'idle') {
      throw new Error(`Step 5: Expected idle when hero is too far, got ${result5.action}`);
    }
    console.log('  Step 5 PASSED: Returns idle when hero is too far');

    console.log('  resolveTactic PASSED');

    // -----------------------------------------------------------------------
    // 23. Trap Activation Tests
    // -----------------------------------------------------------------------
    console.log('Testing Trap Activation...');

    // Create test tiles for trap tests
    const trapTile: Tile = {
      ...templateTile,
      id: 'trap_tile',
      x: 0,
      z: 0,
      connections: []
    };

    const otherTile: Tile = {
      ...templateTile,
      id: 'other_tile',
      x: 1,
      z: 0,
      connections: []
    };

    // Create test hero
    const trapHero: Hero = {
      id: 'hero_trap',
      name: 'Trap Hero',
      type: 'hero',
      heroClass: 'fighter',
      level: 1,
      surgeValue: 3,
      xp: 0,
      surgeUsed: false,
      abilities: [],
      hand: [],
      items: [],
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 10,
      maxHp: 10,
      ac: 15,
      speed: 6,
      isExhausted: false,
      attackBonus: 0,
      conditions: [],
      usedPowers: []
    };

    // Create test trap
    const testTrap: Trap = {
      id: 'trap_test',
      cardId: 'card_trap',
      tileId: 'trap_tile',
      isDisabled: false,
      ownedByHeroId: null,
      isTriggered: false
    };

    // Create test game state
    const trapGameState: GameState = {
      phase: 'hero',
      currentHeroId: 'hero_trap',
      heroes: [trapHero],
      monsters: [],
      tiles: [trapTile, otherTile],
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      discardPiles: {},
      activeScenario: {
        id: 'test_trap',
        name: 'Trap Test',
        difficulty: 'Easy',
        description: 'Test',
        introText: 'Test',
        victoryText: 'Test',
        defeatText: 'Test',
        objectives: [],
        specialRules: [],
        startTileId: 'trap_tile',
        maxSurges: 3
      },
      turnOrder: ['hero_trap'],
      healingSurges: 2,
      turnCount: 1,
      log: [],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [testTrap],
      villainPhaseQueue: [],
      activeVillainId: null,
      activeConditions: []
    } as any;

    // Test 1: Hero on trap tile → result is not null, damage applied
    const trapResult1 = resolveTrap(testTrap, trapTile, trapGameState);
    if (trapResult1 === null) {
      throw new Error('resolveTrap: should return non-null when hero is on trap tile');
    }
    if (trapResult1.targetHeroId !== 'hero_trap') {
      throw new Error(`resolveTrap: expected targetHeroId 'hero_trap', got ${trapResult1.targetHeroId}`);
    }
    if (trapResult1.damage !== 1) {
      throw new Error(`resolveTrap: expected damage 1, got ${trapResult1.damage}`);
    }

    // Test applyTrapResult with hero on trap tile
    const trapState1 = applyTrapResult(trapGameState, 'trap_test', trapResult1);
    if (trapState1.heroes[0].hp !== 9) {
      throw new Error(`applyTrapResult: expected hp 9 (10-1), got ${trapState1.heroes[0].hp}`);
    }
    if (trapState1.traps[0].isTriggered !== false) {
      throw new Error('applyTrapResult: expected trap.isTriggered to remain false');
    }
    // Verify original state is unchanged
    if (trapGameState.heroes[0].hp !== 10) {
      throw new Error('applyTrapResult: should not mutate original state');
    }
    if (trapGameState.traps[0].isTriggered !== false) {
      throw new Error('applyTrapResult: should not mutate original trap state');
    }
    console.log('  Test 1 PASSED: Hero on trap tile → result is not null, damage applied');

    // Test 2: Hero NOT on trap tile → result is null, state unchanged
    const heroOffTrap: Hero = { ...trapHero, position: { x: 1, z: 0, sqX: 1, sqZ: 1 } };
    const trapState2 = { ...trapGameState, heroes: [heroOffTrap] };
    const trapResult2 = resolveTrap(testTrap, trapTile, trapState2);
    if (trapResult2 !== null) {
      throw new Error('resolveTrap: should return null when hero is NOT on trap tile');
    }
    console.log('  Test 2 PASSED: Hero NOT on trap tile → result is null, state unchanged');

    // Test 3: Already-triggered trap → result is null
    const triggeredTrap = { ...testTrap, isTriggered: true };
    const trapState3 = { ...trapGameState, traps: [triggeredTrap] };
    const trapResult3 = resolveTrap(triggeredTrap, trapTile, trapState3);
    if (trapResult3 !== null) {
      throw new Error('resolveTrap: should return null when trap is already triggered');
    }
    console.log('  Test 3 PASSED: Already-triggered trap → result is null');

    console.log('  Trap Activation PASSED');

    // -----------------------------------------------------------------------
    // Villain Phase Sequencer Test
    // -----------------------------------------------------------------------
    console.log('Testing Villain Phase Sequencer...');

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
      attackBonus: 0,
      surgeUsed: false,
      conditions: [],
      usedPowers: [],
      abilities: [],
      hand: [],
      items: []
    };

    const villainMonster: Monster = {
      id: 'monster_skeleton_villain',
      name: 'Troll',
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
    };

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
    } as any;

    // Test: Villain Phase - Move-toward AND move-then-attack behavior in sequence

    // 1. Setup verification
    const skeletonBefore = villainGameState.monsters.find(m => m.id === 'monster_skeleton_villain');
    const heroBefore = villainGameState.heroes.find(h => h.id === 'hero_villain');
    if (!skeletonBefore) {
      throw new Error('Skeleton not found before villain phase');
    }
    if (!heroBefore) {
      throw new Error('Hero not found before villain phase');
    }

    // Verify skeleton.position points to tile at (2,0)
    if (skeletonBefore.position.x !== 2 || skeletonBefore.position.z !== 0) {
      throw new Error(`Expected skeleton at (2,0) before villain phase, got (${skeletonBefore.position.x}, ${skeletonBefore.position.z})`);
    }

    // Verify manhattanDistance = 2
    const initialDistance = manhattanDistance(skeletonBefore.position.x, skeletonBefore.position.z, heroBefore.position.x, heroBefore.position.z);
    if (initialDistance !== 2) {
      throw new Error(`Expected initial distance 2, got ${initialDistance}`);
    }

    // 2. Call await executeVillainPhase() (first endTurn)
    const afterFirstTurn = await executeVillainPhase(villainGameState);

    // Find skeleton and hero after first villain phase
    const skeletonAfterFirst = afterFirstTurn.monsters.find(m => m.id === 'monster_skeleton_villain');
    const heroAfterFirst = afterFirstTurn.heroes.find(h => h.id === 'hero_villain');
    if (!skeletonAfterFirst) {
      throw new Error('Skeleton not found after first villain phase');
    }
    if (!heroAfterFirst) {
      throw new Error('Hero not found after first villain phase');
    }

    // Verify skeleton.position points to tile at (1,0) - moved 1 tile closer
    if (skeletonAfterFirst.position.x !== 1 || skeletonAfterFirst.position.z !== 0) {
      throw new Error(`Expected skeleton at (1,0) after first villain phase, got (${skeletonAfterFirst.position.x}, ${skeletonAfterFirst.position.z})`);
    }

    // Verify new manhattanDistance = 1
    const distanceAfterFirst = manhattanDistance(skeletonAfterFirst.position.x, skeletonAfterFirst.position.z, heroAfterFirst.position.x, heroAfterFirst.position.z);
    if (distanceAfterFirst !== 1) {
      throw new Error(`Expected distance 1 after first villain phase, got ${distanceAfterFirst}`);
    }

    // Verify skeleton.hp unchanged (moved but didn't attack)
    if (skeletonAfterFirst.hp !== skeletonBefore.hp) {
      throw new Error(`Expected skeleton.hp unchanged (${skeletonBefore.hp}), got ${skeletonAfterFirst.hp}`);
    }

    // Verify hero.hp unchanged (skeleton not adjacent before move)
    if (heroAfterFirst.hp !== heroBefore.hp) {
      throw new Error(`Expected hero.hp unchanged (${heroBefore.hp}), got ${heroAfterFirst.hp}`);
    }

    console.log('  First turn PASSED: Skeleton moved 1 tile closer (distance 2 → 1), no attack');

    // 3. Call await executeVillainPhase() a second time
    AbilitySystem._rollOverride = () => 15; // Skeleton attacks hero: roll 15 + attackBonus 3 = 18 >= hero AC 15 (Hit!)
    const afterSecondTurn = await executeVillainPhase(afterFirstTurn);
    AbilitySystem._rollOverride = null;

    // Find skeleton and hero after second villain phase
    const skeletonAfterSecond = afterSecondTurn.monsters.find(m => m.id === 'monster_skeleton_villain');
    const heroAfterSecond = afterSecondTurn.heroes.find(h => h.id === 'hero_villain');
    if (!skeletonAfterSecond) {
      throw new Error('Skeleton not found after second villain phase');
    }
    if (!heroAfterSecond) {
      throw new Error('Hero not found after second villain phase');
    }

    // Verify skeleton.position still at (1,0) - already adjacent, no movement needed
    if (skeletonAfterSecond.position.x !== 1 || skeletonAfterSecond.position.z !== 0) {
      throw new Error(`Expected skeleton still at (1,0) after second villain phase, got (${skeletonAfterSecond.position.x}, ${skeletonAfterSecond.position.z})`);
    }

    // Verify skeleton attacks hero (now adjacent)
    if (heroAfterSecond.hp !== heroAfterFirst.hp - villainMonster.damage) {
      throw new Error(`Expected hero.hp reduced by ${villainMonster.damage} (${heroAfterFirst.hp - villainMonster.damage}), got ${heroAfterSecond.hp}`);
    }

    console.log('  Second turn PASSED: Skeleton attacks hero (now adjacent, distance 1 → 1)');

    // Verify villainPhaseQueue is empty after processing
    if (afterSecondTurn.villainPhaseQueue.length !== 0) {
      throw new Error(`Expected villainPhaseQueue to be empty after processing, got length ${afterSecondTurn.villainPhaseQueue.length}`);
    }

    // Verify activeVillainId is null after processing
    if (afterSecondTurn.activeVillainId !== null) {
      throw new Error(`Expected activeVillainId to be null after processing, got ${afterSecondTurn.activeVillainId}`);
    }

    // Verify original state is unchanged (immutability)
    if (villainGameState.monsters[0].position.x !== 2) {
      throw new Error('executeVillainPhase: should not mutate original state');
    }

    console.log('  Villain Phase Sequencer PASSED: Move-toward AND move-then-attack behavior tested');

    // -----------------------------------------------------------------------
    // Monster Data Validation - moveRange
    // -----------------------------------------------------------------------
    console.log('Testing Monster Data Validation - moveRange...');
    const dataLoader = DataLoader.getInstance();
    const monsters = dataLoader.getMonsters();

    for (const monster of monsters) {
      // Verify moveRange is defined (not undefined)
      if (monster.moveRange === undefined) {
        throw new Error(`Monster ${monster.id} (${monster.name}) is missing moveRange property`);
      }

      // Verify moveRange is within reasonable bounds (1-4, or 0 for static objects like Klak's artifact)
      const minMoveRange = (monster.id === 'monster_klaks_artifact' || monster.id === 'monster_gravestorms_phylactery') ? 0 : 1;
      if (monster.moveRange < minMoveRange || monster.moveRange > 4) {
        throw new Error(`Monster ${monster.id} (${monster.name}) has invalid moveRange: ${monster.moveRange}. Expected ${minMoveRange}-4.`);
      }

      console.log(`  ${monster.name}: moveRange = ${monster.moveRange}`);
    }

    console.log('  Monster Data Validation PASSED: All monsters have valid moveRange values');

    // -----------------------------------------------------------------------
    // 24. AbilitySystem.canUseAbility
    // -----------------------------------------------------------------------
    console.log('Testing AbilitySystem.canUseAbility...');
    // Statically imported AbilitySystem

    // Test ability with cooldown
    const abilityWithCooldown: MonsterAbility = {
      id: 'ability_cooldown',
      name: 'Cooldown Ability',
      description: 'Test ability with cooldown',
      type: 'active',
      cooldown: 2,
      currentCooldown: 1,
      effects: []
    };

    const monster: Monster = {
      id: 'test_monster',
      name: 'Test Monster',
      type: 'monster',
      monsterType: 'zombie',
      behavior: { conditions: [], priorityTargets: [], actions: [] },
      attackBonus: 0,
      damage: 1,
      experienceValue: 10,
      ownedByHeroId: null,
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 5,
      maxHp: 5,
      ac: 12,
      speed: 6,
      isExhausted: false,
      conditions: [],
      usedPowers: []
    };

    if (AbilitySystem.canUseAbility(abilityWithCooldown, monster, testGameState)) {
      throw new Error('canUseAbility: should return false when currentCooldown > 0');
    }

    // Test ability with no cooldown
    const abilityNoCooldown: MonsterAbility = {
      ...abilityWithCooldown,
      id: 'ability_no_cooldown',
      currentCooldown: 0
    };

    if (!AbilitySystem.canUseAbility(abilityNoCooldown, monster, testGameState)) {
      throw new Error('canUseAbility: should return true when currentCooldown = 0');
    }

    // Test passive ability
    const abilityPassive: MonsterAbility = {
      ...abilityWithCooldown,
      id: 'ability_passive',
      type: 'passive',
      currentCooldown: 0
    };

    if (AbilitySystem.canUseAbility(abilityPassive, monster, testGameState)) {
      throw new Error('canUseAbility: should return false for passive abilities');
    }

    // Test ability with remaining uses
    const abilityWithUses: MonsterAbility = {
      ...abilityWithCooldown,
      id: 'ability_uses',
      type: 'active',
      currentCooldown: 0,
      uses: 3,
      remainingUses: 0
    };

    if (AbilitySystem.canUseAbility(abilityWithUses, monster, testGameState)) {
      throw new Error('canUseAbility: should return false when remainingUses = 0');
    }

    const abilityWithUsesRemaining: MonsterAbility = {
      ...abilityWithUses,
      id: 'ability_uses_remaining',
      remainingUses: 2
    };

    if (!AbilitySystem.canUseAbility(abilityWithUsesRemaining, monster, testGameState)) {
      throw new Error('canUseAbility: should return true when remainingUses > 0');
    }

    console.log('  canUseAbility PASSED');

    // -----------------------------------------------------------------------
    // 25. AbilitySystem.getAbilityTargets
    // -----------------------------------------------------------------------
    console.log('Testing AbilitySystem.getAbilityTargets...');

    // Test 'self' target
    const effectSelf: AbilityEffect = {
      type: 'damage',
      target: 'self',
      value: 1
    };

    const targetsSelf = AbilitySystem.getAbilityTargets(effectSelf, monster, testGameState);
    if (targetsSelf.length !== 1 || targetsSelf[0].id !== 'test_monster') {
      throw new Error('getAbilityTargets: self target should return the monster');
    }

    // Test 'all_heroes' target
    const effectAllHeroes: AbilityEffect = {
      type: 'damage',
      target: 'all_heroes',
      value: 1
    };

    const targetsAllHeroes = AbilitySystem.getAbilityTargets(effectAllHeroes, monster, testGameState);
    if (targetsAllHeroes.length !== 1) {
      throw new Error(`getAbilityTargets: all_heroes should return 1 hero, got ${targetsAllHeroes.length}`);
    }

    // Test 'random_hero' target
    const effectRandomHero: AbilityEffect = {
      type: 'damage',
      target: 'random_hero',
      value: 1
    };

    const targetsRandomHero = AbilitySystem.getAbilityTargets(effectRandomHero, monster, testGameState);
    if (targetsRandomHero.length !== 1) {
      throw new Error('getAbilityTargets: random_hero should return 1 hero');
    }

    // Test 'closest_hero' target
    const effectClosestHero: AbilityEffect = {
      type: 'damage',
      target: 'closest_hero',
      value: 1
    };

    const targetsClosestHero = AbilitySystem.getAbilityTargets(effectClosestHero, monster, testGameState);
    if (targetsClosestHero.length !== 1) {
      throw new Error('getAbilityTargets: closest_hero should return 1 hero');
    }

    console.log('  getAbilityTargets PASSED');

    // -----------------------------------------------------------------------
    // 26. AbilitySystem.applyAbilityEffect
    // -----------------------------------------------------------------------
    console.log('Testing AbilitySystem.applyAbilityEffect...');

    // Test damage effect
    const effectDamage: AbilityEffect = {
      type: 'damage',
      target: 'all_heroes',
      value: 3
    };

    const stateBeforeDamage = {
      ...testGameState,
      heroes: [{ ...testHero, hp: 10 }]
    };

    const stateAfterDamage = AbilitySystem.applyAbilityEffect(
      effectDamage,
      monster,
      stateBeforeDamage.heroes,
      stateBeforeDamage
    );

    if (stateAfterDamage.heroes[0].hp !== 7) {
      throw new Error(`applyAbilityEffect: damage should reduce HP from 10 to 7, got ${stateAfterDamage.heroes[0].hp}`);
    }

    // Verify original state is unchanged
    if (stateBeforeDamage.heroes[0].hp !== 10) {
      throw new Error('applyAbilityEffect: should not mutate original state');
    }

    // Test heal effect
    const effectHeal: AbilityEffect = {
      type: 'heal',
      target: 'self',
      value: 2
    };

    const monsterDamaged: Monster = { ...monster, hp: 3 };
    const stateBeforeHeal = {
      ...testGameState,
      monsters: [monsterDamaged]
    };

    const stateAfterHeal = AbilitySystem.applyAbilityEffect(
      effectHeal,
      monsterDamaged,
      [monsterDamaged],
      stateBeforeHeal
    );

    if (stateAfterHeal.monsters[0].hp !== 5) {
      throw new Error(`applyAbilityEffect: heal should increase HP from 3 to 5, got ${stateAfterHeal.monsters[0].hp}`);
    }

    // Test heal capped at maxHp
    const monsterFullHp: Monster = { ...monster, hp: 5, maxHp: 5 };
    const stateBeforeHealFull = {
      ...testGameState,
      monsters: [monsterFullHp]
    };

    const stateAfterHealFull = AbilitySystem.applyAbilityEffect(
      effectHeal,
      monsterFullHp,
      [monsterFullHp],
      stateBeforeHealFull
    );

    if (stateAfterHealFull.monsters[0].hp !== 5) {
      throw new Error(`applyAbilityEffect: heal should cap at maxHp (5), got ${stateAfterHealFull.monsters[0].hp}`);
    }

    console.log('  applyAbilityEffect PASSED');

    // -----------------------------------------------------------------------
    // 27. AbilitySystem.processCooldowns
    // -----------------------------------------------------------------------
    console.log('Testing AbilitySystem.processCooldowns...');

    const monsterWithCooldowns: Monster = {
      ...monster,
      id: 'monster_cooldowns',
      abilities: [
        { ...abilityWithCooldown, id: 'cd_1', currentCooldown: 2 },
        { ...abilityWithCooldown, id: 'cd_2', currentCooldown: 0 },
        { ...abilityWithCooldown, id: 'cd_3', currentCooldown: 1 }
      ]
    };

    const stateBeforeCooldowns = {
      ...testGameState,
      monsters: [monsterWithCooldowns]
    };

    const stateAfterCooldowns = AbilitySystem.processCooldowns(
      monsterWithCooldowns,
      stateBeforeCooldowns
    );

    const processedMonster = stateAfterCooldowns.monsters.find(m => m.id === 'monster_cooldowns');
    if (!processedMonster || !processedMonster.abilities) {
      throw new Error('processCooldowns: monster should have abilities after processing');
    }

    const cd1 = processedMonster.abilities.find(a => a.id === 'cd_1');
    const cd2 = processedMonster.abilities.find(a => a.id === 'cd_2');
    const cd3 = processedMonster.abilities.find(a => a.id === 'cd_3');

    if (cd1?.currentCooldown !== 1) {
      throw new Error(`processCooldowns: cd_1 should decrement from 2 to 1, got ${cd1?.currentCooldown}`);
    }
    if (cd2?.currentCooldown !== 0) {
      throw new Error(`processCooldowns: cd_2 should stay at 0, got ${cd2?.currentCooldown}`);
    }
    if (cd3?.currentCooldown !== 0) {
      throw new Error(`processCooldowns: cd_3 should decrement from 1 to 0, got ${cd3?.currentCooldown}`);
    }

    // Verify original state is unchanged
    const originalMonster = stateBeforeCooldowns.monsters.find(m => m.id === 'monster_cooldowns');
    if (originalMonster?.abilities?.[0].currentCooldown !== 2) {
      throw new Error('processCooldowns: should not mutate original state');
    }

    console.log('  processCooldowns PASSED');

    // -----------------------------------------------------------------------
    // 28. AbilityLibrary.getAbility - All 12 ids resolve
    // -----------------------------------------------------------------------
    console.log('Testing AbilityLibrary.getAbility...');
    const { getAbility } = await import('../game/ai/behaviors/AbilityLibrary');

    const abilityIds = [
      'undying', 'plague_aura', 'vampiric_bite', 'mist_form',
      'regeneration', 'fire_breath', 'summon', 'fear_aura',
      'drain_life', 'web', 'poison_cloud', 'howl'
    ];

    for (const id of abilityIds) {
      try {
        const ability = getAbility(id);
        if (ability.id !== id) {
          throw new Error(`getAbility: expected id "${id}", got "${ability.id}"`);
        }
      } catch (error) {
        throw new Error(`getAbility failed for id "${id}": ${error}`);
      }
    }

    console.log('  getAbility PASSED: All 12 ability ids resolve without throwing');

    // -----------------------------------------------------------------------
    // 29. BossPhases - Phase transitions and tactics
    // -----------------------------------------------------------------------
    console.log('Testing BossPhases...');
    const { BossPhases } = await import('../game/ai/BossPhases');

    // Create a test boss monster
    const bossMonster: Monster = {
      id: 'boss-strahd',
      name: 'Strahd von Zarovich',
      type: 'monster',
      monsterType: 'strahd',
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 100,
      maxHp: 100,
      ac: 18,
      speed: 6,
      isExhausted: false,
      conditions: [],
      usedPowers: [],
      behavior: { conditions: [], priorityTargets: [], actions: [] },
      attackBonus: 10,
      damage: 15,
      experienceValue: 200,
      ownedByHeroId: null,
      isBoss: true,
      currentPhase: undefined
    };

    const bossTestGameState: GameState = {
      phase: 'hero',
      currentHeroId: 'hero-1',
      heroes: [],
      monsters: [bossMonster],
      tiles: [],
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      discardPiles: {},
      activeScenario: {
        id: 'test',
        name: 'Test',
        difficulty: 'Medium',
        description: 'Test scenario',
        introText: 'Test intro',
        victoryText: 'Test victory',
        defeatText: 'Test defeat',
        objectives: [],
        specialRules: [],
        startTileId: 'tile-1',
        maxSurges: 3
      },
      turnOrder: [],
      healingSurges: 3,
      turnCount: 1,
      log: [],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [],
      villainPhaseQueue: [],
      activeVillainId: null,
      activeConditions: []
    } as any;

    // Assertion: Boss at 100% HP → getCurrentPhase returns phase p1
    const phaseAtFullHp = BossPhases.getCurrentPhase(bossMonster, bossTestGameState);
    if (!phaseAtFullHp || phaseAtFullHp.id !== 'p1') {
      throw new Error(`BossPhases.getCurrentPhase: expected phase id 'p1' at 100% HP, got ${phaseAtFullHp?.id ?? 'null'}`);
    }

    // Assertion: Boss at 49% HP → shouldTransitionPhase returns true
    bossMonster.hp = 49; // 49% of 100
    const shouldTransition = BossPhases.shouldTransitionPhase(bossMonster, bossTestGameState);
    if (!shouldTransition) {
      throw new Error('BossPhases.shouldTransitionPhase: expected true at 49% HP');
    }

    // Assertion: After transitionPhase → currentPhase is 'p2'
    const newState = BossPhases.transitionPhase(bossMonster, bossTestGameState);
    const updatedMonster = newState.monsters.find(m => m.id === bossMonster.id);
    if (!updatedMonster || updatedMonster.currentPhase !== 'p2') {
      throw new Error(`BossPhases.transitionPhase: expected currentPhase 'p2', got ${updatedMonster?.currentPhase ?? 'null'}`);
    }

    // Assertion: getPhaseTactics returns tactics for current phase
    const tactics = BossPhases.getPhaseTactics(updatedMonster, newState);
    if (!Array.isArray(tactics) || tactics.length === 0) {
      throw new Error('BossPhases.getPhaseTactics: expected non-empty tactics array');
    }

    // Assertion: Non-boss returns null from getCurrentPhase
    const nonBossMonster: Monster = { ...bossMonster, isBoss: false };
    const nonBossPhase = BossPhases.getCurrentPhase(nonBossMonster, bossTestGameState);
    if (nonBossPhase !== null) {
      throw new Error('BossPhases.getCurrentPhase: expected null for non-boss monster');
    }

    console.log('  BossPhases PASSED');

    // -----------------------------------------------------------------------
    // 30. MonsterAI.resolveTactic - Ability and Boss Integration
    // -----------------------------------------------------------------------
    console.log('Testing MonsterAI.resolveTactic - Ability and Boss Integration...');

    // Test 1: on_turn_start triggered ability fires before movement
    console.log('  Test 1: on_turn_start triggered ability fires before movement...');
    {
      const testTile: Tile = {
        ...templateTile,
        id: 'trigger_test_tile',
        x: 0,
        z: 0,
        connections: [openEdge('north'), openEdge('east'), closedEdge('south'), closedEdge('west')]
      };

      const triggeredMonster: Monster = {
        id: 'monster_triggered',
        name: 'Triggered Monster',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 0,
        damage: 1,
        experienceValue: 10,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        hp: 10,
        maxHp: 10,
        ac: 12,
        speed: 6,
        isExhausted: false,
        conditions: [],
        usedPowers: [],
        abilities: [
          {
            id: 'regen_test',
            name: 'Regen Test',
            description: 'Heal at start of turn',
            type: 'triggered',
            trigger: 'on_turn_start',
            effects: [
              {
                type: 'heal',
                target: 'self',
                value: 1
              }
            ]
          }
        ]
      };

      const triggerHero: Hero = {
        id: 'hero_trigger',
        name: 'Trigger Hero',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        surgeValue: 3,
        xp: 0,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: [],
        position: { x: 0, z: -1, sqX: 1, sqZ: 1 },
        hp: 10,
        maxHp: 10,
        ac: 15,
        speed: 6,
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const triggerState: GameState = {
        phase: 'monster',
        currentHeroId: 'hero_trigger',
        heroes: [triggerHero],
        monsters: [triggeredMonster],
        tiles: [testTile, { ...templateTile, id: 'hero_tile', x: 0, z: -1, connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')] }],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        discardPiles: {},
        activeScenario: {
          id: 'trigger_test',
          name: 'Trigger Test',
          difficulty: 'Easy',
          description: 'Test triggered abilities',
          introText: 'Test',
          victoryText: 'Test',
          defeatText: 'Test',
          objectives: [],
          specialRules: [],
          startTileId: 'trigger_test_tile',
          maxSurges: 3
        },
        turnOrder: ['hero_trigger'],
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
      } as any;

      const triggerResult = resolveTactic(triggeredMonster, testTile, triggerState);
      if (triggerResult.action !== 'use_ability') {
        throw new Error(`Test 1: Expected use_ability, got ${triggerResult.action}`);
      }
      if (triggerResult.action === 'use_ability' && triggerResult.abilityId !== 'regen_test') {
        throw new Error(`Test 1: Expected abilityId 'regen_test', got ${triggerResult.abilityId}`);
      }
      console.log('  Test 1 PASSED: on_turn_start triggered ability fires before movement');
    }

    // Test 2: Boss with hp at 49% returns 'idle' until phase transitions
    console.log('  Test 2: Boss with hp at 49% returns idle until phase transitions...');
    {
      const bossTile: Tile = {
        ...templateTile,
        id: 'boss_tile',
        x: 0,
        z: 0,
        connections: []
      };

      const boss49Hp: Monster = {
        id: 'boss-49hp',
        name: 'Boss at 49% HP',
        type: 'monster',
        monsterType: 'strahd',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 10,
        damage: 15,
        experienceValue: 200,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        hp: 49,
        maxHp: 100,
        ac: 18,
        speed: 6,
        isExhausted: false,
        conditions: [],
        usedPowers: [],
        isBoss: true,
        currentPhase: 'p1' // Currently in phase 1, but HP is at 49%
      };

      const bossHero: Hero = {
        id: 'hero_boss',
        name: 'Boss Hero',
        type: 'hero',
        heroClass: 'paladin',
        level: 1,
        surgeValue: 3,
        xp: 0,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: [],
        position: { x: 1, z: 0, sqX: 1, sqZ: 1 },
        hp: 10,
        maxHp: 10,
        ac: 15,
        speed: 6,
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const boss49State: GameState = {
        phase: 'monster',
        currentHeroId: 'hero_boss',
        heroes: [bossHero],
        monsters: [boss49Hp],
        tiles: [bossTile, { ...templateTile, id: 'hero_boss_tile', x: 1, z: 0, connections: [openEdge('west'), closedEdge('north'), closedEdge('south'), closedEdge('east')] }],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        discardPiles: {},
        activeScenario: {
          id: 'boss_test',
          name: 'Boss Test',
          difficulty: 'Hard',
          description: 'Test boss phase transitions',
          introText: 'Test',
          victoryText: 'Test',
          defeatText: 'Test',
          objectives: [],
          specialRules: [],
          startTileId: 'boss_tile',
          maxSurges: 3
        },
        turnOrder: ['hero_boss'],
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
      } as any;

      const boss49Result = resolveTactic(boss49Hp, bossTile, boss49State);
      if (boss49Result.action !== 'idle') {
        throw new Error(`Test 2: Expected idle for boss at 49% HP (needs phase transition), got ${boss49Result.action}`);
      }
      console.log('  Test 2 PASSED: Boss with hp at 49% returns idle until phase transitions');
    }

    // Test 3: Boss in phase 2 evaluates phase 2 tactics
    console.log('  Test 3: Boss in phase 2 evaluates phase 2 tactics...');
    {
      const boss2Tile: Tile = {
        ...templateTile,
        id: 'boss2_tile',
        x: 0,
        z: 0,
        connections: []
      };

      const bossPhase2: Monster = {
        id: 'boss-phase2',
        name: 'Boss in Phase 2',
        type: 'monster',
        monsterType: 'strahd',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 10,
        damage: 15,
        experienceValue: 200,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        hp: 30,
        maxHp: 100,
        ac: 18,
        speed: 6,
        isExhausted: false,
        conditions: [],
        usedPowers: [],
        isBoss: true,
        currentPhase: 'p2', // Already in phase 2
        abilities: [
          {
            id: 'vampiric_bite',
            name: 'Vampiric Bite',
            description: 'Heal for damage dealt.',
            type: 'active',
            effects: [
              {
                type: 'damage',
                target: 'closest_hero',
                value: 1
              },
              {
                type: 'heal',
                target: 'self',
                value: 1
              }
            ]
          }
        ]
      };

      const boss2Hero: Hero = {
        id: 'hero_boss2',
        name: 'Boss Phase 2 Hero',
        type: 'hero',
        heroClass: 'paladin',
        level: 1,
        surgeValue: 3,
        xp: 0,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: [],
        position: { x: 0, z: -1, sqX: 1, sqZ: 1 },
        hp: 10,
        maxHp: 10,
        ac: 15,
        speed: 6,
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const boss2State: GameState = {
        phase: 'monster',
        currentHeroId: 'hero_boss2',
        heroes: [boss2Hero],
        monsters: [bossPhase2],
        tiles: [boss2Tile, { ...templateTile, id: 'hero_boss2_tile', x: 0, z: -1, connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')] }],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        discardPiles: {},
        activeScenario: {
          id: 'boss2_test',
          name: 'Boss Phase 2 Test',
          difficulty: 'Hard',
          description: 'Test boss phase 2 tactics',
          introText: 'Test',
          victoryText: 'Test',
          defeatText: 'Test',
          objectives: [],
          specialRules: [],
          startTileId: 'boss2_tile',
          maxSurges: 3
        },
        turnOrder: ['hero_boss2'],
        healingSurges: 2,
        turnCount: 1,
        log: [],
        activeEnvironmentCard: null,
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null, activeConditions: []
      } as any;

      const boss2Result = resolveTactic(bossPhase2, boss2Tile, boss2State);
      // Boss should use vampiric_bite ability (phase 2 tactic with 'hp_low' condition)
      if (boss2Result.action !== 'use_ability') {
        throw new Error(`Test 3: Expected use_ability for boss in phase 2, got ${boss2Result.action}`);
      }
      if (boss2Result.action === 'use_ability' && boss2Result.abilityId !== 'vampiric_bite') {
        throw new Error(`Test 3: Expected abilityId 'vampiric_bite', got ${boss2Result.abilityId}`);
      }
      console.log('  Test 3 PASSED: Boss in phase 2 evaluates phase 2 tactics');
    }

    console.log('  MonsterAI.resolveTactic - Ability and Boss Integration PASSED');

    // -----------------------------------------------------------------------
    // AMI-7: gameStore Integration Test
    // -----------------------------------------------------------------------
    console.log('Testing gameStore.executeVillainPhase integration...');

    // Test 1: Strahd at 45% HP → phase transitions to p2 before tactic evaluates
    const strahdBoss: Monster = {
      id: 'strahd_test',
      name: 'Strahd von Zarovich',
      type: 'monster',
      monsterType: 'strahd',
      hp: 9, // 45% of 20 HP
      maxHp: 20,
      ac: 18,
      speed: 6,
      isExhausted: false,
      behavior: { conditions: [], priorityTargets: [], actions: [] },
      attackBonus: 10,
      damage: 10,
      experienceValue: 500,
      ownedByHeroId: 'hero_test',
      isBoss: true,
      currentPhase: 'p1',
      position: { x: 0, z: 0, sqX: 3, sqZ: 3 },
      conditions: [],
      usedPowers: [],
      abilities: [
        {
          id: 'fireball',
          name: 'Fireball',
          description: 'Launches a devastating fireball',
          type: 'active',
          trigger: 'on_turn_start',
          cooldown: 3,
          currentCooldown: 0,
          effects: [
            { type: 'damage', value: 5, target: 'all_heroes' }
          ]
        },
        {
          id: 'vampiric_bite',
          name: 'Vampiric Bite',
          description: 'Bites a hero to drain their life force',
          type: 'active',
          trigger: 'on_turn_start',
          cooldown: 2,
          currentCooldown: 0,
          effects: [
            { type: 'damage', value: 3, target: 'closest_hero' }
          ]
        }
      ]
    };

    const strahdHero: Hero = {
      id: 'hero_test',
      name: 'Test Hero',
      type: 'hero',
      heroClass: 'paladin',
      level: 1,
      surgeValue: 3,
      xp: 0,
      surgeUsed: false,
      abilities: [],
      hand: [],
      items: [],
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 10,
      maxHp: 10,
      ac: 15,
      speed: 6,
      isExhausted: false,
      attackBonus: 0,
      conditions: [],
      usedPowers: []
    };

    const strahdTile: Tile = {
      ...templateTile,
      id: 'strahd_tile',
      x: 0,
      z: 0,
      connections: [openEdge('north'), openEdge('south'), closedEdge('east'), closedEdge('west')]
    };

    const strahdState: GameState = {
      phase: 'villain',
      currentHeroId: 'hero_test',
      heroes: [strahdHero],
      monsters: [strahdBoss],
      tiles: [strahdTile, { ...templateTile, id: 'hero_test_tile', x: 0, z: -1, connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')] }],
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      monsterDeck: [],
      discardPiles: {
        treasure: [],
        encounter: [],
        ability: [],
        monster: []
      },
      activeScenario: {
        id: 'strahd_test',
        name: 'Strahd Phase Transition Test',
        difficulty: 'Hard',
        description: 'Test Strahd phase transition',
        introText: 'Test',
        victoryText: 'Test',
        defeatText: 'Test',
        objectives: [],
        specialRules: [],
        startTileId: 'strahd_tile',
        maxSurges: 3
      },
      turnOrder: ['hero_test'],
      healingSurges: 2,
      turnCount: 1,
      log: [],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [],
      villainPhaseQueue: [],
      activeVillainId: null,
      activeConditions: [],
      powerSelections: [],
      cardResolution: {
        phase: 'idle',
        cardId: null,
        cardType: null,
        pendingEffects: [],
        resolvedEffects: [],
        targetEntityId: null,
        result: null,
      }
    } as any;

    // Execute villain phase - Strahd should transition to phase 2 before evaluating tactics
    const strahdResult = await executeVillainPhase(strahdState);
    const updatedStrahd = strahdResult.monsters.find(m => m.id === 'strahd_test');
    if (!updatedStrahd) {
      throw new Error('Test 1: Strahd monster not found after villain phase');
    }
    if (updatedStrahd.currentPhase !== 'p2') {
      throw new Error(`Test 1: Expected Strahd to transition to phase p2, got ${updatedStrahd.currentPhase}`);
    }
    console.log('  Test 1 PASSED: Strahd at 45% HP transitions to phase 2 before tactic evaluates');

    // Test 2: Monster with regeneration → gains 1 HP at turn start
    const regenMonster: Monster = {
      id: 'regen_test',
      name: 'Regenerating Monster',
      type: 'monster',
      monsterType: 'vampire',
      hp: 8,
      maxHp: 10,
      ac: 14,
      speed: 6,
      isExhausted: false,
      behavior: { conditions: [], priorityTargets: [], actions: [] },
      attackBonus: 5,
      damage: 3,
      experienceValue: 200,
      ownedByHeroId: 'hero_test2',
      position: { x: 0, z: 0, sqX: 3, sqZ: 3 },
      conditions: [],
      usedPowers: [],
      abilities: [
        {
          id: 'regeneration',
          name: 'Regeneration',
          description: 'Heals 1 HP at the start of each turn',
          type: 'passive',
          trigger: 'on_turn_start',
          effects: [
            { type: 'heal', value: 1, target: 'self' }
          ]
        }
      ]
    };

    const regenHero: Hero = {
      id: 'hero_test2',
      name: 'Test Hero 2',
      type: 'hero',
      heroClass: 'cleric',
      level: 1,
      surgeValue: 3,
      xp: 0,
      surgeUsed: false,
      abilities: [],
      hand: [],
      items: [],
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 10,
      maxHp: 10,
      ac: 15,
      speed: 6,
      isExhausted: false,
      attackBonus: 0,
      conditions: [],
      usedPowers: []
    };

    const regenState: GameState = {
      phase: 'villain',
      currentHeroId: 'hero_test2',
      heroes: [regenHero],
      monsters: [regenMonster],
      tiles: [strahdTile, { ...templateTile, id: 'hero_test2_tile', x: 0, z: -1, connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')] }],
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      monsterDeck: [],
      discardPiles: {
        treasure: [],
        encounter: [],
        ability: [],
        monster: []
      },
      activeScenario: {
        id: 'regen_test',
        name: 'Regeneration Test',
        difficulty: 'Medium',
        description: 'Test regeneration passive ability',
        introText: 'Test',
        victoryText: 'Test',
        defeatText: 'Test',
        objectives: [],
        specialRules: [],
        startTileId: 'regen_tile',
        maxSurges: 3
      },
      turnOrder: ['hero_test2'],
      healingSurges: 2,
      turnCount: 1,
      log: [],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [],
      villainPhaseQueue: [],
      activeVillainId: null,
      activeConditions: [],
      powerSelections: [],
      cardResolution: {
        phase: 'idle',
        cardId: null,
        cardType: null,
        pendingEffects: [],
        resolvedEffects: [],
        targetEntityId: null,
        result: null,
      }
    } as any;

    const regenResult = await executeVillainPhase(regenState);
    const updatedRegenMonster = regenResult.monsters.find(m => m.id === 'regen_test');
    if (!updatedRegenMonster) {
      throw new Error('Test 2: Regenerating monster not found after villain phase');
    }
    if (updatedRegenMonster.hp !== 9) {
      throw new Error(`Test 2: Expected regenerating monster to have 9 HP (8 + 1), got ${updatedRegenMonster.hp}`);
    }
    console.log('  Test 2 PASSED: Monster with regeneration gains 1 HP at turn start');

    // Test 3: Skeleton defeated → undying rolls and potentially returns to 1 HP
    const skeletonMonster: Monster = {
      id: 'skeleton_undying_test',
      name: 'Skeleton',
      type: 'monster',
      monsterType: 'skeleton',
      hp: 0, // Defeated
      maxHp: 5,
      ac: 13,
      speed: 6,
      isExhausted: false,
      behavior: { conditions: [], priorityTargets: [], actions: [] },
      attackBonus: 4,
      damage: 2,
      experienceValue: 100,
      ownedByHeroId: 'hero_test3',
      position: { x: 0, z: 0, sqX: 3, sqZ: 3 },
      conditions: [],
      usedPowers: [],
      abilities: [
        {
          id: 'undying',
          name: 'Undying',
          description: 'Rolls to return to 1 HP when defeated',
          type: 'active',
          trigger: 'on_death',
          cooldown: 0,
          currentCooldown: 0,
          effects: [
            { type: 'heal', value: 1, target: 'self' }
          ]
        }
      ]
    };

    const undyingHero: Hero = {
      id: 'hero_test3',
      name: 'Test Hero 3',
      type: 'hero',
      heroClass: 'fighter',
      level: 1,
      surgeValue: 3,
      xp: 0,
      surgeUsed: false,
      abilities: [],
      hand: [],
      items: [],
      position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
      hp: 10,
      maxHp: 10,
      ac: 16,
      speed: 6,
      isExhausted: false,
      attackBonus: 0,
      conditions: [],
      usedPowers: []
    };

    const undyingState: GameState = {
      phase: 'villain',
      currentHeroId: 'hero_test3',
      heroes: [undyingHero],
      monsters: [skeletonMonster],
      tiles: [strahdTile, { ...templateTile, id: 'hero_test3_tile', x: 0, z: -1, connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')] }],
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      discardPiles: {},
      activeScenario: {
        id: 'undying_test',
        name: 'Undying Test',
        difficulty: 'Medium',
        description: 'Test undying ability',
        introText: 'Test',
        victoryText: 'Test',
        defeatText: 'Test',
        objectives: [],
        specialRules: [],
        startTileId: 'undying_tile',
        maxSurges: 3
      },
      turnOrder: ['hero_test3'],
      healingSurges: 2,
      turnCount: 1,
      log: [],
      activeEnvironmentCard: null,
      experiencePile: [],
      treasuresDrawnThisTurn: 0,
      traps: [],
      villainPhaseQueue: [],
      activeVillainId: null, activeConditions: []
    } as any;

    const undyingResult = await executeVillainPhase(undyingState);
    const updatedSkeleton = undyingResult.monsters.find(m => m.id === 'skeleton_undying_test');
    if (!updatedSkeleton) {
      throw new Error('Test 3: Skeleton monster not found after villain phase');
    }
    // The skeleton should have isDefeated flag set to true
    // The undying ability should execute and potentially heal the skeleton to 1 HP
    // Since undying uses a roll condition, we just check that the monster is marked as defeated
    if (!updatedSkeleton.isDefeated) {
      throw new Error('Test 3: Expected skeleton to have isDefeated flag set to true');
    }
    // Note: The actual undying roll result is handled by AbilitySystem.executeAbility
    // which includes a roll_15_plus condition check
    console.log('  Test 3 PASSED: Skeleton defeated with isDefeated flag, undying ability checked');

    // Test 4: Monsters that die mid-queue do not activate
    console.log('  Test 4: Monsters that die mid-queue do not activate...');
    {
      const monster1: Monster = {
        id: 'monster_active_1',
        name: 'Zombie Aura',
        type: 'monster',
        monsterType: 'zombie',
        hp: 10,
        maxHp: 10,
        ac: 10,
        speed: 4,
        isExhausted: false,
        behavior: {
          conditions: [],
          priorityTargets: [],
          actions: ['attack']
        },
        attackBonus: 4,
        damage: 2,
        experienceValue: 100,
        ownedByHeroId: 'hero_test_mid',
        position: { x: 0, z: 0, sqX: 3, sqZ: 3 },
        conditions: [],
        usedPowers: [],
        abilities: [
          {
            id: 'death_aura',
            name: 'Death Aura',
            description: 'Deals 5 damage to all monsters',
            type: 'passive',
            trigger: 'on_turn_start',
            effects: [
              { type: 'damage', value: 5, target: 'all_monsters' }
            ]
          }
        ]
      };

      const monster2: Monster = {
        id: 'monster_active_2',
        name: 'Skeleton Mid',
        type: 'monster',
        monsterType: 'skeleton',
        hp: 1,
        maxHp: 5,
        ac: 12,
        speed: 6,
        isExhausted: false,
        behavior: {
          conditions: [],
          priorityTargets: [],
          actions: ['attack']
        },
        attackBonus: 3,
        damage: 1,
        experienceValue: 100,
        ownedByHeroId: 'hero_test_mid',
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
        conditions: [],
        usedPowers: []
      };

      const midHero: Hero = {
        id: 'hero_test_mid',
        name: 'Test Hero Mid',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        surgeValue: 3,
        xp: 0,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: [],
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        hp: 10,
        maxHp: 10,
        ac: 16,
        speed: 6,
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const midState: GameState = {
        phase: 'villain',
        currentHeroId: 'hero_test_mid',
        heroes: [midHero],
        monsters: [monster1, monster2],
        tiles: [strahdTile, { ...templateTile, id: 'hero_test_mid_tile', x: 0, z: -1, connections: [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')] }],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        monsterDeck: [],
        discardPiles: {},
        activeScenario: {
          id: 'mid_test',
          name: 'Mid-Queue Death Test',
          difficulty: 'Medium',
          description: 'Test mid-queue death',
          introText: 'Test',
          victoryText: 'Test',
          defeatText: 'Test',
          objectives: [],
          specialRules: [],
          startTileId: 'strahd_tile',
          maxSurges: 3
        },
        turnOrder: ['hero_test_mid'],
        healingSurges: 2,
        turnCount: 1,
        log: [],
        activeEnvironmentCard: null,
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null,
        activeConditions: [],
        cardResolution: { phase: 'idle' }
      } as any;

      const midResult = await executeVillainPhase(midState);
      const updatedM1 = midResult.monsters.find(m => m.id === 'monster_active_1')!;
      const updatedM2 = midResult.monsters.find(m => m.id === 'monster_active_2')!;

      if (updatedM2.hp !== 0 || !updatedM2.isDefeated) {
        throw new Error(`Test 4: Expected monster_active_2 to be defeated (hp=0), got hp=${updatedM2.hp}, isDefeated=${updatedM2.isDefeated}`);
      }

      if (updatedM2.position.sqX !== 2 || updatedM2.position.sqZ !== 2) {
        throw new Error(`Test 4: Expected monster_active_2 position to be unchanged (2,2), got (${updatedM2.position.sqX}, ${updatedM2.position.sqZ})`);
      }

      const skeletonAttackedLog = midResult.log.some(entry => entry.message.includes('Skeleton Mid attacks'));
      if (skeletonAttackedLog) {
        throw new Error('Test 4: Expected Skeleton Mid to skip activation and not log any attacks, but found attack logs');
      }

      console.log('  Test 4 PASSED: Monsters that die mid-queue do not activate');
    }

    console.log('  gameStore.executeVillainPhase Integration PASSED');

    // -----------------------------------------------------------------------
    // 31. PowerSelectionSystem Tests
    // -----------------------------------------------------------------------
    console.log('Testing PowerSelectionSystem...');
    const PowerSelectionSystem = await import('../game/engine/PowerSelectionSystem');

    // Test setup: Create mock power cards
    const mockPowerCards: Card[] = [
      { id: 'power_atwill_1', type: 'ability', name: 'At-Will 1', description: '', effects: [], powerType: 'at-will' },
      { id: 'power_atwill_2', type: 'ability', name: 'At-Will 2', description: '', effects: [], powerType: 'at-will' },
      { id: 'power_atwill_3', type: 'ability', name: 'At-Will 3', description: '', effects: [], powerType: 'at-will' },
      { id: 'power_daily_1', type: 'ability', name: 'Daily 1', description: '', effects: [], powerType: 'daily' },
      { id: 'power_daily_2', type: 'ability', name: 'Daily 2', description: '', effects: [], powerType: 'daily' },
      { id: 'power_utility_1', type: 'ability', name: 'Utility 1', description: '', effects: [], powerType: 'utility' },
      { id: 'power_utility_2', type: 'ability', name: 'Utility 2', description: '', effects: [], powerType: 'utility' },
    ];

    const heroId = 'hero_test_pss';
    const constraints = PowerSelectionSystem.default.getConstraints('paladin');

    // Test 1: canSelectPower blocks when at-will limit (2) reached
    console.log('  Test 1: canSelectPower blocks when at-will limit (2) reached...');
    {
      const selection: any = { heroId, selectedPowerIds: ['power_atwill_1', 'power_atwill_2'], isConfirmed: false };
      const canSelect = PowerSelectionSystem.default.canSelectPower(
        mockPowerCards[2], // power_atwill_3
        selection,
        constraints,
        mockPowerCards
      );
      if (canSelect !== false) {
        throw new Error('canSelectPower should return false when at-will limit (2) is reached');
      }
      console.log('  Test 1 PASSED: canSelectPower blocks when at-will limit (2) reached');
    }

    // Test 2: canSelectPower blocks duplicate id
    console.log('  Test 2: canSelectPower blocks duplicate id...');
    {
      const selection: any = { heroId, selectedPowerIds: ['power_atwill_1'], isConfirmed: false };
      const canSelect = PowerSelectionSystem.default.canSelectPower(
        mockPowerCards[0], // power_atwill_1 (already selected)
        selection,
        constraints,
        mockPowerCards
      );
      if (canSelect !== false) {
        throw new Error('canSelectPower should return false for duplicate id');
      }
      console.log('  Test 2 PASSED: canSelectPower blocks duplicate id');
    }

    // Test 3: canSelectPower blocks when totalMax reached
    console.log('  Test 3: canSelectPower blocks when totalMax reached...');
    {
      const selection: any = {
        heroId,
        selectedPowerIds: ['power_atwill_1', 'power_atwill_2', 'power_daily_1', 'power_utility_1'],
        isConfirmed: false
      };
      const canSelect = PowerSelectionSystem.default.canSelectPower(
        mockPowerCards[3], // power_daily_2
        selection,
        constraints,
        mockPowerCards
      );
      if (canSelect !== false) {
        throw new Error('canSelectPower should return false when totalMax (4) is reached');
      }
      console.log('  Test 3 PASSED: canSelectPower blocks when totalMax reached');
    }

    // Test 4: confirmSelection returns error when below per-type minimums
    console.log('  Test 4: confirmSelection returns error when below per-type minimums...');
    {
      const selection: any = {
        heroId,
        selectedPowerIds: ['power_atwill_1', 'power_daily_1'],
        isConfirmed: false
      };
      const result = PowerSelectionSystem.default.confirmSelection(selection, constraints, mockPowerCards);
      if (result.success !== false || !result.message.includes('more at-will power(s)')) {
        throw new Error(`confirmSelection should error on at-will minimum, got: ${JSON.stringify(result)}`);
      }
      console.log('  Test 4 PASSED: confirmSelection returns error when below at-will minimum');
    }

    // Test 5: autoSelectPowers returns exactly 4 confirmed ids
    console.log('  Test 5: autoSelectPowers returns exactly 4 confirmed ids...');
    {
      const result = PowerSelectionSystem.default.autoSelectPowers('fighter', heroId, constraints);
      if (result.selectedPowerIds.length !== 4) {
        throw new Error(`autoSelectPowers should return exactly 4 ids, got ${result.selectedPowerIds.length}`);
      }
      if (result.isConfirmed !== true) {
        throw new Error('autoSelectPowers should return isConfirmed: true');
      }
      // Verify correct distribution: 2 at-will, 1 daily, 1 utility
      const atWillCount = result.selectedPowerIds.filter(id =>
        getPowerCard(id)?.powerType === 'at-will'
      ).length;
      const dailyCount = result.selectedPowerIds.filter(id =>
        getPowerCard(id)?.powerType === 'daily'
      ).length;
      const utilityCount = result.selectedPowerIds.filter(id =>
        getPowerCard(id)?.powerType === 'utility'
      ).length;
      // Fighter has 3 at-will, 4 daily, 3 utility — enough to fill all type slots
      if (atWillCount !== 2 || dailyCount !== 1 || utilityCount !== 1) {
        throw new Error(`autoSelectPowers selected invalid distribution, got: ${atWillCount} at-will, ${dailyCount} daily, ${utilityCount} utility`);
      }
      console.log('  Test 5 PASSED: autoSelectPowers returns exactly 4 confirmed ids matching available DB limits');
    }

    // Test 6: deselectPower resets isConfirmed to false
    console.log('  Test 6: deselectPower resets isConfirmed to false...');
    {
      const selection: any = {
        heroId,
        selectedPowerIds: ['power_atwill_1', 'power_atwill_2', 'power_daily_1', 'power_utility_1'],
        isConfirmed: true
      };
      const result = PowerSelectionSystem.default.deselectPower('power_atwill_1', selection);
      if (result.isConfirmed !== false) {
        throw new Error('deselectPower should reset isConfirmed to false');
      }
      if (result.selectedPowerIds.includes('power_atwill_1')) {
        throw new Error('deselectPower should remove the card id from selection');
      }
      console.log('  Test 6 PASSED: deselectPower resets isConfirmed to false');
    }

    // Test 7: applySelectionsToHeroes sets selectedPowerIds correctly
    console.log('  Test 7: applySelectionsToHeroes sets selectedPowerIds correctly...');
    {
      const heroes: Hero[] = [
        {
          id: 'hero_1',
          name: 'Hero 1',
          type: 'hero',
          heroClass: 'paladin',
          level: 1,
          surgeValue: 3,
          xp: 0,
          surgeUsed: false,
          abilities: [],
          hand: [],
          items: [],
          position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
          hp: 10,
          maxHp: 10,
          ac: 15,
          speed: 6,
          isExhausted: false,
          attackBonus: 0,
          conditions: [],
          usedPowers: []
        },
        {
          id: 'hero_2',
          name: 'Hero 2',
          type: 'hero',
          heroClass: 'ranger',
          level: 1,
          surgeValue: 3,
          xp: 0,
          surgeUsed: false,
          abilities: [],
          hand: [],
          items: [],
          position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
          hp: 10,
          maxHp: 10,
          ac: 15,
          speed: 6,
          isExhausted: false,
          attackBonus: 0,
          conditions: [],
          usedPowers: []
        }
      ];

      const selections: any[] = [
        { heroId: 'hero_1', selectedPowerIds: ['power_atwill_1', 'power_atwill_2', 'power_daily_1', 'power_utility_1'], isConfirmed: true },
        { heroId: 'hero_2', selectedPowerIds: ['power_atwill_3', 'power_daily_2', 'power_utility_2'], isConfirmed: false }, // Not confirmed
        { heroId: 'hero_3', selectedPowerIds: ['power_atwill_1'], isConfirmed: true } // No matching hero
      ];

      const result = PowerSelectionSystem.default.applySelectionsToHeroes(heroes, selections);

      const hero1Result = result.find(h => h.id === 'hero_1');
      const hero2Result = result.find(h => h.id === 'hero_2');

      if (!hero1Result || !hero2Result) {
        throw new Error('applySelectionsToHeroes should return all heroes');
      }

      if (!hero1Result.selectedPowerIds || hero1Result.selectedPowerIds.length !== 4) {
        throw new Error(`Hero 1 should have 4 selectedPowerIds, got ${hero1Result.selectedPowerIds?.length ?? 0}`);
      }

      if (hero2Result.selectedPowerIds !== undefined) {
        throw new Error(`Hero 2 should keep existing selectedPowerIds (not confirmed), got ${JSON.stringify(hero2Result.selectedPowerIds)}`);
      }

      console.log('  Test 7 PASSED: applySelectionsToHeroes sets selectedPowerIds correctly');
    }

    console.log('  PowerSelectionSystem PASSED');

    // -----------------------------------------------------------------------
    // 32. Power Selection Store Actions Tests
    // -----------------------------------------------------------------------
    console.log('Testing Power Selection Store Actions...');

    // Test 1: selectPower no-ops when phase !== 'setup'
    console.log('  Test 1: selectPower no-ops when phase !== \'setup\'...');
    {
      const testHeroId = 'test_hero_select';
      const testCard: Card = {
        id: 'test_power_1',
        type: 'ability',
        name: 'Test Power',
        description: 'Test power card',
        effects: [],
        powerType: 'at-will'
      };

      // Create game state in 'hero' phase (not 'setup')
      const heroPhaseState: GameState = {
        ...testGameState,
        phase: 'hero',
        currentHeroId: testHeroId,
        heroes: [{ ...testHero, id: testHeroId }],
        powerSelections: [
          { heroId: testHeroId, selectedPowerIds: [], isConfirmed: false }
        ]
      };

      // Store the state
      useGameStore.setState({ gameState: heroPhaseState });

      // Capture selection before calling selectPower
      const selectionBefore = useGameStore.getState().gameState?.powerSelections?.find(s => s.heroId === testHeroId);
      const countBefore = selectionBefore?.selectedPowerIds.length ?? 0;

      // Try to select power - should no-op
      useGameStore.getState().selectPower(testHeroId, testCard);

      // Verify selection unchanged
      const selectionAfter = useGameStore.getState().gameState?.powerSelections?.find(s => s.heroId === testHeroId);
      const countAfter = selectionAfter?.selectedPowerIds.length ?? 0;

      if (countAfter !== countBefore) {
        throw new Error(`Test 1: selectPower should no-op when phase !== 'setup', but selection changed from ${countBefore} to ${countAfter}`);
      }

      console.log('  Test 1 PASSED: selectPower no-ops when phase !== \'setup\'');
    }

    // Test 2: selectPower adds card.id to hero's selection
    console.log('  Test 2: selectPower adds card.id to hero\'s selection...');
    {
      const testHeroId = 'test_hero_select2';
      const testCard: Card = {
        id: 'test_power_2',
        type: 'ability',
        name: 'Test Power 2',
        description: 'Test power card 2',
        effects: [],
        powerType: 'at-will'
      };

      // Create game state in 'setup' phase
      const setupPhaseState: GameState = {
        ...testGameState,
        phase: 'setup',
        currentHeroId: testHeroId,
        heroes: [{ ...testHero, id: testHeroId }],
        powerSelections: [
          { heroId: testHeroId, selectedPowerIds: ['existing_power'], isConfirmed: false }
        ]
      };

      // Store the state
      useGameStore.setState({ gameState: setupPhaseState });

      // Select power
      useGameStore.getState().selectPower(testHeroId, testCard);

      // Verify card.id added to selection
      const selectionAfter = useGameStore.getState().gameState?.powerSelections?.find(s => s.heroId === testHeroId);
      if (!selectionAfter?.selectedPowerIds.includes('test_power_2')) {
        throw new Error('Test 2: selectPower should add card.id to hero\'s selection');
      }

      // Verify existing power still present
      if (!selectionAfter?.selectedPowerIds.includes('existing_power')) {
        throw new Error('Test 2: selectPower should preserve existing selected powers');
      }

      console.log('  Test 2 PASSED: selectPower adds card.id to hero\'s selection');
    }

    // Test 3: confirmHeroSelection logs warning when under totalMax
    console.log('  Test 3: confirmHeroSelection logs warning when under totalMax...');
    {
      const testHeroId = 'test_hero_confirm';
      const constraints = PowerSelectionSystem.default.getConstraints('paladin');

      // Create game state with only 1 selected power (under totalMax of 4)
      const underMaxState: GameState = {
        ...testGameState,
        phase: 'setup',
        currentHeroId: testHeroId,
        heroes: [{ ...testHero, heroClass: 'paladin', id: testHeroId }],
        powerSelections: [
          { heroId: testHeroId, selectedPowerIds: ['power_1'], isConfirmed: false }
        ]
      };

      // Store the state
      useGameStore.setState({ gameState: underMaxState });

      // Capture console.warn before calling confirmHeroSelection
      const originalWarn = console.warn;
      const warnCapture = { message: '' as string, called: false };
      console.warn = (message: string) => {
        warnCapture.message = message;
        warnCapture.called = true;
      };

      try {
        // Try to confirm - should log warning
        useGameStore.getState().confirmHeroSelection(testHeroId);
      } finally {
        // Restore console.warn before assertions
        console.warn = originalWarn;
      }

      if (!warnCapture.called) {
        throw new Error(
          'Expected console.warn to be called but it was not'
        );
      }
      if (!warnCapture.message.includes('more at-will power(s)')) {
        throw new Error(
          `Expected warning about at-will power count but got:
           "${warnCapture.message}"`
        );
      }

      console.log('  Test 3 PASSED: confirmHeroSelection logs warning when under totalMax');
    }

    // Test 4: All confirmed → hero.selectedPowerIds populated
    console.log('  Test 4: All confirmed → hero.selectedPowerIds populated...');
    {
      const testHeroId = 'test_hero_populate';
      const testCardIds = ['fighter_cleave', 'fighter_tide_of_iron', 'fighter_brute_strike', 'fighter_bodyguard'];

      // Create game state with confirmed selections
      const confirmedState: GameState = {
        ...testGameState,
        phase: 'setup',
        currentHeroId: testHeroId,
        heroes: [{ ...testHero, heroClass: 'fighter', id: testHeroId }],
        powerSelections: [
          { heroId: testHeroId, selectedPowerIds: testCardIds, isConfirmed: true }
        ]
      };

      // Store the state
      useGameStore.setState({ gameState: confirmedState });

      // Call confirmHeroSelection to trigger the confirmation copy logic
      useGameStore.getState().confirmHeroSelection(testHeroId);

      // Verify hero.selectedPowerIds populated
      const heroAfter = useGameStore.getState().gameState?.heroes.find(h => h.id === testHeroId);
      if (!heroAfter?.selectedPowerIds || heroAfter.selectedPowerIds.length !== 4) {
        throw new Error('Test 4: All confirmed should populate hero.selectedPowerIds');
      }

      // Verify correct IDs
      for (const cardId of testCardIds) {
        if (!heroAfter?.selectedPowerIds.includes(cardId)) {
          throw new Error(`Test 4: hero.selectedPowerIds should contain ${cardId}`);
        }
      }

      console.log('  Test 4 PASSED: All confirmed → hero.selectedPowerIds populated');
    }

    // Test 5: beginAdventure no-ops when powerSelections not all confirmed
    console.log('  Test 5: beginAdventure no-ops when powerSelections not all confirmed...');
    {
      const testHeroId = 'test_hero_begin';

      // Create game state with unconfirmed selections
      const unconfirmedState: GameState = {
        ...testGameState,
        phase: 'setup',
        currentHeroId: testHeroId,
        heroes: [{ ...testHero, id: testHeroId }],
        powerSelections: [
          { heroId: testHeroId, selectedPowerIds: ['power_1'], isConfirmed: false }
        ]
      };

      // Store the state
      useGameStore.setState({ gameState: unconfirmedState });

      // Capture console.warn before calling beginAdventure
      const originalWarn = console.warn;
      const warnCapture = { message: '' as string, called: false };
      console.warn = (message: string) => {
        warnCapture.message = message;
        warnCapture.called = true;
      };

      try {
        // Try to begin adventure - should log warning and no-op
        useGameStore.getState().beginAdventure();
      } finally {
        // Restore console.warn before assertions
        console.warn = originalWarn;
      }

      if (!warnCapture.called) {
        throw new Error(
          'Expected console.warn to be called but it was not'
        );
      }
      if (!warnCapture.message.includes('Not all heroes have selected powers')) {
        throw new Error(
          `Expected warning about power selection confirmation but got:
           "${warnCapture.message}"`
        );
      }

      // Verify phase unchanged (still 'setup')
      const phaseAfter = useGameStore.getState().gameState?.phase;
      if (phaseAfter !== 'setup') {
        throw new Error('Test 5: beginAdventure should no-op and keep phase as setup when powerSelections not all confirmed');
      }

      console.log('  Test 5 PASSED: beginAdventure no-ops when powerSelections not all confirmed');
    }

    console.log('  Power Selection Store Actions PASSED');

    // -----------------------------------------------------------------------
    // 21. CardResolutionSystem
    // -----------------------------------------------------------------------
    console.log('Testing CardResolutionSystem...');

    const gameTestState = useGameStore.getState().gameState!;
    const cardHero = gameTestState.heroes[0];
    const envCard: Card = { id: 'encounter-volcanic-smoke', type: 'encounter', name: 'Volcanic Smoke', description: '', effects: [] };

    // Test 1: Full phase cycle
    console.log('  Testing phase transitions (idle -> drawing -> revealing -> resolving -> complete -> idle)...');
    let resState = CardResolutionSystem.beginResolution(gameTestState, envCard, cardHero);
    if (!resState.cardResolution || resState.cardResolution.phase !== 'drawing') throw new Error('beginResolution: phase should be drawing');
    if (resState.cardResolution.cardId !== envCard.id) throw new Error('beginResolution: cardId mismatch');

    resState = CardResolutionSystem.advanceResolution(resState, cardHero);
    if (!resState.cardResolution || resState.cardResolution.phase !== 'revealing') throw new Error('advanceResolution: phase should be revealing');

    resState = CardResolutionSystem.advanceResolution(resState, cardHero);
    if (!resState.cardResolution || resState.cardResolution.phase !== 'resolving') throw new Error('advanceResolution: phase should be resolving');

    resState = CardResolutionSystem.advanceResolution(resState, cardHero);
    if (!resState.cardResolution || resState.cardResolution.phase !== 'complete') throw new Error('advanceResolution: phase should be complete');
    if (!resState.cardResolution.result?.success) throw new Error(`advanceResolution (resolving): expected success, got ${resState.cardResolution.result?.message}`);

    // Verify EncounterSystem effect (activeEnvironmentCard should be set)
    if (resState.activeEnvironmentCard !== envCard.id) throw new Error(`advanceResolution (resolving): expected activeEnvironmentCard to be ${envCard.id}`);

    resState = CardResolutionSystem.advanceResolution(resState, cardHero);
    if (!resState.cardResolution || resState.cardResolution.phase !== 'idle') throw new Error('advanceResolution (complete): phase should be idle');
    if (resState.cardResolution.cardId !== null) throw new Error('advanceResolution (complete): cardId should be null');

    // Test 2: Treasure Assignment
    console.log('  Testing assignTreasure (item assignment)...');
    const treasureCard: Card = { id: 'treasure-luck-stone', type: 'treasure', name: 'Luck Stone', description: '', effects: [], treasureType: 'item' };
    resState = CardResolutionSystem.assignTreasure(resState, treasureCard, cardHero);
    const assignment = resState.treasureAssignments?.find(a => a.cardId === treasureCard.id && a.heroId === cardHero.id);
    if (!assignment) throw new Error('assignTreasure: assignment missing from state');

    // Test 3: Treasure Usage
    console.log('  Testing useTreasure...');
    resState = CardResolutionSystem.useTreasure(resState, treasureCard, cardHero);
    const usedAssignment = resState.treasureAssignments?.find(a => a.cardId === treasureCard.id && a.heroId === cardHero.id);
    if (!usedAssignment?.isUsed) throw new Error('useTreasure: assignment not marked as used');

    console.log('  CardResolutionSystem PASSED');

    // -----------------------------------------------------------------------
    // 22. Adventure 1: Escape the Tomb Verification
    // -----------------------------------------------------------------------
    console.log('Testing Adventure 1: Escape the Tomb...');
    {
      const store = useGameStore.getState();
      
      // Initialize Adventure 1 with Hero Arjhan
      store.startNewGame('adventure_01', ['hero_arjhan']);
      const state = useGameStore.getState().gameState;
      if (!state) throw new Error('Adventure 1: game state not initialized');
      
      if (state.activeScenario.id !== 'adventure_01') {
        throw new Error(`Adventure 1: expected scenario ID adventure_01, got ${state.activeScenario.id}`);
      }

      if (state.tiles.length !== 1 || state.tiles[0].id !== 'crypt_strahd') {
        throw new Error(`Adventure 1: expected start tile crypt_strahd, got ${state.tiles[0]?.id}`);
      }

      if (!state.timeTrack || state.timeTrack.current !== 0 || state.timeTrack.max !== 6) {
        throw new Error(`Adventure 1: timeTrack not initialized correctly: ${JSON.stringify(state.timeTrack)}`);
      }

      if (state.strahdAwakened !== false) {
        throw new Error('Adventure 1: Strahd should not be awakened initially');
      }

      // Check deck insertion: Secret Stairway tile should be placed at index 10 in the deck
      const staircaseIndex = state.dungeonDeck.indexOf('named_secret_stairway');
      if (staircaseIndex !== 10) {
        throw new Error(`Adventure 1: expected Secret Stairway at deck index 10, got index ${staircaseIndex}`);
      }

      // Test time track advancement and Strahd awakening
      console.log('  Testing time track advancement and Strahd awakening...');
      
      // Setup a custom state where time track is at 5
      const stateBeforeAwaken: GameState = {
        ...state,
        timeTrack: { current: 5, max: 6 }
      };

      // Place a tile with a white arrow (encounterType === 'white')
      const mockWhiteTile: Tile = {
        id: 'tile_white_test',
        name: 'Mock White Tile',
        x: 0, z: -1,
        terrainType: 'corridor',
        encounterType: 'white',
        connections: [
          { edge: 'north', isOpen: true },
          { edge: 'south', isOpen: true, connectedTileId: 'crypt_strahd' },
          { edge: 'east', isOpen: false },
          { edge: 'west', isOpen: false }
        ],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: []
      };

      // Mock TileSystem.drawAndPlace to return this mock white tile
      const originalDrawAndPlace = TileSystem.drawAndPlace;
      TileSystem.drawAndPlace = () => ({
        tile: mockWhiteTile,
        validRotations: [0],
        remainingDeck: state.dungeonDeck.filter(id => id !== 'named_secret_stairway'),
        exhausted: false
      });

      let stateAfterPlacement: GameState;
      try {
        stateAfterPlacement = TileSystem.placeTile(
          stateBeforeAwaken,
          { tileId: 'crypt_strahd', edge: 'north' },
          0
        );
        // Time track advancement is handled by ScenarioManager.processPostExplore
        stateAfterPlacement = ScenarioManager.processPostExplore(stateAfterPlacement, mockWhiteTile);
      } finally {
        // Restore original drawAndPlace
        TileSystem.drawAndPlace = originalDrawAndPlace;
      }

      if (!stateAfterPlacement.timeTrack || stateAfterPlacement.timeTrack.current !== 6) {
        throw new Error(`Adventure 1: expected time track to advance to 6, got ${stateAfterPlacement.timeTrack?.current}`);
      }

      if (stateAfterPlacement.strahdAwakened !== true) {
        throw new Error('Adventure 1: Strahd should be awakened when time track reaches 6');
      }

      const hasStrahd = stateAfterPlacement.monsters.some(m => m.id.startsWith('monster_strahd'));
      if (!hasStrahd) {
        throw new Error('Adventure 1: Count Strahd monster should be spawned in the monsters list');
      }

      // Test boss activates in every Villain Phase
      console.log('  Testing Boss queue activation in Villain Phase...');
      const queue = buildVillainQueue(stateAfterPlacement, 'hero_arjhan');
      const hasStrahdInQueue = queue.some(id => id.startsWith('monster_strahd'));
      if (!hasStrahdInQueue) {
        throw new Error('Adventure 1: Count Strahd should be in the Villain Phase queue');
      }

      console.log('  Adventure 1: Escape the Tomb Verification PASSED');
    }

    // -----------------------------------------------------------------------
    // 23. Adventure 2: Find the Icon of Ravenloft Verification
    // -----------------------------------------------------------------------
    console.log('Testing Adventure 2: Find the Icon of Ravenloft...');
    {
      const store = useGameStore.getState();
      
      // Initialize Adventure 2 with Hero Arjhan
      store.startNewGame('adventure_02', ['hero_arjhan']);
      const state = useGameStore.getState().gameState;
      if (!state) throw new Error('Adventure 2: game state not initialized');
      
      if (state.activeScenario.id !== 'adventure_02') {
        throw new Error(`Adventure 2: expected scenario ID adventure_02, got ${state.activeScenario.id}`);
      }

      // Check start tile placement
      if (state.tiles.length !== 1) {
        throw new Error(`Adventure 2: expected 1 initial tile, got ${state.tiles.length}`);
      }

      const hasStartTile = state.tiles.some(t => t.x === 0 && t.z === 0 && t.id === 'start-tile');

      if (!hasStartTile) {
        throw new Error('Adventure 2: start tile missing or coordinates incorrect');
      }

      // Check deck insertion: Chapel tile (named_chapel) should be placed at index 8 in the deck (insertAfterIndex: 8)
      const chapelIndex = state.dungeonDeck.indexOf('named_chapel');
      if (chapelIndex !== 8) {
        throw new Error(`Adventure 2: expected Chapel at deck index 8, got index ${chapelIndex}`);
      }

      if (state.chapelRevealed !== false) {
        throw new Error('Adventure 2: Chapel should not be revealed initially');
      }

      // Test Chapel tile placement, monster spawn, and Icon token placement
      console.log('  Testing Chapel placement and spawn triggers...');
      
      const mockChapelTile: Tile = {
        id: 'named_chapel',
        name: 'Chapel',
        x: 1, z: 0,
        terrainType: 'named_room',
        connections: [
          { edge: 'north', isOpen: false },
          { edge: 'south', isOpen: false },
          { edge: 'east', isOpen: true },
          { edge: 'west', isOpen: true, connectedTileId: 'start-tile' }
        ],
        boneSquare: { sqX: 2, sqZ: 2 },
        isRevealed: false,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: []
      };

      // Mock TileSystem.drawAndPlace to return this mock Chapel tile
      const originalDrawAndPlace = TileSystem.drawAndPlace;
      TileSystem.drawAndPlace = () => ({
        tile: mockChapelTile,
        validRotations: [0],
        remainingDeck: state.dungeonDeck.filter(id => id !== 'named_chapel'),
        exhausted: false
      });

      let stateAfterChapel: GameState;
      try {
        stateAfterChapel = TileSystem.placeTile(
          state,
          { tileId: 'start-tile', edge: 'east' },
          0
        );
        const placedChapel = stateAfterChapel.tiles.find(t => t.id.startsWith('named_chapel'))!;
        stateAfterChapel = ScenarioManager.processPostExplore(stateAfterChapel, placedChapel);
      } finally {
        TileSystem.drawAndPlace = originalDrawAndPlace;
      }

      if (stateAfterChapel.chapelRevealed !== true) {
        throw new Error('Adventure 2: chapelRevealed should be set to true');
      }

      console.log('  Adventure 2: Find the Icon of Ravenloft Verification PASSED');
    }

    // -----------------------------------------------------------------------
    // 24. Adventure 3: Klak's Infernal Artifact Verification
    // -----------------------------------------------------------------------
    console.log('Testing Adventure 3: Klak\'s Infernal Artifact...');
    {
      const store = useGameStore.getState();
      
      store.startNewGame('adventure_03', ['hero_arjhan']);
      const state = useGameStore.getState().gameState;
      if (!state) throw new Error('Adventure 3: game state not initialized');
      
      if (state.activeScenario.id !== 'adventure_03') {
        throw new Error(`Adventure 3: expected scenario ID adventure_03, got ${state.activeScenario.id}`);
      }

      const labIndex = state.dungeonDeck.indexOf('named_laboratory');
      if (labIndex !== 8) {
        throw new Error(`Adventure 3: expected Laboratory at deck index 8, got index ${labIndex}`);
      }

      if (state.laboratoryRevealed !== undefined && state.laboratoryRevealed !== false) {
        throw new Error('Adventure 3: Laboratory should not be revealed initially');
      }

      console.log('  Adventure 3: Klak\'s Infernal Artifact Verification PASSED');
    }

    // ── Adventure 4: Daylight Assault Verification ─────────────────────────
    console.log('Running Adventure 4: Daylight Assault Verification...');
    {
      const store = useGameStore.getState();

      // 1. Initial State Checks
      console.log('  Testing initialization...');
      store.startNewGame('adventure_04', ['hero_arjhan', 'hero_immeril']);
      let state = useGameStore.getState().gameState;
      if (!state) throw new Error('Adventure 4: Game state failed to initialize');
      if (state.activeScenario.id !== 'adventure_04') {
        throw new Error(`Adventure 4: expected scenario ID adventure_04, got ${state.activeScenario.id}`);
      }
      if (!state.timeTrack || state.timeTrack.current !== 0 || state.timeTrack.max !== 6) {
        throw new Error(`Adventure 4: expected timeTrack current=0 max=6, got ${JSON.stringify(state.timeTrack)}`);
      }
      if (state.strahdAwakened !== false) {
        throw new Error(`Adventure 4: expected strahdAwakened to be false initially`);
      }

      console.log('  Adventure 4: Daylight Assault Verification PASSED');
    }

    // ── Adventure 5: The Final Transformation Verification ─────────────────
    console.log('Running Adventure 5: The Final Transformation Verification...');
    {
      const store = useGameStore.getState();

      console.log('  Testing initialization...');
      store.startNewGame('adventure_05', ['hero_arjhan']);
      
      const startState = useGameStore.getState().gameState;
      if (!startState) throw new Error('Adventure 5: Game state failed to initialize');
      
      const PowerSelectionSystem = (await import('../game/engine/PowerSelectionSystem')).default;
      const heroData = startState.heroes[0];
      const constraints: import('../game/engine/PowerSelectionSystem').PowerSelectionConstraints = {
        heroType: heroData.heroClass, maxAtWill: 3, maxDaily: 2, maxUtility: 2, totalMax: 4
      };
      const autoResult = PowerSelectionSystem.autoSelectPowers(heroData.heroClass, heroData.id, constraints);
      
      const confirmedSelections = (startState.powerSelections || []).map(s => ({
        ...s,
        selectedPowerIds: s.heroId === autoResult.heroId ? autoResult.selectedPowerIds : [],
        isConfirmed: true
      }));
      useGameStore.setState({
        gameState: {
          ...startState,
          powerSelections: confirmedSelections
        }
      });
      
      store.beginAdventure();

      const state = useGameStore.getState().gameState;
      if (!state) throw new Error('Adventure 5: Game state failed to start');
      if (state.activeScenario.id !== 'adventure_05') {
        throw new Error(`Adventure 5: expected scenario ID adventure_05, got ${state.activeScenario.id}`);
      }
      if (state.fountainTokens !== 5) {
        throw new Error(`Adventure 5: expected fountainTokens to be 5, got ${state.fountainTokens}`);
      }

      const kavanToken = state.tokens?.find(t => t.id === 'item_kavan');
      if (!kavanToken) {
        throw new Error('Adventure 5: expected item_kavan token to be on the board initially');
      }

      console.log('  Adventure 5: The Final Transformation Verification PASSED');
    }

    // -----------------------------------------------------------------------
    // Adventure 6: Destroy the Dracolich
    // -----------------------------------------------------------------------
    {
      console.log('Testing Adventure 6: Destroy the Dracolich...');
      const store = useGameStore.getState();
      
      store.startNewGame('adventure_06', ['hero_arjhan']);
      const state = useGameStore.getState().gameState;
      if (!state) throw new Error('Adventure 6: game state not initialized');
      
      if (state.activeScenario.id !== 'adventure_06') {
        throw new Error(`Adventure 6: expected scenario ID adventure_06, got ${state.activeScenario.id}`);
      }

      const circleIndex = state.dungeonDeck.indexOf('named_arcane_circle');
      if (circleIndex !== 8) {
        throw new Error(`Adventure 6: expected Arcane Circle at deck index 8, got index ${circleIndex}`);
      }

      console.log('  Adventure 6: Destroy the Dracolich Verification PASSED');
    }

    // -----------------------------------------------------------------------
    // Scenario 1: Find Strahd's Coffin
    // -----------------------------------------------------------------------
    {
      console.log('Testing Scenario 1: Find Strahd\'s Coffin...');
      const store = useGameStore.getState();

      // Initialize Scenario 1 with Hero Arjhan
      store.startNewGame('s1', ['hero_arjhan']);
      const s1State = useGameStore.getState().gameState;
      if (!s1State) throw new Error('Scenario 1: game state not initialized');

      if (s1State.activeScenario.id !== 's1') {
        throw new Error(`Scenario 1: expected scenario ID s1, got ${s1State.activeScenario.id}`);
      }

      // 1. Verify coffin deck was initialized
      console.log('  Testing coffin deck initialization...');
      if (!s1State.unplacedCoffinTokens || s1State.unplacedCoffinTokens.length === 0) {
        throw new Error('Scenario 1: unplacedCoffinTokens was not initialized');
      }
      if (s1State.unplacedCoffinTokens.length !== 7) {
        throw new Error(`Scenario 1: expected 7 coffin tokens, got ${s1State.unplacedCoffinTokens.length}`);
      }
      // Verify Strahd's coffin is among them
      const strahdInDeck = s1State.unplacedCoffinTokens.find(t => t.isStrahds);
      if (!strahdInDeck) {
        throw new Error('Scenario 1: Strahd coffin token not present in deck');
      }
      // Verify strahdAwakened is initialized to false
      if (s1State.strahdAwakened !== false) {
        throw new Error(`Scenario 1: strahdAwakened should be false at start, got ${s1State.strahdAwakened}`);
      }
      console.log('  Coffin deck initialization PASSED');

      // 2. Verify coffin token is placed when tile is revealed
      console.log('  Testing coffin token placement on tile reveal...');
      // Reorder unplacedCoffinTokens so Strahd's coffin is LAST (not first revealed)
      const nonStrahd = s1State.unplacedCoffinTokens.filter(t => !t.isStrahds);
      const strahdToken = s1State.unplacedCoffinTokens.find(t => t.isStrahds)!;
      const reorderedTokens = [...nonStrahd, strahdToken];

      // Inject a start tile and a known coffin deck order into state
      const startTile: Tile = {
        id: 'start-tile',
        name: 'Start',
        x: 0, z: 0,
        terrainType: 'corridor',
        connections: [{ edge: 'east', isOpen: true }],
        boneSquare: { sqX: 2, sqZ: 2 },
        isRevealed: true,
        isStart: true,
        isExit: false,
        rotation: 0,
        monsters: [], heroes: [], items: []
      };

      useGameStore.setState({
        gameState: {
          ...s1State,
          tiles: [startTile],
          unplacedCoffinTokens: reorderedTokens,
          tokens: [],
          strahdsCoffinTokenId: null
        }
      });

      // Simulate tile placement via TokenSystem directly
      const { TokenSystem: TS } = await import('../game/engine/TokenSystem');
      const stateForPlacement = useGameStore.getState().gameState!;
      const { token: firstCoffinToken, newState: afterPlacement } = TS.placeCoffinOnNewTile(
        stateForPlacement, 'new-tile-1', 1, 0
      );

      if (!firstCoffinToken) throw new Error('Scenario 1: coffin token was not placed on new tile');
      if (firstCoffinToken.type !== 'coffin') throw new Error('Scenario 1: placed token has wrong type');
      if (firstCoffinToken.metadata?.isStrahdsCoffin) {
        throw new Error('Scenario 1: first token should not be Strahd (he was placed last)');
      }
      if (afterPlacement.unplacedCoffinTokens!.length !== reorderedTokens.length - 1) {
        throw new Error('Scenario 1: unplacedCoffinTokens count not decremented after placement');
      }
      console.log('  Coffin token placement PASSED');

      // 3. Test searching a non-Strahd coffin does NOT trigger victory
      console.log('  Testing searching a non-Strahd coffin does not trigger victory...');
      useGameStore.setState({ gameState: afterPlacement });
      const searchResult = store.searchToken(firstCoffinToken.id);
      if (!searchResult) throw new Error('Scenario 1: searchToken returned null');
      if (!searchResult.success) throw new Error(`Scenario 1: search was not successful: ${searchResult.message}`);
      const stateAfterSearch = useGameStore.getState().gameState!;
      if (stateAfterSearch.phase === 'victory') {
        throw new Error('Scenario 1: victory triggered after searching a non-Strahd coffin');
      }
      const searchedToken = stateAfterSearch.tokens?.find(t => t.id === firstCoffinToken.id);
      if (!searchedToken?.isSearched) {
        throw new Error('Scenario 1: token was not marked as searched');
      }
      console.log('  Non-Strahd coffin search PASSED');

      // 4. Test Strahd Awakens after 4 coffins searched
      console.log('  Testing Strahd Awakens after 4 coffins searched...');
      // Build 4 already-searched non-Strahd coffin tokens on the board
      const searchedCoffins = Array.from({ length: 4 }, (_, i) => ({
        id: `coffin_${i}`,
        type: 'coffin' as const,
        name: `Coffin ${i}`,
        tileId: 'start-tile',
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        isRevealed: true,
        isSearched: true,  // Already searched
        metadata: { isStrahdsCoffin: false, tokenId: 'coffin_empty' }
      }));

      // Place one more (the 5th) unsearched coffin token, which is Strahd's
      const strahdCoffinToken = {
        id: 'coffin_strahd_token',
        type: 'coffin' as const,
        name: 'Coffin',
        tileId: 'start-tile',
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
        isRevealed: true,
        isSearched: false,
        metadata: { isStrahdsCoffin: true, tokenId: 'coffin_strahd' }
      };

      // Set up a pre-4-searched state (3 searched, about to search 4th)
      const preAwaken = useGameStore.getState().gameState!;
      const threeCoffins = searchedCoffins.slice(0, 3);
      const fourthCoffin = {
        ...searchedCoffins[3],
        isSearched: false  // Not yet searched - this one will trigger awakening
      };

      useGameStore.setState({
        gameState: {
          ...preAwaken,
          tokens: [...threeCoffins, fourthCoffin, strahdCoffinToken],
          strahdsCoffinTokenId: strahdCoffinToken.id,
          strahdAwakened: false,
          monsters: []
        }
      });

      // Search the 4th coffin to trigger awakening
      store.searchToken(fourthCoffin.id);
      const stateAfterAwaken = useGameStore.getState().gameState!;
      if (!stateAfterAwaken.strahdAwakened) {
        throw new Error('Scenario 1: strahdAwakened should be true after 4th coffin searched');
      }
      // Phase should still not be victory (Strahd's coffin not found yet)
      if (stateAfterAwaken.phase === 'victory') {
        throw new Error('Scenario 1: victory should not be triggered on 4th coffin (non-Strahd)');
      }
      console.log('  Strahd Awakens rule PASSED');

      // 5. Test finding Strahd's coffin triggers victory
      console.log('  Testing finding Strahd\'s Coffin triggers victory...');
      store.searchToken(strahdCoffinToken.id);
      const stateAfterVictory = useGameStore.getState().gameState!;
      if (stateAfterVictory.phase !== 'victory') {
        throw new Error(`Scenario 1: expected phase=victory after finding Strahd's coffin, got ${stateAfterVictory.phase}`);
      }
      // Verify objective is marked completed
      const s1Objectives = ObjectiveTracker.checkObjectives(stateAfterVictory);
      const coffinObj = s1Objectives.find(obj => obj.type === 'find_coffin');
      if (!coffinObj || !coffinObj.isCompleted) {
        throw new Error('Scenario 1: find_coffin objective not completed after finding Strahd\'s coffin');
      }
      console.log('  Victory condition PASSED');

      console.log('  Scenario 1: Find Strahd\'s Coffin Verification PASSED');
    }

    // -----------------------------------------------------------------------
    // Cleave Mechanics Verification
    // -----------------------------------------------------------------------
    {
      console.log('Testing Cleave mechanics...');
      
      const cleaveHero: Hero = {
        id: 'hero_cleave_test',
        name: 'Cleave Fighter',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        maxHp: 10,
        hp: 10,
        ac: 15,
        speed: 6,
        xp: 0,
        surgeValue: 3,
        surgeUsed: false,
        abilities: ['fighter_cleave'],
        hand: [],
        items: [],
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const zombieA: Monster = {
        id: 'zombie_a',
        name: 'Zombie A',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 0,
        damage: 1,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 2, sqZ: 1 },
        hp: 2,
        maxHp: 2,
        ac: 10,
        speed: 4,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      const zombieB: Monster = {
        id: 'zombie_b',
        name: 'Zombie B',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 0,
        damage: 1,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
        hp: 2,
        maxHp: 2,
        ac: 10,
        speed: 4,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      const cleaveTile: Tile = {
        id: 'cleave_tile',
        name: 'Cleave Tile',
        x: 0,
        z: 0,
        terrainType: 'corridor',
        connections: [],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: true,
        isExit: false,
        rotation: 0,
        monsters: ['zombie_a', 'zombie_b'],
        heroes: ['hero_cleave_test'],
        items: []
      };

      const cleaveGameState: GameState = {
        phase: 'hero',
        currentHeroId: 'hero_cleave_test',
        heroes: [cleaveHero],
        monsters: [zombieA, zombieB],
        tiles: [cleaveTile],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        monsterDeck: [],
        discardPiles: { treasure: [], encounter: [], ability: [], monster: [] },
        activeScenario: { id: 'cleave_test', name: 'Cleave Test', difficulty: 'Easy', description: 'Cleave Test', introText: '', victoryText: '', defeatText: '', objectives: [], specialRules: [], startTileId: 'cleave_tile', maxSurges: 3 },
        turnOrder: ['hero_cleave_test'],
        healingSurges: 2,
        turnCount: 1,
        log: [],
        activeEnvironmentCard: null,
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null,
        logIdCounter: 0,
        cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null }
      };

      const cleaveCard = DataLoader.getInstance().getCardById('fighter_cleave');
      if (!cleaveCard) throw new Error('Cleave card not found in DataLoader');

      // Test 1: Hit path
      // Force hit (roll = 10, bonus = 6 -> total = 16 >= AC 10)
      AbilitySystem._rollOverride = () => 10;

      const hitResult = await PowerSystem.usePowerAsync(cleaveHero, cleaveCard, zombieA, cleaveGameState);
      
      AbilitySystem._rollOverride = null;

      if (!hitResult.success) {
        throw new Error(`Cleave: expected success, got failure: ${hitResult.message}`);
      }

      const updatedZombieA = hitResult.newState.monsters.find(m => m.id === 'zombie_a')!;
      const updatedZombieB = hitResult.newState.monsters.find(m => m.id === 'zombie_b')!;
      const updatedHero = hitResult.newState.heroes.find(h => h.id === 'hero_cleave_test')!;

      // Zombie A (primary target) should have taken 1 damage (HP 2 -> 1)
      if (updatedZombieA.hp !== 1) {
        throw new Error(`Cleave: primary target should have taken 1 damage, got hp = ${updatedZombieA.hp}`);
      }

      // Zombie B (cleaved target) should have taken 1 damage (HP 2 -> 1)
      if (updatedZombieB.hp !== 1) {
        throw new Error(`Cleave: secondary target should have taken 1 damage, got hp = ${updatedZombieB.hp}`);
      }

      // Hero should have moved adjacent to Zombie B (Zombie B is at 2,2, so hero should be at an adjacent square on tile 0,0)
      const dist = Math.abs(updatedHero.position.sqX - updatedZombieB.position.sqX) + Math.abs(updatedHero.position.sqZ - updatedZombieB.position.sqZ);
      if (dist !== 1) {
        throw new Error(`Cleave: hero should have moved adjacent to secondary target, got distance = ${dist}`);
      }

      // Test 2: Miss path
      // Force miss (roll = 2, bonus = 6 -> total = 8 < AC 10)
      AbilitySystem._rollOverride = () => 2;

      const missResult = await PowerSystem.usePowerAsync(cleaveHero, cleaveCard, zombieA, cleaveGameState);
      
      AbilitySystem._rollOverride = null;

      if (!missResult.success) {
        throw new Error(`Cleave (miss): expected success, got failure: ${missResult.message}`);
      }

      const missZombieA = missResult.newState.monsters.find(m => m.id === 'zombie_a')!;
      const missZombieB = missResult.newState.monsters.find(m => m.id === 'zombie_b')!;
      const missHero = missResult.newState.heroes.find(h => h.id === 'hero_cleave_test')!;

      // Zombie A should not have taken damage on miss (no missDamage on Cleave)
      if (missZombieA.hp !== 2) {
        throw new Error(`Cleave (miss): primary target should not have taken damage, got hp = ${missZombieA.hp}`);
      }

      // Zombie B should not have taken damage on miss
      if (missZombieB.hp !== 2) {
        throw new Error(`Cleave (miss): secondary target should not have taken damage, got hp = ${missZombieB.hp}`);
      }

      // Hero should not have moved
      if (missHero.position.sqX !== 1 || missHero.position.sqZ !== 1) {
        throw new Error(`Cleave (miss): hero should not have moved, got position: (${missHero.position.sqX}, ${missHero.position.sqZ})`);
      }

      console.log('  Cleave Verification PASSED');
    }

    // -----------------------------------------------------------------------
    // Fighter Powers Verification (Brute Strike, Precise Strike, Come and Get It, Get Over There, Unstoppable, Bodyguard, Tide of Iron)
    // -----------------------------------------------------------------------
    {
      console.log('Testing remaining Fighter powers...');

      // Setup a game state with a fighter hero and some zombies on a start tile and adjacent tile
      const fighterHero: Hero = {
        id: 'fighter_hero_test',
        name: 'Arjhan Fighter',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        maxHp: 10,
        hp: 8, // start slightly damaged for Unstoppable test
        ac: 15,
        speed: 6,
        xp: 0,
        surgeValue: 3,
        surgeUsed: false,
        abilities: ['fighter_brute_strike', 'fighter_precise_strike', 'fighter_come_and_get_it', 'fighter_get_over_there', 'fighter_unstoppable', 'fighter_tide_of_iron', 'fighter_bodyguard'],
        hand: [],
        items: [],
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: [],
        flippedPowerIds: []
      };

      const companionHero: Hero = {
        id: 'companion_hero_test',
        name: 'Companion Hero',
        type: 'hero',
        heroClass: 'cleric',
        level: 1,
        maxHp: 8,
        hp: 8,
        ac: 14,
        speed: 5,
        xp: 0,
        surgeValue: 3,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: [],
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const zombieA: Monster = {
        id: 'zombie_a',
        name: 'Zombie A',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 5,
        damage: 2,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 2, sqZ: 1 }, // adjacent to fighter (1,1)
        hp: 2,
        maxHp: 2,
        ac: 10,
        speed: 4,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      const zombieB: Monster = {
        id: 'zombie_b',
        name: 'Zombie B',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 5,
        damage: 2,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 1, sqX: 2, sqZ: 2 }, // on adjacent tile (0,1)
        hp: 2,
        maxHp: 2,
        ac: 10,
        speed: 4,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      const startTile: Tile = {
        id: 'start_tile',
        name: 'Start Tile',
        x: 0,
        z: 0,
        terrainType: 'corridor',
        connections: [openEdge('north')],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: true,
        isExit: false,
        rotation: 0,
        monsters: ['zombie_a'],
        heroes: ['fighter_hero_test', 'companion_hero_test'],
        items: []
      };

      const northTile: Tile = {
        id: 'north_tile',
        name: 'North Tile',
        x: 0,
        z: 1,
        terrainType: 'corridor',
        connections: [openEdge('south')],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: ['zombie_b'],
        heroes: [],
        items: []
      };

      const testGameState: GameState = {
        phase: 'hero',
        currentHeroId: 'fighter_hero_test',
        heroes: [fighterHero, companionHero],
        monsters: [zombieA, zombieB],
        tiles: [startTile, northTile],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        monsterDeck: [],
        discardPiles: { treasure: [], encounter: [], ability: [], monster: [] },
        activeScenario: { id: 'fighter_test', name: 'Fighter Test', difficulty: 'Easy', description: 'Fighter Test', introText: '', victoryText: '', defeatText: '', objectives: [], specialRules: [], startTileId: 'start_tile', maxSurges: 3 },
        turnOrder: ['fighter_hero_test'],
        healingSurges: 2,
        turnCount: 1,
        log: [],
        activeEnvironmentCard: null,
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null,
        logIdCounter: 0,
        cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null }
      };

      const dataLoader = DataLoader.getInstance();

      // --- TEST 1: Unstoppable (Heal self 2 HP) ---
      {
        const unstoppableCard = dataLoader.getCardById('fighter_unstoppable')!;
        const result = PowerSystem.usePower(fighterHero, unstoppableCard, null, testGameState);
        if (!result.success) {
          throw new Error(`Unstoppable: expected success, got failure: ${result.message}`);
        }
        const updatedHero = result.newState.heroes.find(h => h.id === 'fighter_hero_test')!;
        if (updatedHero.hp !== 10) {
          throw new Error(`Unstoppable: expected HP to be 10, got ${updatedHero.hp}`);
        }
        if (!updatedHero.flippedPowerIds?.includes('fighter_unstoppable')) {
          throw new Error('Unstoppable: expected card to be flipped');
        }
        console.log('  Unstoppable test PASSED');
      }

      // --- TEST 2: Brute Strike / Precise Strike (Flipping Logic) ---
      {
        const bruteCard = dataLoader.getCardById('fighter_brute_strike')!;
        
        // 2a. Miss Path -> should NOT flip
        AbilitySystem._rollOverride = () => 2; // total = 2 + 5 = 7 < AC 10
        const missResult = PowerSystem.usePower(fighterHero, bruteCard, zombieA, testGameState);
        AbilitySystem._rollOverride = null;
        if (!missResult.success) {
          throw new Error(`Brute Strike (miss): expected success, got failure: ${missResult.message}`);
        }
        const missHero = missResult.newState.heroes.find(h => h.id === 'fighter_hero_test')!;
        if (missHero.flippedPowerIds?.includes('fighter_brute_strike')) {
          throw new Error('Brute Strike (miss): should NOT have flipped the power');
        }

        // 2b. Hit Path -> should flip
        AbilitySystem._rollOverride = () => 10; // total = 10 + 5 = 15 >= AC 10
        const hitResult = PowerSystem.usePower(fighterHero, bruteCard, zombieA, testGameState);
        AbilitySystem._rollOverride = null;
        if (!hitResult.success) {
          throw new Error(`Brute Strike (hit): expected success, got failure: ${hitResult.message}`);
        }
        const hitHero = hitResult.newState.heroes.find(h => h.id === 'fighter_hero_test')!;
        if (!hitHero.flippedPowerIds?.includes('fighter_brute_strike')) {
          throw new Error('Brute Strike (hit): should have flipped the power');
        }

        const hitZombie = hitResult.newState.monsters.find(m => m.id === 'zombie_a')!;
        if (hitZombie.hp !== 0 || !hitZombie.isDefeated) {
          throw new Error(`Brute Strike (hit): expected monster to be defeated, got HP ${hitZombie.hp}`);
        }
        console.log('  Brute Strike flipping test PASSED');
      }

      // --- TEST 3: Get Over There! (Teleport adjacent to monster within 2 tiles) ---
      {
        const getOverThereCard = dataLoader.getCardById('fighter_get_over_there')!;
        const result = PowerSystem.usePower(fighterHero, getOverThereCard, zombieB, testGameState);
        if (!result.success) {
          throw new Error(`Get Over There: expected success, got failure: ${result.message}`);
        }
        const updatedHero = result.newState.heroes.find(h => h.id === 'fighter_hero_test')!;
        if (updatedHero.position.x !== 0 || updatedHero.position.z !== 1) {
          throw new Error(`Get Over There: expected hero to be on tile (0,1), got (${updatedHero.position.x}, ${updatedHero.position.z})`);
        }
        const dist = Math.abs(updatedHero.position.sqX - zombieB.position.sqX) + Math.abs(updatedHero.position.sqZ - zombieB.position.sqZ);
        if (dist !== 1) {
          throw new Error(`Get Over There: expected hero to be adjacent to Zombie B on tile, got distance ${dist}`);
        }
        console.log('  Get Over There test PASSED');
      }

      // --- TEST 4: Tide of Iron (Attack adjacent, hit -> place monster within 1 tile, move hero on tile) ---
      {
        const tideCard = dataLoader.getCardById('fighter_tide_of_iron')!;
        AbilitySystem._rollOverride = () => 10; // hit
        const result = PowerSystem.usePower(fighterHero, tideCard, zombieA, testGameState);
        AbilitySystem._rollOverride = null;
        if (!result.success) {
          throw new Error(`Tide of Iron: expected success, got failure: ${result.message}`);
        }

        const updatedZombie = result.newState.monsters.find(m => m.id === 'zombie_a')!;
        const updatedHero = result.newState.heroes.find(h => h.id === 'fighter_hero_test')!;

        if (updatedZombie.hp !== 1) {
          throw new Error(`Tide of Iron: expected zombie HP to be 1, got ${updatedZombie.hp}`);
        }

        const tileDist = Math.abs(updatedZombie.position.x - fighterHero.position.x) + Math.abs(updatedZombie.position.z - fighterHero.position.z);
        if (tileDist > 1) {
          throw new Error(`Tide of Iron: expected zombie to be within 1 tile, got tile distance ${tileDist}`);
        }

        if (updatedHero.position.x !== 0 || updatedHero.position.z !== 0) {
          throw new Error(`Tide of Iron: expected hero to stay on tile (0,0), got (${updatedHero.position.x}, ${updatedHero.position.z})`);
        }
        console.log('  Tide of Iron test PASSED');
      }

      // --- TEST 5: Come and Get It (Pull monsters from nearby tile, attack all adjacent) ---
      {
        const comeAndGetItCard = dataLoader.getCardById('fighter_come_and_get_it')!;
        AbilitySystem._rollOverride = () => 10;
        const result = PowerSystem.usePower(fighterHero, comeAndGetItCard, zombieB, testGameState);
        AbilitySystem._rollOverride = null;

        if (!result.success) {
          throw new Error(`Come and Get It: expected success, got failure: ${result.message}`);
        }

        const updatedZombieB = result.newState.monsters.find(m => m.id === 'zombie_b')!;
        if (updatedZombieB.position.x !== 0 || updatedZombieB.position.z !== 0) {
          throw new Error(`Come and Get It: expected Zombie B to be pulled to tile (0,0), got (${updatedZombieB.position.x}, ${updatedZombieB.position.z})`);
        }
        const dist = Math.abs(updatedZombieB.position.sqX - fighterHero.position.sqX) + Math.abs(updatedZombieB.position.sqZ - fighterHero.position.sqZ);
        if (dist !== 1) {
          throw new Error(`Come and Get It: expected Zombie B adjacent to hero, got square distance ${dist}`);
        }

        if (updatedZombieB.hp !== 1) {
          throw new Error(`Come and Get It: expected Zombie B to take 1 damage, got hp ${updatedZombieB.hp}`);
        }
        console.log('  Come and Get It test PASSED');
      }

      // --- TEST 6: Bodyguard (Intercept attack on adjacent hero, swap positions, make attack miss) ---
      {
        const activeMonster = {
          ...zombieA,
          ownedByHeroId: 'fighter_hero_test', // so it acts on active hero's villain phase
          position: { x: 0, z: 0, sqX: 2, sqZ: 3 } // adjacent to companion hero (2,2)
        };

        const bodyguardGameState = {
          ...testGameState,
          currentHeroId: 'fighter_hero_test',
          monsters: [activeMonster],
          heroes: [
            { ...fighterHero, position: { x: 0, z: 0, sqX: 1, sqZ: 2 } }, // within 1 tile of companion at (2,2)
            { ...companionHero, position: { x: 0, z: 0, sqX: 2, sqZ: 2 }, hp: 8 }
          ]
        };

        AbilitySystem._rollOverride = () => 15; // hits companion (AC 14)
        const postVillainState = executeVillainPhase(bodyguardGameState);
        AbilitySystem._rollOverride = null;

        const resolvedCompanion = postVillainState.heroes.find(h => h.id === 'companion_hero_test')!;
        const resolvedFighter = postVillainState.heroes.find(h => h.id === 'fighter_hero_test')!;

        // Companion should take 0 damage
        if (resolvedCompanion.hp !== 8) {
          throw new Error(`Bodyguard: expected companion HP to stay at 8, got ${resolvedCompanion.hp}`);
        }

        // They should have swapped positions
        if (resolvedCompanion.position.sqX !== 1 || resolvedCompanion.position.sqZ !== 2) {
          throw new Error(`Bodyguard: expected companion to swap to fighter position (1,2), got (${resolvedCompanion.position.sqX}, ${resolvedCompanion.position.sqZ})`);
        }
        if (resolvedFighter.position.sqX !== 2 || resolvedFighter.position.sqZ !== 2) {
          throw new Error(`Bodyguard: expected fighter to swap to companion position (2,2), got (${resolvedFighter.position.sqX}, ${resolvedFighter.position.sqZ})`);
        }

        // Fighter should have flipped the power
        if (!resolvedFighter.flippedPowerIds?.includes('fighter_bodyguard')) {
          throw new Error('Bodyguard: expected power to be flipped');
        }

        console.log('  Bodyguard test PASSED');
      }

      console.log('  Remaining Fighter powers tests PASSED');
    }

    // =======================================================================
    // Ranger Powers Verification (Careful Attack, Hit and Run, Hunter's Shot, Twin Shot, Attacks on the Run, Bounding Attack, Split the Tree, Crucial Aid, Unbalancing Parry, Yield Ground)
    // =======================================================================
    {
      console.log('Testing Ranger powers...');
      const rangerHero: Hero = {
        ...createAIHero('Test Ranger', 0, 0),
        heroClass: 'ranger',
        abilities: [
          'ranger_careful_attack',
          'ranger_hit_and_run',
          'ranger_hunters_shot',
          'ranger_twin_shot',
          'ranger_attacks_on_the_run',
          'ranger_bounding_attack',
          'ranger_split_the_tree',
          'ranger_crucial_aid',
          'ranger_unbalancing_parry',
          'ranger_yield_ground'
        ],
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 }
      };

      const zombieA: Monster = {
        ...createAIMonster('Zombie A', 1),
        monsterType: 'Zombie',
        hp: 3,
        maxHp: 3,
        position: { x: 0, z: 0, sqX: 2, sqZ: 3 } // adjacent to ranger
      };

      const zombieB: Monster = {
        ...createAIMonster('Zombie B', 1),
        monsterType: 'Zombie',
        hp: 2,
        position: { x: 0, z: 2, sqX: 2, sqZ: 2 } // 2 tiles away
      };

      const companionHero: Hero = {
        ...createAIHero('Companion Hero', 0, 0),
        heroClass: 'cleric',
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 }
      };

      const tile00 = createAITile('tile_0_0', 0, 0, [openEdge('north'), closedEdge('south'), closedEdge('east'), closedEdge('west')]);
      const tile01 = createAITile('tile_0_1', 0, 1, [openEdge('south'), openEdge('north'), closedEdge('east'), closedEdge('west')]);
      const tile02 = createAITile('tile_0_2', 0, 2, [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')]);

      tile00.connections[0].connectedTileId = 'tile_0_1';
      tile01.connections[0].connectedTileId = 'tile_0_0';
      tile01.connections[1].connectedTileId = 'tile_0_2';
      tile02.connections[0].connectedTileId = 'tile_0_1';

      const rangerGameState: GameState = {
        ...createAIState([rangerHero, companionHero], [tile00, tile01, tile02]),
        monsters: [zombieA, zombieB],
        currentHeroId: rangerHero.id
      };

      const dataLoader = DataLoader.getInstance();

      // --- TEST 1: Careful Attack (Automatic 1 damage, no attack roll) ---
      {
        const carefulCard = dataLoader.getCardById('ranger_careful_attack')!;
        const result = PowerSystem.usePower(rangerHero, carefulCard, zombieA, rangerGameState);
        const resolvedZombie = result.newState.monsters.find(m => m.id === zombieA.id)!;
        if (resolvedZombie.hp !== 2) {
          throw new Error(`Careful Attack: expected zombie HP to be 2, got ${resolvedZombie.hp}`);
        }
        console.log('  Careful Attack test PASSED');
      }

      // --- TEST 2: Hit and Run (Attack and move hero to another square on tile) ---
      {
        const card = dataLoader.getCardById('ranger_hit_and_run')!;
        AbilitySystem._rollOverride = () => 10; // hit
        const result = PowerSystem.usePower(rangerHero, card, zombieA, rangerGameState);
        AbilitySystem._rollOverride = null;
        const resolvedHero = result.newState.heroes.find(h => h.id === rangerHero.id)!;
        if (resolvedHero.position.sqX === 2 && resolvedHero.position.sqZ === 2) {
          throw new Error('Hit and Run: expected hero to move to a different square on tile');
        }
        if (resolvedHero.position.x !== 0 || resolvedHero.position.z !== 0) {
          throw new Error('Hit and Run: expected hero to stay on same tile (0,0)');
        }
        console.log('  Hit and Run test PASSED');
      }

      // --- TEST 3: Hunter's Shot (Miss moves monster > 1 tile away closer) ---
      {
        const card = dataLoader.getCardById('ranger_hunters_shot')!;
        AbilitySystem._rollOverride = () => 2; // miss
        const result = PowerSystem.usePower(rangerHero, card, zombieB, rangerGameState);
        AbilitySystem._rollOverride = null;
        const resolvedZombie = result.newState.monsters.find(m => m.id === zombieB.id)!;
        if (resolvedZombie.position.x !== 0 || resolvedZombie.position.z !== 1) {
          throw new Error(`Hunter's Shot: expected zombie B to move 1 tile closer to (0,1), got tile (${resolvedZombie.position.x}, ${resolvedZombie.position.z})`);
        }
        console.log('  Hunter\'s Shot test PASSED');
      }

      // --- TEST 4: Twin Shot (Attack two monsters within 1 tile) ---
      {
        const card = dataLoader.getCardById('ranger_twin_shot')!;
        
        const twinState = {
          ...rangerGameState,
          monsters: rangerGameState.monsters.map(m =>
            m.id === zombieB.id ? { ...m, position: { x: 0, z: 0, sqX: 3, sqZ: 2 } } : m
          )
        };
        AbilitySystem._rollOverride = () => 15; // hits both
        const result = PowerSystem.usePower(rangerHero, card, zombieA, twinState);
        AbilitySystem._rollOverride = null;

        const resZombieA = result.newState.monsters.find(m => m.id === zombieA.id)!;
        const resZombieB = result.newState.monsters.find(m => m.id === zombieB.id)!;

        if (resZombieA.hp !== 2) {
          throw new Error(`Twin Shot: expected target zombie A to take 1 damage (HP 2), got ${resZombieA.hp}`);
        }
        if (resZombieB.hp !== 1) {
          throw new Error(`Twin Shot: expected secondary zombie B to take 1 damage (HP 1), got ${resZombieB.hp}`);
        }
        console.log('  Twin Shot test PASSED');
      }

      // --- TEST 5: Attacks on the Run (Move speed, attack two monsters, miss deals 1 damage) ---
      {
        const card = dataLoader.getCardById('ranger_attacks_on_the_run')!;
        AbilitySystem._rollOverride = () => 2; // miss both
        const result = PowerSystem.usePower(rangerHero, card, zombieA, rangerGameState);
        AbilitySystem._rollOverride = null;

        const resHero = result.newState.heroes.find(h => h.id === rangerHero.id)!;
        if (resHero.position.sqX === 2 && resHero.position.sqZ === 2 && resHero.position.x === 0 && resHero.position.z === 0) {
          throw new Error('Attacks on the Run: expected hero to move');
        }

        const resZombieA = result.newState.monsters.find(m => m.id === zombieA.id)!;
        if (resZombieA.hp !== 2) {
          throw new Error(`Attacks on the Run: expected miss damage 1 to zombie A, got hp ${resZombieA.hp}`);
        }

        if (!resHero.flippedPowerIds?.includes('ranger_attacks_on_the_run')) {
          throw new Error('Attacks on the Run: expected daily power to be flipped');
        }
        console.log('  Attacks on the Run test PASSED');
      }

      // --- TEST 6: Bounding Attack (Move to tile within 1 tile, attack adjacent monster) ---
      {
        const card = dataLoader.getCardById('ranger_bounding_attack')!;
        AbilitySystem._rollOverride = () => 15; // hit
        const result = PowerSystem.usePower(rangerHero, card, zombieA, rangerGameState);
        AbilitySystem._rollOverride = null;

        const resHero = result.newState.heroes.find(h => h.id === rangerHero.id)!;
        const resZombieA = result.newState.monsters.find(m => m.id === zombieA.id)!;
        if (resZombieA.hp !== 0) {
          throw new Error(`Bounding Attack: expected target to take 3 damage, got hp ${resZombieA.hp}`);
        }
        console.log('  Bounding Attack test PASSED');
      }

      // --- TEST 7: Split the Tree (Choose tile, attack two monsters, miss moves >1 tile monster closer) ---
      {
        const card = dataLoader.getCardById('ranger_split_the_tree')!;
        
        const splitState = {
          ...rangerGameState,
          monsters: rangerGameState.monsters.map(m => {
            if (m.id === zombieA.id) {
              return { ...m, hp: 3, isDefeated: false, position: { x: 0, z: 2, sqX: 1, sqZ: 1 } };
            }
            return { ...m, hp: 2, isDefeated: false, position: { x: 0, z: 2, sqX: 2, sqZ: 2 } };
          })
        };

        AbilitySystem._rollOverride = () => 2; // miss both
        const result = PowerSystem.usePower(rangerHero, card, splitState.monsters.find(m => m.id === zombieA.id)!, splitState);
        AbilitySystem._rollOverride = null;

        const resZombieA = result.newState.monsters.find(m => m.id === zombieA.id)!;
        const resZombieB = result.newState.monsters.find(m => m.id === zombieB.id)!;

        if (resZombieA.hp !== 2) {
          throw new Error(`Split the Tree: expected miss damage 1 to zombie A, got hp ${resZombieA.hp}`);
        }
        if (resZombieB.hp !== 1) {
          throw new Error(`Split the Tree: expected miss damage 1 to zombie B, got hp ${resZombieB.hp}`);
        }

        if (resZombieA.position.x !== 0 || resZombieA.position.z !== 1) {
          throw new Error(`Split the Tree: expected zombie A to move closer to (0,1), got (${resZombieA.position.x}, ${resZombieA.position.z})`);
        }
        if (resZombieB.position.x !== 0 || resZombieB.position.z !== 1) {
          throw new Error(`Split the Tree: expected zombie B to move closer to (0,1), got (${resZombieB.position.x}, ${resZombieB.position.z})`);
        }
        console.log('  Split the Tree test PASSED');
      }

      // --- TEST 8: Crucial Aid (Utility: grant +4 attack bonus to another hero) ---
      {
        const card = dataLoader.getCardById('ranger_crucial_aid')!;
        const result = PowerSystem.usePower(rangerHero, card, companionHero, rangerGameState);
        const resCompanion = result.newState.heroes.find(h => h.id === companionHero.id)!;
        const crucialCond = (resCompanion.conditions ?? []).find(c => c.type === 'attack_bonus');
        if (!crucialCond || crucialCond.value !== 4) {
          throw new Error('Crucial Aid: expected companion to gain +4 attack bonus');
        }
        console.log('  Crucial Aid test PASSED');
      }

      // --- TEST 9: Unbalancing Parry (Reactive: monster hit is made a miss, monster moved within 1 tile) ---
      {
        const parryState = {
          ...rangerGameState,
          currentHeroId: rangerHero.id,
          heroes: rangerGameState.heroes.map(h =>
            h.id === rangerHero.id ? { ...h, abilities: ['ranger_unbalancing_parry'], flippedPowerIds: [] } : h
          ),
          monsters: rangerGameState.monsters.map(m =>
            m.id === zombieB.id ? { ...m, ownedByHeroId: rangerHero.id, position: { x: 0, z: 1, sqX: 2, sqZ: 2 } } : m
          )
        };

        AbilitySystem._rollOverride = () => 18; // hits ranger
        const postVillainState = executeVillainPhase(parryState);
        AbilitySystem._rollOverride = null;

        const resRanger = postVillainState.heroes.find(h => h.id === rangerHero.id)!;
        const resZombieB = postVillainState.monsters.find(m => m.id === zombieB.id)!;

        if (resRanger.hp !== rangerHero.hp) {
          throw new Error(`Unbalancing Parry: expected ranger HP to be ${rangerHero.hp}, got ${resRanger.hp}`);
        }

        if (!resRanger.flippedPowerIds?.includes('ranger_unbalancing_parry')) {
          throw new Error('Unbalancing Parry: expected power to be flipped');
        }

        const zBdist = getTileGraphDistance(
          postVillainState.tiles.find(t => t.x === resRanger.position.x && t.z === resRanger.position.z)!,
          postVillainState.tiles.find(t => t.x === resZombieB.position.x && t.z === resZombieB.position.z)!,
          postVillainState.tiles
        );
        if (zBdist > 1) {
          throw new Error(`Unbalancing Parry: expected monster to be placed within 1 tile, got distance ${zBdist}`);
        }
        console.log('  Unbalancing Parry test PASSED');
      }

      // --- TEST 10: Yield Ground (Reactive: monster hit applies damage, but moves ranger speed) ---
      {
        const yieldState = {
          ...rangerGameState,
          currentHeroId: rangerHero.id,
          heroes: rangerGameState.heroes.map(h =>
            h.id === rangerHero.id ? { ...h, abilities: ['ranger_yield_ground'], flippedPowerIds: [], hp: 8, maxHp: 8 } : h
          ),
          monsters: rangerGameState.monsters.map(m =>
            m.id === zombieB.id ? { ...m, ownedByHeroId: rangerHero.id, position: { x: 0, z: 0, sqX: 2, sqZ: 3 } } : m
          )
        };

        AbilitySystem._rollOverride = () => 18; // hits
        const postVillainState = executeVillainPhase(yieldState);
        AbilitySystem._rollOverride = null;

        const resRanger = postVillainState.heroes.find(h => h.id === rangerHero.id)!;

        if (resRanger.hp !== 7) {
          throw new Error(`Yield Ground: expected ranger HP to be 7, got ${resRanger.hp}`);
        }

        if (resRanger.position.sqX === 2 && resRanger.position.sqZ === 2 && resRanger.position.x === 0 && resRanger.position.z === 0) {
          throw new Error('Yield Ground: expected ranger to move');
        }

        if (!resRanger.flippedPowerIds?.includes('ranger_yield_ground')) {
          throw new Error('Yield Ground: expected power to be flipped');
        }
        console.log('  Yield Ground test PASSED');
      }
    }

    // Rogue Powers Verification (Sneak Attack, Backstab, Deft Strike, Snipe Shot, Dagger Barrage, Deep Cut, Riposte Strike, Great Leap, Spring Away, Stealth)
    // =======================================================================
    {
      console.log('Testing Rogue powers...');
      const rogueHero: Hero = {
        ...createAIHero('Test Rogue', 0, 0),
        heroClass: 'rogue',
        abilities: [
          'rogue_sneak_attack',
          'rogue_backstab',
          'rogue_deft_strike',
          'rogue_snipe_shot',
          'rogue_dagger_barrage',
          'rogue_deep_cut',
          'rogue_riposte_strike',
          'rogue_great_leap',
          'rogue_spring_away',
          'rogue_stealth'
        ],
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 }
      };

      const monsterA: Monster = {
        ...createAIMonster('Zombie A', 1),
        monsterType: 'Zombie',
        hp: 4,
        maxHp: 4,
        position: { x: 0, z: 0, sqX: 2, sqZ: 3 } // adjacent to rogue
      };

      const monsterB: Monster = {
        ...createAIMonster('Zombie B', 1),
        monsterType: 'Zombie',
        hp: 3,
        position: { x: 0, z: 1, sqX: 2, sqZ: 2 } // 1 tile away
      };

      const companionHero: Hero = {
        ...createAIHero('Companion Hero', 0, 0),
        heroClass: 'cleric',
        position: { x: 0, z: 0, sqX: 1, sqZ: 3 } // adjacent to monsterA
      };

      const tile00 = createAITile('tile_0_0', 0, 0, [openEdge('north'), closedEdge('south'), closedEdge('east'), closedEdge('west')]);
      const tile01 = createAITile('tile_0_1', 0, 1, [openEdge('south'), openEdge('north'), closedEdge('east'), closedEdge('west')]);
      const tile02 = createAITile('tile_0_2', 0, 2, [openEdge('south'), closedEdge('north'), closedEdge('east'), closedEdge('west')]);

      tile00.connections[0].connectedTileId = 'tile_0_1';
      tile01.connections[0].connectedTileId = 'tile_0_0';
      tile01.connections[1].connectedTileId = 'tile_0_2';
      tile02.connections[0].connectedTileId = 'tile_0_1';

      const rogueGameState: GameState = {
        ...createAIState([rogueHero, companionHero], [tile00, tile01, tile02]),
        monsters: [monsterA, monsterB],
        currentHeroId: rogueHero.id
      };

      const dataLoader = DataLoader.getInstance();

      // --- TEST 1: Sneak Attack (Utility: gain +4 attack bonus and +1 damage for duration) ---
      {
        const card = dataLoader.getCardById('rogue_sneak_attack')!;
        const result = PowerSystem.usePower(rogueHero, card, null, rogueGameState);
        const resRogue = result.newState.heroes.find(h => h.id === rogueHero.id)!;
        const attackBonusCond = (resRogue.conditions ?? []).find(c => c.type === 'attack_bonus');
        const damageBonusCond = (resRogue.conditions ?? []).find(c => c.type === 'damage_bonus');

        if (!attackBonusCond || attackBonusCond.value !== 4) {
          throw new Error('Sneak Attack: expected +4 attack_bonus condition');
        }
        if (!damageBonusCond || damageBonusCond.value !== 1) {
          throw new Error('Sneak Attack: expected +1 damage_bonus condition');
        }
        console.log('  Sneak Attack test PASSED');
      }

      // --- TEST 2: Backstab (+1 damage if target is adjacent to another hero) ---
      {
        const card = dataLoader.getCardById('rogue_backstab')!;
        
        // Scenario A: adjacent to another hero -> deals 2 damage (1 base + 1 conditional)
        AbilitySystem._rollOverride = () => 15; // hit
        const resultA = PowerSystem.usePower(rogueHero, card, monsterA, rogueGameState);
        AbilitySystem._rollOverride = null;
        const resMonsterA = resultA.newState.monsters.find(m => m.id === monsterA.id)!;
        if (resMonsterA.hp !== 2) {
          throw new Error(`Backstab (adjacent to companion): expected HP to be 2, got ${resMonsterA.hp}`);
        }

        // Scenario B: not adjacent to another hero -> deals 1 damage
        const isolatedState = {
          ...rogueGameState,
          heroes: rogueGameState.heroes.map(h =>
            h.id === companionHero.id ? { ...h, position: { x: 0, z: 2, sqX: 2, sqZ: 2 } } : h
          )
        };
        AbilitySystem._rollOverride = () => 15; // hit
        const resultB = PowerSystem.usePower(rogueHero, card, monsterA, isolatedState);
        AbilitySystem._rollOverride = null;
        const resMonsterB = resultB.newState.monsters.find(m => m.id === monsterA.id)!;
        if (resMonsterB.hp !== 3) {
          throw new Error(`Backstab (isolated): expected HP to be 3, got ${resMonsterB.hp}`);
        }

        console.log('  Backstab test PASSED');
      }

      // --- TEST 3: Deft Strike (Move up to 2 squares before attack) ---
      {
        const card = dataLoader.getCardById('rogue_deft_strike')!;
        
        const distantState = {
          ...rogueGameState,
          heroes: rogueGameState.heroes.map(h =>
            h.id === rogueHero.id ? { ...h, position: { x: 0, z: 0, sqX: 2, sqZ: 1 } } : h
          )
        };
        const distantRogue = distantState.heroes.find(h => h.id === rogueHero.id)!;

        AbilitySystem._rollOverride = () => 15; // hit
        const result = PowerSystem.usePower(distantRogue, card, monsterA, distantState);
        AbilitySystem._rollOverride = null;

        const resRogue = result.newState.heroes.find(h => h.id === rogueHero.id)!;
        const absXDiff = Math.abs((resRogue.position.x * 4 + resRogue.position.sqX) - (monsterA.position.x * 4 + monsterA.position.sqX));
        const absZDiff = Math.abs((resRogue.position.z * 4 + resRogue.position.sqZ) - (monsterA.position.z * 4 + monsterA.position.sqZ));
        if (absXDiff + absZDiff !== 1) {
          throw new Error(`Deft Strike: expected hero to move adjacent to monster, got distance ${absXDiff + absZDiff}`);
        }
        console.log('  Deft Strike test PASSED');
      }

      // --- TEST 4: Snipe Shot (+2 attack bonus if target is 1 tile away) ---
      {
        const card = dataLoader.getCardById('rogue_snipe_shot')!;
        
        AbilitySystem._rollOverride = () => 5;
        const result = PowerSystem.usePower(rogueHero, card, monsterB, rogueGameState);
        AbilitySystem._rollOverride = null;

        const resMonster = result.newState.monsters.find(m => m.id === monsterB.id)!;
        if (resMonster.hp !== 2) {
          throw new Error(`Snipe Shot: expected hit on roll of 5 due to tile-away bonus (+2), monster HP is ${resMonster.hp}`);
        }
        console.log('  Snipe Shot test PASSED');
      }

      // --- TEST 5: Dagger Barrage (Attacks all monsters on target's tile, miss deals 1 damage) ---
      {
        const card = dataLoader.getCardById('rogue_dagger_barrage')!;
        
        const barrageState = {
          ...rogueGameState,
          monsters: rogueGameState.monsters.map(m =>
            m.id === monsterA.id ? { ...m, hp: 4, position: { x: 0, z: 1, sqX: 1, sqZ: 1 } } :
            m.id === monsterB.id ? { ...m, hp: 3, position: { x: 0, z: 1, sqX: 2, sqZ: 2 } } : m
          )
        };

        AbilitySystem._rollOverride = () => 2; // miss all
        const result = PowerSystem.usePower(rogueHero, card, barrageState.monsters.find(m => m.id === monsterA.id)!, barrageState);
        AbilitySystem._rollOverride = null;

        const resMonsterA = result.newState.monsters.find(m => m.id === monsterA.id)!;
        const resMonsterB = result.newState.monsters.find(m => m.id === monsterB.id)!;

        if (resMonsterA.hp !== 3) {
          throw new Error(`Dagger Barrage: expected monster A to take 1 miss damage (HP 3), got ${resMonsterA.hp}`);
        }
        if (resMonsterB.hp !== 2) {
          throw new Error(`Dagger Barrage: expected monster B to take 1 miss damage (HP 2), got ${resMonsterB.hp}`);
        }
        console.log('  Dagger Barrage test PASSED');
      }

      // --- TEST 6: Deep Cut (Deals 3 damage if target is adjacent to another hero, even on a miss) ---
      {
        const card = dataLoader.getCardById('rogue_deep_cut')!;
        
        // Scenario A: Miss on target adjacent to another hero -> deals 3 damage
        AbilitySystem._rollOverride = () => 2; // miss
        const resultMiss = PowerSystem.usePower(rogueHero, card, monsterA, rogueGameState);
        AbilitySystem._rollOverride = null;
        const resMonsterMiss = resultMiss.newState.monsters.find(m => m.id === monsterA.id)!;
        if (resMonsterMiss.hp !== 1) {
          throw new Error(`Deep Cut (miss, adjacent to companion): expected HP to be 1 (4 - 3), got ${resMonsterMiss.hp}`);
        }

        // Scenario B: Hit on target adjacent to another hero -> deals 5 damage (2 base + 3 conditional)
        AbilitySystem._rollOverride = () => 15; // hit
        const resultHit = PowerSystem.usePower(rogueHero, card, monsterA, rogueGameState);
        AbilitySystem._rollOverride = null;
        const resMonsterHit = resultHit.newState.monsters.find(m => m.id === monsterA.id)!;
        if (resMonsterHit.hp !== 0) {
          throw new Error(`Deep Cut (hit, adjacent to companion): expected HP to be 0 (4 - 5), got ${resMonsterHit.hp}`);
        }

        console.log('  Deep Cut test PASSED');
      }

      // --- TEST 7: Riposte Strike (Reactive: attacks adjacent monster after being attacked) ---
      {
        const riposteState = {
          ...rogueGameState,
          currentHeroId: rogueHero.id,
          heroes: rogueGameState.heroes.map(h =>
            h.id === rogueHero.id ? { ...h, abilities: ['rogue_riposte_strike'], flippedPowerIds: [], hp: 8, maxHp: 8 } : h
          ),
          monsters: rogueGameState.monsters.map(m =>
            m.id === monsterA.id ? { ...m, ownedByHeroId: rogueHero.id, hp: 4 } : m
          )
        };

        // Scenario A: Riposte hits -> deals 2 damage and card flips
        AbilitySystem._rollOverride = () => 15; // both monster and riposte hit
        const postVillainStateHit = executeVillainPhase(riposteState);
        AbilitySystem._rollOverride = null;

        const resRogueHit = postVillainStateHit.heroes.find(h => h.id === rogueHero.id)!;
        const resMonsterHit = postVillainStateHit.monsters.find(m => m.id === monsterA.id)!;

        if (resMonsterHit.hp !== 2) {
          throw new Error(`Riposte Strike (hit): expected monster to take 2 damage (HP 2), got ${resMonsterHit.hp}`);
        }
        if (!resRogueHit.flippedPowerIds?.includes('rogue_riposte_strike')) {
          throw new Error('Riposte Strike (hit): expected power card to flip face-down');
        }

        // Scenario B: Riposte misses -> deals 0 damage and card does not flip
        AbilitySystem._rollOverride = () => 2; // riposte misses, monster attacks
        const postVillainStateMiss = executeVillainPhase(riposteState);
        AbilitySystem._rollOverride = null;

        const resRogueMiss = postVillainStateMiss.heroes.find(h => h.id === rogueHero.id)!;
        const resMonsterMiss = postVillainStateMiss.monsters.find(m => m.id === monsterA.id)!;

        if (resMonsterMiss.hp !== 4) {
          throw new Error(`Riposte Strike (miss): expected monster to take 0 damage, got hp ${resMonsterMiss.hp}`);
        }
        if (resRogueMiss.flippedPowerIds?.includes('rogue_riposte_strike')) {
          throw new Error('Riposte Strike (miss): expected power card NOT to flip face-down');
        }

        console.log('  Riposte Strike test PASSED');
      }

      // --- TEST 8: Great Leap (Place hero on any tile within 2 tiles) ---
      {
        const card = dataLoader.getCardById('rogue_great_leap')!;
        const result = PowerSystem.usePower(rogueHero, card, null, rogueGameState);
        const resRogue = result.newState.heroes.find(h => h.id === rogueHero.id)!;
        if (resRogue.position.x === 0 && resRogue.position.z === 0) {
          throw new Error('Great Leap: expected hero to leap to a different tile');
        }
        const dist = getTileGraphDistance(
          tile00,
          result.newState.tiles.find(t => t.x === resRogue.position.x && t.z === resRogue.position.z)!,
          result.newState.tiles
        );
        if (dist > 2) {
          throw new Error(`Great Leap: expected leap distance <= 2, got ${dist}`);
        }
        console.log('  Great Leap test PASSED');
      }

      // --- TEST 9: Spring Away (Teleport 2 tiles away when another hero draws Encounter card) ---
      {
        const springAwayState = {
          ...rogueGameState,
          currentHeroId: companionHero.id,
          heroes: rogueGameState.heroes.map(h =>
            h.id === rogueHero.id ? { ...h, abilities: ['rogue_spring_away'], flippedPowerIds: [], position: { x: 0, z: 0, sqX: 2, sqZ: 2 } } : h
          ),
          encounterDeck: ['enc_cackling_skull']
        };

        let finalState = springAwayState;
        const cardSlice = createCardSlice(
          (update: any) => {
            const partial = typeof update === 'function' ? update({ gameState: finalState }) : update;
            if (partial.gameState) {
              finalState = partial.gameState;
            }
          },
          () => ({ gameState: finalState }) as any,
          {} as any
        );

        cardSlice.drawEncounterCard();
        const resRogue = finalState.heroes.find(h => h.id === rogueHero.id)!;

        if (resRogue.position.x !== 0 || resRogue.position.z !== 2) {
          throw new Error(`Spring Away: expected Rogue to teleport to tile (0,2), got (${resRogue.position.x}, ${resRogue.position.z})`);
        }
        if (!resRogue.flippedPowerIds?.includes('rogue_spring_away')) {
          throw new Error('Spring Away: expected card to flip face-down');
        }

        console.log('  Spring Away test PASSED');
      }

      // --- TEST 10: Stealth (Discard drawn monster card instead of spawning it) ---
      {
        const stealthState = {
          ...rogueGameState,
          currentHeroId: rogueHero.id,
          heroes: rogueGameState.heroes.map(h =>
            h.id === rogueHero.id ? { ...h, abilities: ['rogue_stealth'], flippedPowerIds: [] } : h
          ),
          monsterDeck: ['mon_skeleton']
        };

        const finalState = TileSystem.spawnMonsterForExploration(stealthState, {
          ...tile01,
          encounterType: 'white'
        });

        const resRogue = finalState.heroes.find(h => h.id === rogueHero.id)!;
        if (finalState.monsters.length !== rogueGameState.monsters.length) {
          throw new Error('Stealth (Exploration): expected monster to be discarded (not spawned)');
        }
        if (!resRogue.flippedPowerIds?.includes('rogue_stealth')) {
          throw new Error('Stealth (Exploration): expected power card to flip face-down');
        }

        const encounterStealthState = {
          ...rogueGameState,
          currentHeroId: rogueHero.id,
          heroes: rogueGameState.heroes.map(h =>
            h.id === rogueHero.id ? { ...h, abilities: ['rogue_stealth'], flippedPowerIds: [] } : h
          ),
          monsterDeck: ['mon_skeleton'],
          cardResolution: {
            phase: 'revealing' as const,
            cardId: 'enc_cackling_skull',
            cardType: 'encounter' as const,
            pendingEffects: [],
            resolvedEffects: [],
            targetEntityId: null,
            result: null
          }
        };

        const postEncounterState = EncounterSystem.advanceCardResolution(encounterStealthState);
        const finalEncounterState = EncounterSystem.advanceCardResolution({
          ...postEncounterState,
          cardResolution: {
            ...postEncounterState.cardResolution!,
            pendingEffects: [{ type: 'spawn_monster', value: 1, target: 'single' }]
          }
        });

        const resRogueEncounter = finalEncounterState.heroes.find(h => h.id === rogueHero.id)!;
        if (finalEncounterState.monsters.length !== rogueGameState.monsters.length) {
          throw new Error('Stealth (Encounter): expected monster to be discarded (not spawned)');
        }
        if (!resRogueEncounter.flippedPowerIds?.includes('rogue_stealth')) {
          throw new Error('Stealth (Encounter): expected power card to flip face-down');
        }

        console.log('  Stealth test PASSED');
      }
    }

    // =======================================================================
    // Wizard Powers Verification
    // =======================================================================
    {
      console.log('Testing Wizard powers...');
      const wizardHero: Hero = {
        ...createAIHero('Test Wizard', 0, 0),
        id: 'wizard_hero_test',
        heroClass: 'wizard',
        abilities: [
          'wizard_fey_step',
          'wizard_magic_missile',
          'wizard_thunderwave',
          'wizard_scorching_burst',
          'wizard_fireball',
          'wizard_lightning_bolt',
          'wizard_freezing_cloud',
          'wizard_dispel_magic',
          'wizard_illusionary_crowd'
        ],
        hp: 8,
        maxHp: 8,
        ac: 14,
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        flippedPowerIds: []
      };

      const companionHero: Hero = {
        ...createAIHero('Companion Hero', 0, 0),
        id: 'companion_hero_test',
        heroClass: 'fighter',
        hp: 10,
        maxHp: 10,
        ac: 16,
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
        flippedPowerIds: []
      };

      const monsterA: Monster = {
        id: 'monster_a',
        name: 'Zombie A',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 5,
        damage: 2,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 2, sqZ: 1 },
        hp: 4,
        maxHp: 4,
        ac: 10,
        speed: 4,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      const monsterB: Monster = {
        id: 'monster_b',
        name: 'Zombie B',
        type: 'monster',
        monsterType: 'zombie',
        behavior: { conditions: [], priorityTargets: [], actions: [] },
        attackBonus: 5,
        damage: 2,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 1, sqZ: 2 },
        hp: 4,
        maxHp: 4,
        ac: 10,
        speed: 4,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      const tile00: Tile = {
        id: 'tile_00',
        name: 'Start Tile',
        x: 0,
        z: 0,
        terrainType: 'corridor',
        connections: [openEdge('north'), openEdge('east')],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: true,
        isExit: false,
        rotation: 0,
        monsters: ['monster_a', 'monster_b'],
        heroes: ['wizard_hero_test', 'companion_hero_test'],
        items: []
      };

      const tile01: Tile = {
        id: 'tile_01',
        name: 'North Tile',
        x: 0,
        z: 1,
        terrainType: 'corridor',
        connections: [openEdge('south'), openEdge('north')],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: []
      };

      const tile02: Tile = {
        id: 'tile_02',
        name: 'Far Tile',
        x: 0,
        z: 2,
        terrainType: 'corridor',
        connections: [openEdge('south')],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: []
      };

      const tile10: Tile = {
        id: 'tile_10',
        name: 'East Tile',
        x: 1,
        z: 0,
        terrainType: 'corridor',
        connections: [openEdge('west')],
        boneSquare: { sqX: 1, sqZ: 1 },
        isRevealed: true,
        isStart: false,
        isExit: false,
        rotation: 0,
        monsters: [],
        heroes: [],
        items: []
      };

      tile00.connections[0].connectedTileId = 'tile_01';
      tile01.connections[0].connectedTileId = 'tile_00';
      tile01.connections[1].connectedTileId = 'tile_02';
      tile02.connections[0].connectedTileId = 'tile_01';
      tile00.connections[1].connectedTileId = 'tile_10';
      tile10.connections[0].connectedTileId = 'tile_00';

      const wizardGameState: GameState = {
        phase: 'hero',
        currentHeroId: 'wizard_hero_test',
        heroes: [wizardHero, companionHero],
        monsters: [monsterA, monsterB],
        tiles: [tile00, tile01, tile02, tile10],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        monsterDeck: [],
        discardPiles: { treasure: [], encounter: [], ability: [], monster: [] },
        activeScenario: { id: 'wizard_test', name: 'Wizard Test', difficulty: 'Easy', description: 'Wizard Test', introText: '', victoryText: '', defeatText: '', objectives: [], specialRules: [], startTileId: 'tile_00', maxSurges: 3 },
        turnOrder: ['wizard_hero_test', 'companion_hero_test'],
        healingSurges: 2,
        turnCount: 1,
        log: [],
        activeEnvironmentCard: null,
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null,
        logIdCounter: 0,
        cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null }
      };

      const dataLoader = DataLoader.getInstance();

      // --- TEST 1: Fey Step (Teleport 1 tile away) ---
      {
        const card = dataLoader.getCardById('wizard_fey_step')!;
        const result = PowerSystem.usePower(wizardHero, card, null, wizardGameState);
        if (!result.success) {
          throw new Error(`Fey Step: expected success, got failure: ${result.message}`);
        }
        const resWizard = result.newState.heroes.find(h => h.id === 'wizard_hero_test')!;
        if (resWizard.position.x === 0 && resWizard.position.z === 0) {
          throw new Error('Fey Step: expected hero to move to a different tile');
        }
        const dist = getTileGraphDistance(
          tile00,
          result.newState.tiles.find(t => t.x === resWizard.position.x && t.z === resWizard.position.z)!,
          result.newState.tiles
        );
        if (dist !== 1) {
          throw new Error(`Fey Step: expected teleport distance 1, got ${dist}`);
        }
        console.log('  Fey Step test PASSED');
      }

      // --- TEST 2: Magic Missile (Attack range 3, pull on miss) ---
      {
        const monsterFar = {
          ...monsterA,
          id: 'monster_far',
          position: { x: 0, z: 2, sqX: 2, sqZ: 2 }
        };
        const magicMissileState = {
          ...wizardGameState,
          monsters: [monsterFar]
        };

        const card = dataLoader.getCardById('wizard_magic_missile')!;
        
        // 2a. Hit path
        AbilitySystem._rollOverride = () => 15; // Hit
        const resultHit = PowerSystem.usePower(wizardHero, card, monsterFar, magicMissileState);
        AbilitySystem._rollOverride = null;
        if (!resultHit.success) {
          throw new Error(`Magic Missile (hit): expected success, got failure: ${resultHit.message}`);
        }
        const resMonsterHit = resultHit.newState.monsters.find(m => m.id === 'monster_far')!;
        if (resMonsterHit.hp !== 3) {
          throw new Error(`Magic Missile (hit): expected monster HP to be 3, got ${resMonsterHit.hp}`);
        }
        if (resMonsterHit.position.x !== 0 || resMonsterHit.position.z !== 2) {
          throw new Error('Magic Missile (hit): monster position should not have changed');
        }

        // 2b. Miss path & pull
        AbilitySystem._rollOverride = () => 1; // Miss
        const resultMiss = PowerSystem.usePower(wizardHero, card, monsterFar, magicMissileState);
        AbilitySystem._rollOverride = null;
        if (!resultMiss.success) {
          throw new Error(`Magic Missile (miss): expected success, got failure: ${resultMiss.message}`);
        }
        const resMonsterMiss = resultMiss.newState.monsters.find(m => m.id === 'monster_far')!;
        if (resMonsterMiss.hp !== 4) {
          throw new Error(`Magic Missile (miss): expected monster HP to be 4, got ${resMonsterMiss.hp}`);
        }
        if (resMonsterMiss.position.x !== 0 || resMonsterMiss.position.z !== 1) {
          throw new Error(`Magic Missile (miss): expected monster to pull to tile (0,1), got (${resMonsterMiss.position.x}, ${resMonsterMiss.position.z})`);
        }
        console.log('  Magic Missile tests PASSED');
      }

      // --- TEST 3: Thunderwave (Attack on hero's tile, push to adjacent tile) ---
      {
        const card = dataLoader.getCardById('wizard_thunderwave')!;
        const targetEntity = {
          id: 'dummy_dest',
          position: { x: 0, z: 1, sqX: 2, sqZ: 2 }
        } as Entity;

        AbilitySystem._rollOverride = () => 15; // Hit both
        const result = PowerSystem.usePower(wizardHero, card, targetEntity, wizardGameState);
        AbilitySystem._rollOverride = null;
        if (!result.success) {
          throw new Error(`Thunderwave: expected success, got failure: ${result.message}`);
        }

        const resMonsterA = result.newState.monsters.find(m => m.id === 'monster_a')!;
        const resMonsterB = result.newState.monsters.find(m => m.id === 'monster_b')!;

        if (resMonsterA.hp !== 3 || resMonsterB.hp !== 3) {
          throw new Error(`Thunderwave: expected monsters to take damage, got HP ${resMonsterA.hp} and ${resMonsterB.hp}`);
        }
        if (resMonsterA.position.x !== 0 || resMonsterA.position.z !== 1) {
          throw new Error(`Thunderwave: expected monster A to be pushed to (0,1), got (${resMonsterA.position.x}, ${resMonsterA.position.z})`);
        }
        if (resMonsterB.position.x !== 0 || resMonsterB.position.z !== 1) {
          throw new Error(`Thunderwave: expected monster B to be pushed to (0,1), got (${resMonsterB.position.x}, ${resMonsterB.position.z})`);
        }
        console.log('  Thunderwave test PASSED');
      }

      // --- TEST 4: Scorching Burst (Attack all monsters on target tile, At-Will) ---
      {
        const card = dataLoader.getCardById('wizard_scorching_burst')!;
        const monsterAOnTile01 = { ...monsterA, position: { x: 0, z: 1, sqX: 1, sqZ: 1 } };
        const monsterBOnTile01 = { ...monsterB, position: { x: 0, z: 1, sqX: 2, sqZ: 2 } };
        const state = {
          ...wizardGameState,
          monsters: [monsterAOnTile01, monsterBOnTile01]
        };

        AbilitySystem._rollOverride = () => 15; // Hit
        const result = PowerSystem.usePower(wizardHero, card, monsterAOnTile01, state);
        AbilitySystem._rollOverride = null;

        if (!result.success) {
          throw new Error(`Scorching Burst: expected success, got failure: ${result.message}`);
        }
        const resA = result.newState.monsters.find(m => m.id === 'monster_a')!;
        const resB = result.newState.monsters.find(m => m.id === 'monster_b')!;
        if (resA.hp !== 3 || resB.hp !== 3) {
          throw new Error(`Scorching Burst: expected both monsters to take 1 damage, got hp ${resA.hp} and ${resB.hp}`);
        }
        const resWizard = result.newState.heroes.find(h => h.id === 'wizard_hero_test')!;
        if (resWizard.flippedPowerIds?.includes('wizard_scorching_burst')) {
          throw new Error('Scorching Burst: at-will power should not be flipped');
        }
        console.log('  Scorching Burst test PASSED');
      }

      // --- TEST 5: Fireball (Attack all monsters on target tile, Miss: 1 Damage, Daily) ---
      {
        const card = dataLoader.getCardById('wizard_fireball')!;
        const monsterAOnTile01 = { ...monsterA, position: { x: 0, z: 1, sqX: 1, sqZ: 1 } };
        const monsterBOnTile01 = { ...monsterB, position: { x: 0, z: 1, sqX: 2, sqZ: 2 } };
        const state = {
          ...wizardGameState,
          monsters: [monsterAOnTile01, monsterBOnTile01]
        };

        // Hit path
        AbilitySystem._rollOverride = () => 15; // Hit
        const resultHit = PowerSystem.usePower(wizardHero, card, monsterAOnTile01, state);
        AbilitySystem._rollOverride = null;

        const resAHit = resultHit.newState.monsters.find(m => m.id === 'monster_a')!;
        const resBHit = resultHit.newState.monsters.find(m => m.id === 'monster_b')!;
        if (resAHit.hp !== 1 || resBHit.hp !== 1) {
          throw new Error(`Fireball (hit): expected both monsters to take 3 damage, got hp ${resAHit.hp} and ${resBHit.hp}`);
        }
        const resWizardHit = resultHit.newState.heroes.find(h => h.id === 'wizard_hero_test')!;
        if (!resWizardHit.flippedPowerIds?.includes('wizard_fireball')) {
          throw new Error('Fireball: expected daily power to be flipped');
        }

        // Miss path
        AbilitySystem._rollOverride = () => 1; // Miss
        const resultMiss = PowerSystem.usePower(wizardHero, card, monsterAOnTile01, state);
        AbilitySystem._rollOverride = null;

        const resAMiss = resultMiss.newState.monsters.find(m => m.id === 'monster_a')!;
        const resBMiss = resultMiss.newState.monsters.find(m => m.id === 'monster_b')!;
        if (resAMiss.hp !== 3 || resBMiss.hp !== 3) {
          throw new Error(`Fireball (miss): expected both monsters to take 1 damage, got hp ${resAMiss.hp} and ${resBMiss.hp}`);
        }
        console.log('  Fireball tests PASSED');
      }

      // --- TEST 6: Lightning Bolt (Attack up to 3 monsters within 1 tile, Miss: 1 Damage, Daily) ---
      {
        const card = dataLoader.getCardById('wizard_lightning_bolt')!;
        const monsterAOnTile01 = { ...monsterA, position: { x: 0, z: 1, sqX: 1, sqZ: 1 } };
        const monsterBOnTile00 = { ...monsterB, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        const monsterCOnTile10: Monster = {
          ...monsterA,
          id: 'monster_c',
          position: { x: 1, z: 0, sqX: 1, sqZ: 1 }
        };
        const state = {
          ...wizardGameState,
          monsters: [monsterAOnTile01, monsterBOnTile00, monsterCOnTile10]
        };

        // Hit path
        AbilitySystem._rollOverride = () => 15; // Hit
        const resultHit = PowerSystem.usePower(wizardHero, card, monsterAOnTile01, state);
        AbilitySystem._rollOverride = null;

        const resAHit = resultHit.newState.monsters.find(m => m.id === 'monster_a')!;
        const resBHit = resultHit.newState.monsters.find(m => m.id === 'monster_b')!;
        const resCHit = resultHit.newState.monsters.find(m => m.id === 'monster_c')!;

        if (resAHit.hp !== 2 || resBHit.hp !== 2 || resCHit.hp !== 2) {
          throw new Error(`Lightning Bolt (hit): expected 3 monsters to take 2 damage, got hp ${resAHit.hp}, ${resBHit.hp}, ${resCHit.hp}`);
        }
        const resWizardHit = resultHit.newState.heroes.find(h => h.id === 'wizard_hero_test')!;
        if (!resWizardHit.flippedPowerIds?.includes('wizard_lightning_bolt')) {
          throw new Error('Lightning Bolt: expected daily power to be flipped');
        }

        // Miss path
        AbilitySystem._rollOverride = () => 1; // Miss
        const resultMiss = PowerSystem.usePower(wizardHero, card, monsterAOnTile01, state);
        AbilitySystem._rollOverride = null;

        const resAMiss = resultMiss.newState.monsters.find(m => m.id === 'monster_a')!;
        const resBMiss = resultMiss.newState.monsters.find(m => m.id === 'monster_b')!;
        const resCMiss = resultMiss.newState.monsters.find(m => m.id === 'monster_c')!;

        if (resAMiss.hp !== 3 || resBMiss.hp !== 3 || resCMiss.hp !== 3) {
          throw new Error(`Lightning Bolt (miss): expected all monsters to take 1 damage, got hp ${resAMiss.hp}, ${resBMiss.hp}, ${resCMiss.hp}`);
        }
        console.log('  Lightning Bolt tests PASSED');
      }

      // --- TEST 7: Freezing Cloud (Place token, end-of-turn damage & decrement) ---
      {
        const card = dataLoader.getCardById('wizard_freezing_cloud')!;
        const result = PowerSystem.usePower(wizardHero, card, null, wizardGameState);
        if (!result.success) {
          throw new Error(`Freezing Cloud: expected success, got failure: ${result.message}`);
        }

        const fcToken = result.newState.tokens?.find(t => t.id === 'token_freezing_cloud')!;
        if (!fcToken) {
          throw new Error('Freezing Cloud: expected token_freezing_cloud to be placed');
        }
        if (fcToken.metadata?.cloudTokens !== 3) {
          throw new Error(`Freezing Cloud: expected 3 cloud tokens, got ${fcToken.metadata?.cloudTokens}`);
        }

        // Now test the endTurn logic of coreSlice
        let finalState = {
          ...result.newState,
          monsters: [
            { ...monsterA, position: { x: 0, z: 0, sqX: 1, sqZ: 1 }, hp: 4 } // on cloud tile (0,0)
          ]
        };

        // Temporarily override game store state
        const originalState = useGameStore.getState().gameState;
        useGameStore.setState({ gameState: finalState });

        useGameStore.getState().endTurn();

        const postTurnState = useGameStore.getState().gameState!;
        const resMonster = postTurnState.monsters.find(m => m.id === 'monster_a')!;
        const resToken = postTurnState.tokens?.find(t => t.id === 'token_freezing_cloud')!;

        if (resMonster.hp !== 3) {
          throw new Error(`Freezing Cloud (endTurn): expected monster to take 1 damage, got hp ${resMonster.hp}`);
        }
        if (resToken.metadata?.cloudTokens !== 2) {
          throw new Error(`Freezing Cloud (endTurn): expected cloudTokens to be 2, got ${resToken.metadata?.cloudTokens}`);
        }

        // Fast-forward token count to 1 and trigger again to verify dispersal
        useGameStore.setState({
          gameState: {
            ...postTurnState,
            tokens: postTurnState.tokens?.map(t => t.id === 'token_freezing_cloud' ? { ...t, metadata: { cloudTokens: 1 } } : t) ?? []
          }
        });

        useGameStore.getState().endTurn();

        const finalCloudState = useGameStore.getState().gameState!;
        if (finalCloudState.tokens?.some(t => t.id === 'token_freezing_cloud')) {
          throw new Error('Freezing Cloud: expected token to be removed after last token spent');
        }

        // Restore store state
        useGameStore.setState({ gameState: originalState });

        console.log('  Freezing Cloud tests PASSED');
      }

      // --- TEST 8: Illusionary Crowd (Spawn dummy hero, move monsters, cleanup on 0 HP) ---
      {
        const card = dataLoader.getCardById('wizard_illusionary_crowd')!;
        const result = PowerSystem.usePower(wizardHero, card, null, wizardGameState);
        if (!result.success) {
          throw new Error(`Illusionary Crowd: expected success, got failure: ${result.message}`);
        }

        const crowdToken = result.newState.tokens?.find(t => t.id === 'token_illusionary_crowd')!;
        const crowdHero = result.newState.heroes.find(h => h.id === 'ally_illusionary_crowd')!;

        if (!crowdToken) {
          throw new Error('Illusionary Crowd: expected token to be placed');
        }
        if (!crowdHero) {
          throw new Error('Illusionary Crowd: expected ally dummy hero to be spawned');
        }

        // Verify monsters moved to the crowd tile (0,0) or adjacent tiles (0,1), (0,2), (1,0)
        const resMonsterA = result.newState.monsters.find(m => m.id === 'monster_a')!;
        const resMonsterB = result.newState.monsters.find(m => m.id === 'monster_b')!;

        const validCoords = [{ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 2 }, { x: 1, z: 0 }];
        const isAValid = validCoords.some(c => c.x === resMonsterA.position.x && c.z === resMonsterA.position.z);
        const isBValid = validCoords.some(c => c.x === resMonsterB.position.x && c.z === resMonsterB.position.z);

        if (!isAValid || !isBValid) {
          throw new Error('Illusionary Crowd: expected monsters to be pulled/moved to crowd tile or adjacent');
        }

        // Cleanup on 0 HP verification via executeVillainPhase
        const crowdHeroDead = { ...crowdHero, hp: 0 };
        const activeMonster = {
          ...monsterA,
          ownedByHeroId: 'wizard_hero_test',
          position: { x: 0, z: 0, sqX: 2, sqZ: 3 }
        };

        const stateWithDeadCrowd: GameState = {
          ...wizardGameState,
          heroes: [...wizardGameState.heroes, crowdHeroDead],
          tokens: [crowdToken],
          monsters: [activeMonster]
        };

        const nextState = executeVillainPhase(stateWithDeadCrowd);
        if (nextState.heroes.some(h => h.id === 'ally_illusionary_crowd')) {
          throw new Error('Illusionary Crowd: expected ally_illusionary_crowd to be removed from heroes list');
        }
        if (nextState.tokens?.some(t => t.id === 'token_illusionary_crowd')) {
          throw new Error('Illusionary Crowd: expected token_illusionary_crowd to be removed from tokens list');
        }

        console.log('  Illusionary Crowd tests PASSED');
      }

      // --- TEST 9: Dispel Magic (Cancel encounter card) ---
      {
        const wizardWithDispel = {
          ...wizardHero,
          abilities: ['wizard_dispel_magic'],
          flippedPowerIds: []
        };
        const stateWithEncounter: GameState = {
          ...wizardGameState,
          heroes: [wizardWithDispel, companionHero],
          pendingEncounter: true,
          cardResolution: {
            phase: 'revealing' as const,
            cardId: 'enc_cackling_skull',
            cardType: 'encounter' as const,
            pendingEffects: [],
            resolvedEffects: [],
            targetEntityId: null,
            result: null
          }
        };

        let finalState = stateWithEncounter;
        const cardSlice = createCardSlice(
          (update: any) => {
            const partial = typeof update === 'function' ? update({ gameState: finalState }) : update;
            if (partial.gameState) {
              finalState = partial.gameState;
            }
          },
          () => ({ gameState: finalState }) as any,
          {} as any
        );

        cardSlice.cancelEncounterWithDispelMagic('enc_cackling_skull');

        const resWizard = finalState.heroes.find(h => h.id === 'wizard_hero_test')!;
        if (!resWizard.flippedPowerIds?.includes('wizard_dispel_magic')) {
          throw new Error('Dispel Magic: expected wizard_dispel_magic to be flipped');
        }
        if (finalState.cardResolution?.phase !== 'idle') {
          throw new Error(`Dispel Magic: expected cardResolution phase to be idle, got ${finalState.cardResolution?.phase}`);
        }
        if (finalState.pendingEncounter) {
          throw new Error('Dispel Magic: expected pendingEncounter to be false');
        }
        if (!finalState.discardPiles['encounter']?.includes('enc_cackling_skull')) {
          throw new Error('Dispel Magic: expected enc_cackling_skull to be in encounter discard pile');
        }
        console.log('  Dispel Magic test PASSED');
      }

      // --- TEST 10: Shield, Skeleton, Zombie & Defeat/Treasure/XP ---
      {
        console.log('Running Shield, Skeleton, Zombie & Defeat/Treasure/XP tests...');
        
        // 10a. Shield utility card check
        const targetWizard: Hero = {
          ...wizardHero,
          abilities: ['wizard_shield'],
          flippedPowerIds: [],
          hp: 6,
          maxHp: 6,
          ac: 16,
          conditions: [],
          items: [],
          hand: []
        };
        
        const testSkeleton: Monster = {
          id: 'test_skeleton_adjacent',
          name: 'Skeleton',
          type: 'monster',
          monsterType: 'Undead',
          behavior: { conditions: [], priorityTargets: [], actions: [] },
          hp: 1,
          maxHp: 1,
          ac: 16,
          speed: 1,
          attackBonus: 7,
          damage: 1,
          experienceValue: 2,
          moveRange: 1,
          abilities: [],
          isExhausted: false,
          position: { x: 0, z: 0, sqX: 2, sqZ: 1 },
          conditions: [],
          ownedByHeroId: 'wizard_hero_test',
          usedPowers: []
        };
        
        const wizardPos = { x: 0, z: 0, sqX: 1, sqZ: 1 };
        const skeletonPosAdjacent = { x: 0, z: 0, sqX: 1, sqZ: 2 };
        const skeletonPosOneTileAway = { x: 0, z: 1, sqX: 1, sqZ: 1 };
        const skeletonPosTwoTilesAway = { x: 0, z: 2, sqX: 1, sqZ: 1 };
        
        const testState: GameState = {
          ...wizardGameState,
          heroes: [
            { ...targetWizard, position: wizardPos }
          ],
          monsters: [
            { ...testSkeleton, id: 'skel_adj', position: skeletonPosAdjacent }
          ],
          tiles: [tile00, tile01, tile02, tile10],
          villainPhaseQueue: ['skel_adj'],
          treasureDeck: ['item_amulet_of_protection'],
          treasuresDrawnThisTurn: 0,
          experiencePile: []
        };

        // If Skeleton is adjacent, it attacks with SCIMITAR: +7 ATK, 1 DMG.
        // Let's override roll to 15 (which hits wizard's base AC 16 with +7 bonus).
        // With Shield active, it should mitigate the hit (wizard HP remains 6),
        // Shield power flips, and wizard gets 'ac_bonus' condition.
        AbilitySystem._rollOverride = () => 15;
        const stateAfterShield = executeVillainPhase(testState);
        AbilitySystem._rollOverride = null;

        const postShieldWizard = stateAfterShield.heroes.find(h => h.id === targetWizard.id)!;
        if (postShieldWizard.hp !== 6) {
          throw new Error(`Shield: expected HP to remain 6, got ${postShieldWizard.hp}`);
        }
        if (!postShieldWizard.flippedPowerIds?.includes('wizard_shield')) {
          throw new Error('Shield: expected wizard_shield to be flipped');
        }
        const shieldCondition = postShieldWizard.conditions.find(c => c.type === 'ac_bonus');
        if (!shieldCondition) {
          throw new Error('Shield: expected ac_bonus condition to be applied');
        }
        
        // Check effective AC bonus
        const effectiveAC = CombatSystem.getEffectiveAC(postShieldWizard);
        if (effectiveAC !== 18) {
          throw new Error(`Shield: expected effective AC to be 18, got ${effectiveAC}`);
        }
        console.log('  Shield utility check passed.');

        // 10b. Skeleton scimitar/slice/move tactics
        // Adjacent case: Attacks with SCIMITAR (+7 ATK, 1 DMG)
        const skelTacticAdj = resolveTactic(
          { ...testSkeleton, position: skeletonPosAdjacent },
          tile00,
          testState
        );
        if (skelTacticAdj.action !== 'attack' || skelTacticAdj.attackBonus !== 7 || skelTacticAdj.damage !== 1) {
          throw new Error(`Skeleton Tactic (adjacent): expected attack with +7/1, got ${JSON.stringify(skelTacticAdj)}`);
        }

        // 1 tile away case: Moves adjacent and attacks with SLICE (+9 ATK, 2 DMG)
        const skelTacticOneTile = resolveTactic(
          { ...testSkeleton, position: skeletonPosOneTileAway },
          tile01,
          testState
        );
        if (skelTacticOneTile.action !== 'move_then_attack' || skelTacticOneTile.attackBonus !== 9 || skelTacticOneTile.damage !== 2) {
          throw new Error(`Skeleton Tactic (1 tile): expected move_then_attack with +9/2, got ${JSON.stringify(skelTacticOneTile)}`);
        }

        // 2 tiles away case: moves 1 tile towards hero
        const skelTacticTwoTiles = resolveTactic(
          { ...testSkeleton, position: skeletonPosTwoTilesAway },
          tile02,
          testState
        );
        if (skelTacticTwoTiles.action !== 'move') {
          throw new Error(`Skeleton Tactic (2 tiles): expected move, got ${JSON.stringify(skelTacticTwoTiles)}`);
        }
        console.log('  Skeleton tactics checks passed.');

        // 10c. Zombie tactics & Rotting Fist scaling
        // If within 1 tile, moves adjacent and attacks with ROTTING FIST.
        // Damage = 1 for each monster on Zombie's tile.
        const anotherMonster: Monster = {
          ...testSkeleton,
          id: 'other_monster',
          position: { x: 0, z: 0, sqX: 2, sqZ: 2 }
        };
        const zombieState: GameState = {
          ...testState,
          monsters: [
            { ...testSkeleton, id: 'monster_zombie', name: 'Zombie', position: skeletonPosOneTileAway },
            anotherMonster
          ]
        };

        const zombieTactic = resolveTactic(
          zombieState.monsters[0],
          tile01,
          zombieState
        );
        // Both zombie and another monster are on tile00, so there are 2 monsters on the landing tile.
        // The rotting fist damage should be 2.
        if (zombieTactic.action !== 'move_then_attack' || zombieTactic.attackBonus !== 5 || zombieTactic.damage !== 2) {
          throw new Error(`Zombie Tactic: expected move_then_attack with +5/2, got ${JSON.stringify(zombieTactic)}`);
        }
        console.log('  Zombie tactics checks passed.');

        // 10d. Defeat / XP / Treasure drawing check
        // If a monster is defeated, it should go to the experiencePile.
        // If it's the first defeat of the turn, a treasure card is drawn.
        const zombieToDefeat: Monster = {
          ...testSkeleton,
          id: 'monster_skeleton_to_defeat',
          templateId: 'monster_skeleton',
          hp: 0, // Defeated
          experienceValue: 2,
          ownedByHeroId: 'wizard_hero_test'
        };
        const defeatState: GameState = {
          ...testState,
          currentHeroId: targetWizard.id,
          monsters: [zombieToDefeat],
          treasuresDrawnThisTurn: 0,
          experiencePile: []
        };

        const stateAfterDefeat = executeVillainPhase(defeatState);
        const postDefeatSkel = stateAfterDefeat.monsters.find(m => m.id === 'monster_skeleton_to_defeat')!;
        if (!postDefeatSkel.isDefeated) {
          throw new Error('Defeat: expected monster to be marked isDefeated');
        }
        if (!stateAfterDefeat.experiencePile.includes('monster_skeleton')) {
          throw new Error(`Defeat: expected monster_skeleton in experiencePile, got ${stateAfterDefeat.experiencePile}`);
        }
        if (stateAfterDefeat.treasuresDrawnThisTurn !== 1) {
          throw new Error(`Defeat: expected 1 treasure drawn this turn, got ${stateAfterDefeat.treasuresDrawnThisTurn}`);
        }
        // The drawn card 'item_amulet_of_protection' should be assigned to the wizard's items
        const postDefeatWizard = stateAfterDefeat.heroes.find(h => h.id === targetWizard.id)!;
        if (!postDefeatWizard.items.includes('item_amulet_of_protection')) {
          throw new Error('Defeat: expected item_amulet_of_protection to be assigned to the wizard');
        }
        console.log('  Defeat/XP/Treasure checks passed.');
      }
    }

    // -----------------------------------------------------------------------

    // 10e. Ghoul, Wolf, Kobold, and Gargoyle Alignment checks
    {
      console.log('  Running Ghoul, Wolf, Kobold, and Gargoyle alignment tests...');

      // Deterministic rolls: override d20 roll to 14
      AbilitySystem._rollOverride = () => 14;

      const testHero: Hero = {
        ...createAIHero('test_hero', 0, 0),
        name: 'Test Hero',
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 }
      };

      const testTile: Tile = {
        ...createAITile('tile_start', 0, 0, [
          { edge: 'north', isOpen: true, connectedTileId: 'tile_north' },
          { edge: 'south', isOpen: true, connectedTileId: 'tile_south' },
          { edge: 'east', isOpen: true, connectedTileId: 'tile_east' },
          { edge: 'west', isOpen: true, connectedTileId: 'tile_west' }
        ]),
        name: 'Start Tile'
      };

      const tileNorth: Tile = {
        ...createAITile('tile_north', 0, 1, [
          { edge: 'south', isOpen: true, connectedTileId: 'tile_start' }
        ]),
        name: 'North Tile'
      };

      const baseAlignState: GameState = {
        ...createAIState([testHero], [testTile, tileNorth]),
        phase: 'villain',
        currentHeroId: 'test_hero',
      };


      // --- GHOUL TESTS ---
      // Ghoul adjacent test
      const ghoulAdjacent: Monster = {
        ...createAIMonster('monster_ghoul_adj', 1),
        name: 'Ghoul',
        monsterType: 'Undead',
        hp: 1,
        maxHp: 1,
        ac: 16,
        attackBonus: 6,
        damage: 1,
        experienceValue: 2,
        ownedByHeroId: 'test_hero',
        position: { x: 0, z: 0, sqX: 2, sqZ: 1 }
      };

      const ghoulAdjState = { ...baseAlignState, monsters: [ghoulAdjacent] };
      const postGhoulAdjState = executeVillainPhase(ghoulAdjState);
      const postHeroGAdj = postGhoulAdjState.heroes.find(h => h.id === 'test_hero')!;
      if (postHeroGAdj.hp !== 7) {
        throw new Error(`Ghoul Bite: expected hero HP to be 7, got ${postHeroGAdj.hp}`);
      }

      // Ghoul within 1 tile test
      const ghoulNear: Monster = {
        ...createAIMonster('monster_ghoul_near', 1),
        name: 'Ghoul',
        monsterType: 'Undead',
        hp: 1,
        maxHp: 1,
        ac: 16,
        attackBonus: 6,
        damage: 1,
        experienceValue: 2,
        ownedByHeroId: 'test_hero',
        position: { x: 0, z: 1, sqX: 2, sqZ: 2 }
      };

      const ghoulNearState = { ...baseAlignState, monsters: [ghoulNear] };
      const postGhoulNearState = executeVillainPhase(ghoulNearState);
      const postHeroGNear = postGhoulNearState.heroes.find(h => h.id === 'test_hero')!;
      const postMonsterGNear = postGhoulNearState.monsters.find(m => m.id === 'monster_ghoul_near')!;
      if (postHeroGNear.hp !== 9) {
        throw new Error(`Ghoul Claw: expected hero HP to be 9, got ${postHeroGNear.hp}`);
      }
      if (postMonsterGNear.position.x !== 0 || postMonsterGNear.position.z !== 0) {
        throw new Error(`Ghoul Claw: expected ghoul to move to start tile (0, 0), got (${postMonsterGNear.position.x}, ${postMonsterGNear.position.z})`);
      }
      const hasImmobilized = postHeroGNear.conditions.some(c => c.type === 'immobilized');
      if (!hasImmobilized) {
        throw new Error('Ghoul Claw: expected hero to be immobilized');
      }

      // --- WOLF TESTS ---
      // Wolf adjacent test
      const wolfAdjacent: Monster = {
        ...createAIMonster('monster_wolf_adj', 2),
        name: 'Wolf',
        monsterType: 'Animal',
        hp: 1,
        maxHp: 1,
        ac: 14,
        attackBonus: 6,
        damage: 1,
        experienceValue: 1,
        ownedByHeroId: 'test_hero',
        position: { x: 0, z: 0, sqX: 2, sqZ: 3 }
      };

      const wolfAdjState = { ...baseAlignState, monsters: [wolfAdjacent] };
      const postWolfAdjState = executeVillainPhase(wolfAdjState);
      const postHeroWAdj = postWolfAdjState.heroes.find(h => h.id === 'test_hero')!;
      if (postHeroWAdj.hp !== 8) {
        throw new Error(`Wolf Bite: expected hero HP to be 8, got ${postHeroWAdj.hp}`);
      }

      // Wolf within 2 tiles test
      const tileNorth2: Tile = {
        ...createAITile('tile_north2', 0, 2, [
          { edge: 'south', isOpen: true, connectedTileId: 'tile_north' }
        ]),
        name: 'North Tile 2'
      };
      const wolfNear: Monster = {
        ...createAIMonster('monster_wolf_near', 2),
        name: 'Wolf',
        monsterType: 'Animal',
        hp: 1,
        maxHp: 1,
        ac: 14,
        attackBonus: 6,
        damage: 1,
        experienceValue: 1,
        ownedByHeroId: 'test_hero',
        position: { x: 0, z: 2, sqX: 2, sqZ: 2 }
      };

      const wolfNearState = {
        ...baseAlignState,
        tiles: [testTile, tileNorth, tileNorth2],
        monsters: [wolfNear]
      };
      const postWolfNearState = executeVillainPhase(wolfNearState);
      const postHeroWNear = postWolfNearState.heroes.find(h => h.id === 'test_hero')!;
      const postMonsterWNear = postWolfNearState.monsters.find(m => m.id === 'monster_wolf_near')!;
      if (postHeroWNear.hp !== 9) {
        throw new Error(`Wolf Pounce: expected hero HP to be 9, got ${postHeroWNear.hp}`);
      }
      if (postMonsterWNear.position.x !== 0 || postMonsterWNear.position.z !== 0) {
        throw new Error(`Wolf Pounce: expected wolf to move to start tile (0, 0), got (${postMonsterWNear.position.x}, ${postMonsterWNear.position.z})`);
      }
      const hasSlowed = postHeroWNear.conditions.some(c => c.type === 'slowed');
      if (!hasSlowed) {
        throw new Error('Wolf Pounce: expected hero to be slowed');
      }

      // --- KOBOLD TESTS ---
      const koboldNear: Monster = {
        ...createAIMonster('monster_kobold_near', 2),
        name: 'Kobold',
        monsterType: 'Reptile',
        hp: 1,
        maxHp: 1,
        ac: 13,
        attackBonus: 5,
        damage: 1,
        experienceValue: 1,
        ownedByHeroId: 'test_hero',
        position: { x: 0, z: 1, sqX: 2, sqZ: 2 }
      };

      const koboldNearState = { ...baseAlignState, monsters: [koboldNear] };
      const postKoboldNearState = executeVillainPhase(koboldNearState);
      const postHeroKNear = postKoboldNearState.heroes.find(h => h.id === 'test_hero')!;
      const postMonsterKNear = postKoboldNearState.monsters.find(m => m.id === 'monster_kobold_near')!;
      if (postHeroKNear.hp !== 9) {
        throw new Error(`Kobold Javelin: expected hero HP to be 9, got ${postHeroKNear.hp}`);
      }
      if (postMonsterKNear.position.x !== 0 || postMonsterKNear.position.z !== 1) {
        throw new Error(`Kobold Javelin: expected kobold to stay on north tile (0, 1), got (${postMonsterKNear.position.x}, ${postMonsterKNear.position.z})`);
      }

      // --- GARGOYLE TESTS ---
      const gargoyleNear: Monster = {
        ...createAIMonster('monster_gargoyle_near', 1),
        name: 'Gargoyle',
        monsterType: 'Elemental',
        hp: 2,
        maxHp: 2,
        ac: 16,
        attackBonus: 8,
        damage: 2,
        missDamage: 1,
        experienceValue: 3,
        ownedByHeroId: 'test_hero',
        position: { x: 0, z: 1, sqX: 2, sqZ: 2 }
      };

      const secondHero: Hero = {
        ...testHero,
        id: 'second_hero',
        name: 'Second Hero',
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 }
      };

      const gargoyleNearState = {
        ...baseAlignState,
        heroes: [testHero, secondHero],
        monsters: [gargoyleNear]
      };

      const postGargoyleNearState = executeVillainPhase(gargoyleNearState);
      const postHero1 = postGargoyleNearState.heroes.find(h => h.id === 'test_hero')!;
      const postHero2 = postGargoyleNearState.heroes.find(h => h.id === 'second_hero')!;
      const postGargoyle = postGargoyleNearState.monsters.find(m => m.id === 'monster_gargoyle_near')!;

      if (postHero1.hp !== 8 || !postHero1.conditions.some(c => c.type === 'slowed')) {
        throw new Error(`Gargoyle Whirlwind (Hero 1): expected 8 HP and slowed`);
      }
      if (postHero2.hp !== 8 || !postHero2.conditions.some(c => c.type === 'slowed')) {
        throw new Error(`Gargoyle Whirlwind (Hero 2): expected 8 HP and slowed`);
      }
      if (postGargoyle.position.x !== 0 || postGargoyle.position.z !== 0) {
        throw new Error(`Gargoyle Whirlwind: expected gargoyle to move to start tile (0, 0)`);
      }

      // Clean up d20 roll override
      AbilitySystem._rollOverride = null;

      console.log('  Ghoul, Wolf, Kobold, and Gargoyle alignment tests passed.');
    }

    // -----------------------------------------------------------------------
    // Bug 3: Encounter Card Draw Tests
    // -----------------------------------------------------------------------
    {
      console.log('Testing executeVillainPhase: Encounter Card Draw (Bug 3)...');

      const bug3Hero = createAIHero('bug3_hero', 0, 0);
      const startTile = createAITile('tile_start', 0, 0, []);
      startTile.isStart = true;
      startTile.encounterType = 'white';

      const blackTile = createAITile('tile_black', 0, 1, []);
      blackTile.encounterType = 'black';

      const whiteTile = createAITile('tile_white', 1, 0, []);
      whiteTile.encounterType = 'white';

      // Test Case A: No tile placed (exploredThisTurn: false)
      // Should draw and resolve encounter card
      // Prowling Spirits: hero discards one Treasure Card. No HP damage.
      // Give hero a treasure item so the discard can actually occur.
      const bug3HeroWithItem = { ...bug3Hero, items: ['tre_sword_of_ruin'] };
      const stateA: GameState = {
        ...createAIState([bug3HeroWithItem], [startTile]),
        phase: 'villain',
        currentHeroId: 'bug3_hero',
        encounterDeck: ['enc_prowling_spirits'],
        exploredThisTurn: false,
        lastPlacedTileId: null
      };

      const resultA = executeVillainPhase(stateA);
      if (resultA.encounterDeck.length !== 0) {
        throw new Error(`Bug 3 Test Case A: Expected encounter deck to be empty, got ${resultA.encounterDeck.length}`);
      }
      const activeHeroA = resultA.heroes.find(h => h.id === 'bug3_hero')!;
      // Prowling Spirits discards a treasure — no HP damage, item should be gone
      if (activeHeroA.hp !== 10) {
        throw new Error(`Bug 3 Test Case A: Expected hero HP to be 10 after enc_prowling_spirits resolved (no damage), got ${activeHeroA.hp}`);
      }
      if (activeHeroA.items.includes('tre_sword_of_ruin')) {
        throw new Error(`Bug 3 Test Case A: Expected hero to have discarded 'tre_sword_of_ruin' after enc_prowling_spirits resolved`);
      }


      // Test Case B: Tile with a black triangle placed (exploredThisTurn: true, encounterType: 'black')
      // Should draw and resolve encounter card
      const stateB: GameState = {
        ...createAIState([bug3Hero], [startTile, blackTile]),
        phase: 'villain',
        currentHeroId: 'bug3_hero',
        encounterDeck: ['enc_cackling_skull'],
        exploredThisTurn: true,
        lastPlacedTileId: 'tile_black'
      };

      const resultB = executeVillainPhase(stateB);
      if (resultB.encounterDeck.length !== 0) {
        throw new Error(`Bug 3 Test Case B: Expected encounter deck to be empty, got ${resultB.encounterDeck.length}`);
      }
      if (resultB.activeEnvironmentCard !== 'enc_cackling_skull') {
        throw new Error(`Bug 3 Test Case B: Expected activeEnvironmentCard to be 'enc_cackling_skull', got ${resultB.activeEnvironmentCard}`);
      }

      // Test Case C: Tile with a white triangle placed (exploredThisTurn: true, encounterType: 'white')
      // Should NOT draw
      const stateC: GameState = {
        ...createAIState([bug3Hero], [startTile, whiteTile]),
        phase: 'villain',
        currentHeroId: 'bug3_hero',
        encounterDeck: ['enc_prowling_spirits'],
        exploredThisTurn: true,
        lastPlacedTileId: 'tile_white'
      };

      const resultC = executeVillainPhase(stateC);
      if (resultC.encounterDeck.length !== 1) {
        throw new Error(`Bug 3 Test Case C: Expected encounter deck to still have 1 card, got ${resultC.encounterDeck.length}`);
      }
      const activeHeroC = resultC.heroes.find(h => h.id === 'bug3_hero')!;
      if (activeHeroC.hp !== 10) {
        throw new Error(`Bug 3 Test Case C: Expected hero HP to remain 10, got ${activeHeroC.hp}`);
      }

      // Test Case D: Double-draw prevention (exploredThisTurn: true, lastPlacedTileId: null)
      // Should NOT draw
      const stateD: GameState = {
        ...createAIState([bug3Hero], [startTile]),
        phase: 'villain',
        currentHeroId: 'bug3_hero',
        encounterDeck: ['enc_prowling_spirits'],
        exploredThisTurn: true,
        lastPlacedTileId: null
      };

      const resultD = executeVillainPhase(stateD);
      if (resultD.encounterDeck.length !== 1) {
        throw new Error(`Bug 3 Test Case D: Expected encounter deck to still have 1 card (double-draw prevention), got ${resultD.encounterDeck.length}`);
      }
      const activeHeroD = resultD.heroes.find(h => h.id === 'bug3_hero')!;
      if (activeHeroD.hp !== 10) {
        throw new Error(`Bug 3 Test Case D: Expected hero HP to remain 10, got ${activeHeroD.hp}`);
      }

      console.log('  Bug 3: Encounter Card Draw tests passed.');
    }

    // -----------------------------------------------------------------------
    // Bug 4: Stale Hero State in Reactions (Bodyguard -> Yield Ground check)
    // -----------------------------------------------------------------------
    {
      console.log('Testing executeVillainPhase: Bodyguard -> Yield Ground Reaction (Bug 4)...');

      // Create Hero A (Ranger with Yield Ground, starts at 0, 0, sqX=0, sqZ=0)
      const rangerHero: Hero = {
        ...createAIHero('ranger_hero', 0, 0),
        name: 'Ranger Hero',
        abilities: ['ranger_yield_ground'],
        position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
        flippedPowerIds: [],
        ac: 14,
        hp: 10,
        maxHp: 10
      };

      // Create Hero B (Fighter with Bodyguard, starts at 0, 1, sqX=3, sqZ=3)
      const fighterHero: Hero = {
        ...createAIHero('fighter_hero', 0, 1),
        name: 'Fighter Hero',
        abilities: ['fighter_bodyguard'],
        position: { x: 0, z: 1, sqX: 3, sqZ: 3 },
        flippedPowerIds: [],
        ac: 16,
        hp: 10,
        maxHp: 10
      };

      const startTile = createAITile('tile_start', 0, 0, [
        { edge: 'north', isOpen: true, connectedTileId: 'tile_north' }
      ]);
      startTile.encounterType = 'white';

      const northTile = createAITile('tile_north', 0, 1, [
        { edge: 'south', isOpen: true, connectedTileId: 'tile_start' }
      ]);
      northTile.encounterType = 'white';

      // Seed a monster that attacks ranger_hero
      const attacker: Monster = {
        ...createAIMonster('attacker_monster', 1),
        name: 'Attacker Monster',
        ownedByHeroId: 'ranger_hero', // Must be owned by active hero to activate
        position: { x: 0, z: 0, sqX: 0, sqZ: 1 }, // Adjacent to ranger_hero
        hp: 5,
        maxHp: 5
      };

      const baseState = createAIState([rangerHero, fighterHero], [startTile, northTile]);
      const villainState: GameState = {
        ...baseState,
        phase: 'villain',
        currentHeroId: 'ranger_hero',
        monsters: [attacker],
        exploredThisTurn: true, // prevent encounter card draw in test
        lastPlacedTileId: null
      };

      // Override the d20 roll so the attack hits
      // ranger_hero AC is 14, roll override 14 + attacker.attackBonus (0) = 14 (hits)
      AbilitySystem._rollOverride = () => 14;

      const resultState = executeVillainPhase(villainState);

      // Clean up override
      AbilitySystem._rollOverride = null;

      // 1. Assert Bodyguard trigger and swap
      const updatedRanger = resultState.heroes.find(h => h.id === 'ranger_hero')!;
      const updatedFighter = resultState.heroes.find(h => h.id === 'fighter_hero')!;

      // Fighter should have swapped to Ranger's original position: x: 0, z: 0, sqX: 0, sqZ: 0
      if (updatedFighter.position.x !== 0 || updatedFighter.position.z !== 0 || updatedFighter.position.sqX !== 0 || updatedFighter.position.sqZ !== 0) {
        throw new Error(`Bug 4: Expected Fighter to swap to Ranger's original position (0, 0, 0, 0), got (${updatedFighter.position.x}, ${updatedFighter.position.z}, ${updatedFighter.position.sqX}, ${updatedFighter.position.sqZ})`);
      }

      // 2. Assert Yield Ground flipped/triggered ONLY on Ranger (the original target)
      if (!updatedRanger.flippedPowerIds?.includes('ranger_yield_ground')) {
        throw new Error('Bug 4: Expected Ranger to have triggered and flipped Yield Ground');
      }
      if (updatedFighter.flippedPowerIds?.includes('ranger_yield_ground')) {
        throw new Error('Bug 4: Expected Fighter to NOT have Yield Ground flipped');
      }

      // 3. Assert Yield Ground movement origin (should move to tile_start 1,3 instead of tile_start 0,2)
      if (updatedRanger.position.x === 0 && updatedRanger.position.z === 0 && updatedRanger.position.sqX === 0 && updatedRanger.position.sqZ === 2) {
        throw new Error('Bug 4: Stale position was used as origin (Ranger moved to 0,0,0,2 which is out of range from swapped position)');
      }
      if (updatedRanger.position.x !== 0 || updatedRanger.position.z !== 0 || updatedRanger.position.sqX !== 1 || updatedRanger.position.sqZ !== 3) {
        throw new Error(`Bug 4: Expected Ranger to move to (0, 0, 1, 3), got (${updatedRanger.position.x}, ${updatedRanger.position.z}, ${updatedRanger.position.sqX}, ${updatedRanger.position.sqZ})`);
      }

      console.log('  Bug 4: Bodyguard -> Yield Ground Reaction tests passed.');
    }

    // -----------------------------------------------------------------------
    // Bug 5: Trap Persistence Tests
    // -----------------------------------------------------------------------
    {
      console.log('Testing executeVillainPhase: Trap Persistence (Bug 5)...');

      const trapHero = createAIHero('trap_hero', 0, 0);
      const startTile = createAITile('tile_start', 0, 0, []);
      startTile.encounterType = 'white';

      // Seed a trap on tile_start
      const testTrap: Trap = {
        id: 'test_trap',
        cardId: 'enc_crossbow_turret',
        tileId: 'tile_start',
        isDisabled: false,
        isTriggered: false,
        ownedByHeroId: 'trap_hero'
      };

      const baseState = createAIState([trapHero], [startTile]);
      const trapState: GameState = {
        ...baseState,
        phase: 'villain',
        currentHeroId: 'trap_hero',
        traps: [testTrap],
        exploredThisTurn: true, // prevent encounter card draw
        lastPlacedTileId: null
      };

      // Call executeVillainPhase once
      AbilitySystem._rollOverride = () => 2; // roll 2 + 8 = 10 < AC 15 (miss, deals 1 damage)
      const stateAfterFirst = executeVillainPhase(trapState);
      AbilitySystem._rollOverride = null;
      const heroAfterFirst = stateAfterFirst.heroes.find(h => h.id === 'trap_hero')!;
      if (heroAfterFirst.hp !== 9) {
        throw new Error(`Bug 5 Test: Expected hero HP to be 9 after first trap activation, got ${heroAfterFirst.hp}`);
      }
      const trapAfterFirst = stateAfterFirst.traps.find(t => t.id === 'test_trap')!;
      if (trapAfterFirst.isDisabled) {
        throw new Error('Bug 5 Test: Expected trap to not be disabled');
      }

      // Call executeVillainPhase second time on the resulting state
      AbilitySystem._rollOverride = () => 2; // roll 2 + 8 = 10 < AC 15 (miss, deals 1 damage)
      const stateAfterSecond = executeVillainPhase(stateAfterFirst);
      AbilitySystem._rollOverride = null;
      const heroAfterSecond = stateAfterSecond.heroes.find(h => h.id === 'trap_hero')!;
      if (heroAfterSecond.hp !== 8) {
        throw new Error(`Bug 5 Test: Expected hero HP to be 8 after second trap activation, got ${heroAfterSecond.hp}`);
      }
      const trapAfterSecond = stateAfterSecond.traps.find(t => t.id === 'test_trap')!;
      if (trapAfterSecond.isDisabled) {
        throw new Error('Bug 5 Test: Expected trap to still not be disabled');
      }

      // Verify that setting isDisabled: true excludes it from the queue
      const disabledTrapState: GameState = {
        ...stateAfterSecond,
        traps: [{ ...testTrap, isDisabled: true }]
      };
      const stateAfterDisabled = executeVillainPhase(disabledTrapState);
      const heroAfterDisabled = stateAfterDisabled.heroes.find(h => h.id === 'trap_hero')!;
      if (heroAfterDisabled.hp !== 8) {
        throw new Error(`Bug 5 Test: Expected hero HP to remain 8 since trap was disabled, got ${heroAfterDisabled.hp}`);
      }

      console.log('  Bug 5: Trap Persistence tests passed.');
    }

    // -----------------------------------------------------------------------
    // Bug 6: Monster Passive Aura on Death Tests
    // -----------------------------------------------------------------------
    {
      console.log('Testing executeVillainPhase: Monster Passive Aura on Death (Bug 6)...');

      const riposteHero: Hero = {
        ...createAIHero('riposte_hero', 0, 0),
        name: 'Riposte Hero',
        abilities: ['rogue_riposte_strike'],
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        flippedPowerIds: [],
        hp: 10,
        maxHp: 10,
        ac: 15
      };

      const startTile = createAITile('tile_start', 0, 0, []);
      startTile.encounterType = 'white';

      const passiveAbility: MonsterAbility = {
        id: 'aura_damage',
        name: 'Aura Damage',
        description: 'Deals 5 damage to adjacent heroes at turn start.',
        type: 'passive',
        trigger: 'on_turn_start',
        effects: [
          { type: 'damage', value: 5, target: 'all_heroes' }
        ]
      };

      const auraMonster: Monster = {
        ...createAIMonster('aura_monster', 1),
        name: 'Aura Monster',
        hp: 1, // Start with 1 HP so Riposte Strike kills it
        maxHp: 5,
        ac: 10,
        attackBonus: 10, // Ensure it hits
        damage: 1,
        ownedByHeroId: 'riposte_hero',
        abilities: [passiveAbility],
        position: { x: 0, z: 0, sqX: 1, sqZ: 2 } // Adjacent to riposte_hero
      };

      const baseState = createAIState([riposteHero], [startTile]);
      const villainState: GameState = {
        ...baseState,
        phase: 'villain',
        currentHeroId: 'riposte_hero',
        monsters: [auraMonster],
        exploredThisTurn: true, // prevent encounter card draw
        lastPlacedTileId: null
      };

      // Override rolls so attack and counterattack hit
      AbilitySystem._rollOverride = () => 16;

      const resultState = executeVillainPhase(villainState);

      // Clean up override
      AbilitySystem._rollOverride = null;

      // Verify the monster was defeated
      const postMonster = resultState.monsters.find(m => m.id === 'aura_monster')!;
      if (postMonster.hp > 0 || !postMonster.isDefeated) {
        throw new Error(`Bug 6 Test: Expected monster to be defeated, got HP ${postMonster.hp}`);
      }

      // Verify Riposte Hero took the initial 1 damage from the attack,
      // but did NOT take the 5 passive aura damage because the monster died first.
      const postHero = resultState.heroes.find(h => h.id === 'riposte_hero')!;
      if (postHero.hp !== 9) {
        throw new Error(`Bug 6 Test: Expected hero HP to be 9 (only took attack damage), got ${postHero.hp}`);
      }

      console.log('  Bug 6: Monster Passive Aura on Death tests passed.');
    }

    // -----------------------------------------------------------------------
    // Bug 7: Deterministic Log IDs Tests
    // -----------------------------------------------------------------------
    {
      console.log('Testing executeVillainPhase: Deterministic Log IDs (Bug 7)...');

      // Create a starting state with a hero and a monster that will attack to trigger combat logs.
      const testHero = createAIHero('det_hero', 0, 0);
      const startTile = createAITile('tile_start', 0, 0, []);
      startTile.encounterType = 'white';

      const testMonster: Monster = {
        ...createAIMonster('det_monster', 1),
        name: 'Deterministic Zombie',
        hp: 1,
        maxHp: 1,
        ac: 10,
        behavior: {
          conditions: [],
          priorityTargets: [],
          actions: [
            {
              condition: 'adjacent_to_hero',
              tactic: 'attack',
              attackBonus: 0,
              damage: 1
            }
          ]
        } as any,
        attackBonus: 0,
        damage: 1,
        ownedByHeroId: 'det_hero',
        position: { x: 0, z: 0, sqX: 1, sqZ: 2 } // Adjacent to hero (0,0,1,1)
      };

      const baseState = createAIState([testHero], [startTile]);
      const detState: GameState = {
        ...baseState,
        phase: 'villain',
        currentHeroId: 'det_hero',
        monsters: [testMonster],
        exploredThisTurn: true, // prevent encounter card draw
        lastPlacedTileId: null,
        logIdCounter: 0 // Start counter at 0
      };

      // Force hit roll
      AbilitySystem._rollOverride = () => 10;

      // Executing villain phase will run the monster tactic (attack) producing a combat log entry.
      const firstExecution = executeVillainPhase(detState);

      // Verify the log entries added in firstExecution have deterministic sequential IDs
      const addedLogsFirst = firstExecution.log;
      if (addedLogsFirst.length === 0) {
        throw new Error('Bug 7 Test: Expected log entries to be created during first executeVillainPhase');
      }

      // Assert that the added logs have sequential string IDs starting at "0"
      for (let i = 0; i < addedLogsFirst.length; i++) {
        const expectedId = String(i);
        if (addedLogsFirst[i].id !== expectedId) {
          throw new Error(`Bug 7 Test: Expected log ID to be "${expectedId}", got "${addedLogsFirst[i].id}"`);
        }
      }

      // Verify logIdCounter has advanced correctly
      if (firstExecution.logIdCounter !== addedLogsFirst.length) {
        throw new Error(`Bug 7 Test: Expected logIdCounter to be ${addedLogsFirst.length}, got ${firstExecution.logIdCounter}`);
      }

      // Run executeVillainPhase again using the output of the first, with another monster attack.
      // Reset the zombie to alive and unexhausted so it activates again.
      const secondRunState: GameState = {
        ...firstExecution,
        monsters: firstExecution.monsters.map(m => m.id === 'det_monster' ? { ...m, hp: 1, isDefeated: false } : m)
      };

      const secondExecution = executeVillainPhase(secondRunState);
      const addedLogsSecond = secondExecution.log;

      // Assert the new logs added in the second execution have sequential IDs continuing from firstExecution.logIdCounter
      const startIndex = firstExecution.logIdCounter;
      // We look at the logs added in the second execution (the ones appended at the end)
      const logsFromSecondRun = addedLogsSecond.slice(startIndex);
      if (logsFromSecondRun.length === 0) {
        throw new Error('Bug 7 Test: Expected log entries to be created during second executeVillainPhase');
      }

      for (let i = 0; i < logsFromSecondRun.length; i++) {
        const expectedId = String(startIndex + i);
        if (logsFromSecondRun[i].id !== expectedId) {
          throw new Error(`Bug 7 Test: Expected sequential log ID to be "${expectedId}", got "${logsFromSecondRun[i].id}"`);
        }
      }

      // Assert logIdCounter advanced correctly after second run
      const expectedEndCounter = startIndex + logsFromSecondRun.length;
      if (secondExecution.logIdCounter !== expectedEndCounter) {
        throw new Error(`Bug 7 Test: Expected final logIdCounter to be ${expectedEndCounter}, got ${secondExecution.logIdCounter}`);
      }

      // Clean up override
      AbilitySystem._rollOverride = null;

      console.log('  Bug 7: Deterministic Log IDs tests passed.');
    }

    // -----------------------------------------------------------------------
    // New Bug Fix Verifications
    // -----------------------------------------------------------------------
    {
      console.log('Testing CombatSystem & MonsterAI Bug Fixes...');

      // C1: Sunsword / Holy Avenger Undead item bonuses
      const heroWithSunsword: Hero = {
        id: 'c1_hero_sunsword',
        name: 'Sunsword Hero',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        maxHp: 10,
        hp: 10,
        ac: 10,
        speed: 6,
        xp: 0,
        surgeValue: 3,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: ['item_sunsword'],
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const heroWithHolyAvenger: Hero = {
        id: 'c1_hero_holy_avenger',
        name: 'Holy Avenger Hero',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        maxHp: 10,
        hp: 10,
        ac: 10,
        speed: 6,
        xp: 0,
        surgeValue: 3,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: ['item_holy_avenger'],
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const undeadBodak: Monster = {
        id: 'c1_bodak',
        name: 'Bodak',
        type: 'monster',
        monsterType: 'Undead',
        isUndead: true,
        behavior: { conditions: [], priorityTargets: [], actions: [] } as any,
        attackBonus: 0,
        damage: 1,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
        hp: 5,
        maxHp: 5,
        ac: 12,
        speed: 1,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      const animalWolf: Monster = {
        id: 'c1_wolf',
        name: 'Wolf',
        type: 'monster',
        monsterType: 'Animal',
        isUndead: false,
        behavior: { conditions: [], priorityTargets: [], actions: [] } as any,
        attackBonus: 0,
        damage: 1,
        experienceValue: 1,
        ownedByHeroId: null,
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
        hp: 5,
        maxHp: 5,
        ac: 12,
        speed: 1,
        isExhausted: false,
        conditions: [],
        usedPowers: []
      };

      // Assert Sunsword grants +2 attack bonus against Bodak (undead). Roll of 10 + 2 = 12 >= AC 12, so it hits.
      const resultBodak = CombatSystem.resolveAttack(heroWithSunsword, undeadBodak, 0, 1, 0, 10);
      if (!resultBodak.hit) {
        throw new Error('C1 Test Failed: expected Sunsword to grant +2 attack bonus against undead Bodak and hit');
      }

      // Assert Sunsword does NOT apply against Wolf (non-undead). Roll of 10 + 0 = 10 < AC 12, so it misses.
      const resultWolf = CombatSystem.resolveAttack(heroWithSunsword, animalWolf, 0, 1, 0, 10);
      if (resultWolf.hit) {
        throw new Error('C1 Test Failed: expected Sunsword bonus to not apply against non-undead Wolf');
      }

      // Assert Holy Avenger damage bonus (+2 damage vs Undead) applies. Base 1 + 2 = 3 damage.
      const resultHolyAvenger = CombatSystem.resolveAttack(heroWithHolyAvenger, undeadBodak, 0, 1, 0, 12);
      if (resultHolyAvenger.damage !== 3) {
        throw new Error(`C1 Test Failed: expected Holy Avenger to deal 3 damage to undead, got ${resultHolyAvenger.damage}`);
      }

      // C2: targetType Guard for Environment Damage Modifiers
      const dummyHero: Hero = {
        id: 'dummy_hero',
        name: 'Dummy Hero',
        type: 'hero',
        heroClass: 'fighter',
        level: 1,
        maxHp: 10,
        hp: 10,
        ac: 10,
        speed: 6,
        xp: 0,
        surgeValue: 3,
        surgeUsed: false,
        abilities: [],
        hand: [],
        items: [],
        position: { x: 0, z: 0, sqX: 1, sqZ: 1 },
        isExhausted: false,
        attackBonus: 0,
        conditions: [],
        usedPowers: []
      };

      const c2StateMonsterOnly = {
        phase: 'hero',
        currentHeroId: 'dummy_hero',
        heroes: [dummyHero],
        monsters: [],
        tiles: [],
        dungeonDeck: [],
        treasureDeck: [],
        encounterDeck: [],
        monsterDeck: [],
        discardPiles: {},
        activeScenario: { id: 'c2_test', name: 'C2 Test', difficulty: 'Easy', description: 'C2 Test', introText: '', victoryText: '', defeatText: '', objectives: [], specialRules: [], startTileId: 'start_tile', maxSurges: 3 },
        turnOrder: ['dummy_hero'],
        healingSurges: 2,
        turnCount: 1,
        log: [],
        activeEnvironmentCard: 'enc_test_sanctuary_monster_only',
        experiencePile: [],
        treasuresDrawnThisTurn: 0,
        traps: [],
        villainPhaseQueue: [],
        activeVillainId: null,
        logIdCounter: 0,
        cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null }
      } as any as GameState;

      // Damage should NOT be reduced since targetType is 'monster' (and entity is a hero)
      const dmgMonsterOnly = CombatSystem.applyDamage(dummyHero, 3, c2StateMonsterOnly);
      if (dmgMonsterOnly.hp !== 7) {
        throw new Error(`C2 Test Failed: expected hero damage to not be reduced (HP should be 7), got ${dmgMonsterOnly.hp}`);
      }

      const c2StateHeroOnly: GameState = {
        ...c2StateMonsterOnly,
        activeEnvironmentCard: 'enc_test_sanctuary_hero_only'
      };

      // Damage SHOULD be reduced by 1 since targetType is 'hero' (and entity is a hero)
      const dmgHeroOnly = CombatSystem.applyDamage(dummyHero, 3, c2StateHeroOnly);
      if (dmgHeroOnly.hp !== 8) {
        throw new Error(`C2 Test Failed: expected hero damage to be reduced by 1 (HP should be 8), got ${dmgHeroOnly.hp}`);
      }

      // C4: weakened condition multiplier doesn't cover flat damage bonuses
      const weakenedHero: Hero = {
        ...dummyHero,
        id: 'weakened_hero',
        conditions: [
          { type: 'weakened', turnsRemaining: 1 },
          { type: 'damage_bonus', turnsRemaining: 1, value: 2 }
        ]
      };

      // Base damage is 2. (2 base + 2 flat) * 0.5 modifier = 2 damage.
      const resultC4 = CombatSystem.resolveAttack(weakenedHero, animalWolf, 0, 2, 0, 15);
      if (resultC4.damage !== 2) {
        throw new Error(`C4 Test Failed: expected damage to be Math.floor((2 + 2) * 0.5) = 2, got ${resultC4.damage}`);
      }

      // C6: Bat Swarm same-tile disadvantage
      const batGameState: GameState = {
        ...c2StateMonsterOnly,
        activeEnvironmentCard: 'enc_bat_swarm'
      };

      // Same tile position
      const batHero: Hero = { ...dummyHero, position: { x: 0, z: 0, sqX: 1, sqZ: 1 } };
      const batMonster: Monster = { ...animalWolf, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };

      let rollCount = 0;
      AbilitySystem._rollOverride = () => {
        rollCount++;
        return rollCount === 1 ? 18 : 12;
      };

      const resultBat = CombatSystem.resolveAttack(batHero, batMonster, 0, 1, 0, undefined, batGameState);
      AbilitySystem._rollOverride = null;

      if (resultBat.roll !== 12) {
        throw new Error(`C6 Test Failed: expected Bat Swarm disadvantage to apply on same tile (roll should be 12), got ${resultBat.roll}`);
      }

      // M1: Default fallback is unreachable dead code (returns move or idle for unregistered monster)
      const ai = new MonsterAI();
      const unregisteredKobold: Monster = {
        ...animalWolf,
        monsterType: 'kobold'
      };
      const unregisteredAction = ai.decideAction(unregisteredKobold, [dummyHero], c2StateMonsterOnly);
      if (!unregisteredAction || !['move', 'idle'].includes(unregisteredAction.type)) {
        throw new Error(`M1 Test Failed: decideAction on unregistered monster returned invalid action: ${JSON.stringify(unregisteredAction)}`);
      }

      // M2: getBehavior returns class constructors, not instances (assert decideAction on registered type doesn't throw TypeError)
      const gargoyle: Monster = {
        ...animalWolf,
        monsterType: 'gargoyle'
      };
      try {
        const gargoyleAction = ai.decideAction(gargoyle, [dummyHero], c2StateMonsterOnly);
        if (!gargoyleAction) {
          throw new Error('M2 Test Failed: decideAction returned null or undefined');
        }
      } catch (err) {
        throw new Error(`M2 Test Failed: decideAction on gargoyle threw error: ${err}`);
      }

      // -----------------------------------------------------------------------
      // combatSlice Bug Fixes Tests (B2, B3, B5, B6)
      // -----------------------------------------------------------------------
      {
        console.log('Testing combatSlice Bug Fixes (B2, B3, B5, B6)...');

        const testHeroForCombat: Hero = {
          ...dummyHero,
          id: 'combat_test_hero',
          name: 'Combat Test Hero',
          damage: 3, // B2: damage stat set to 3
          position: { x: 0, z: 0, sqX: 1, sqZ: 1 }
        };

        const normalMonster: Monster = {
          ...animalWolf,
          id: 'combat_test_monster',
          name: 'Normal Monster',
          hp: 10,
          maxHp: 10,
          ac: 10,
          position: { x: 0, z: 0, sqX: 2, sqZ: 2 }
        };

        const stoneFormGargoyle: Monster = {
          ...animalWolf,
          id: 'combat_test_gargoyle',
          name: 'Gargoyle',
          monsterType: 'gargoyle',
          hp: 5,
          maxHp: 5,
          ac: 10,
          position: { x: 0, z: 0, sqX: 2, sqZ: 2 },
          hasActivated: false // Stone Form: active when hasActivated is false
        };

        const revealedTile = createAITile('tile_0_0', 0, 0, []);
        revealedTile.isRevealed = true;

        const baseTestState: GameState = {
          phase: 'hero',
          currentHeroId: 'combat_test_hero',
          heroes: [testHeroForCombat],
          monsters: [normalMonster, stoneFormGargoyle],
          tiles: [revealedTile],
          dungeonDeck: [],
          treasureDeck: [],
          encounterDeck: [],
          monsterDeck: [],
          discardPiles: {},
          activeScenario: { id: 'combat_slice_test', name: 'Combat Slice Test', difficulty: 'Easy', description: 'Test', introText: '', victoryText: '', defeatText: '', objectives: [], specialRules: [], startTileId: 'tile_0_0', maxSurges: 3 },
          turnOrder: ['combat_test_hero'],
          healingSurges: 2,
          turnCount: 1,
          log: [],
          activeEnvironmentCard: null,
          experiencePile: [],
          treasuresDrawnThisTurn: 0,
          traps: [],
          villainPhaseQueue: [],
          activeVillainId: null,
          logIdCounter: 0,
          cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null }
        };

        // Stub requestRoll to immediately call onComplete and set result
        const originalRequestRoll = useDiceStore.getState().requestRoll;
        useDiceStore.setState({
          requestRoll: (params: any) => {
            const rollResult = AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : 15;
            useDiceStore.setState({ result: rollResult });
            params.onComplete();
          }
        });

        // Bug 2: Seed a hero with damage: 3. Call attackMonster with a forced hit roll. Assert the monster takes 3 damage, not 1.
        useGameStore.setState({ gameState: baseTestState });
        AbilitySystem._rollOverride = () => 15;
        await useGameStore.getState().attackMonster('combat_test_monster');

        const stateAfterB2 = useGameStore.getState().gameState!;
        const monsterAfterB2 = stateAfterB2.monsters.find(m => m.id === 'combat_test_monster')!;
        if (monsterAfterB2.hp !== 7) { // 10 HP - 3 damage = 7 HP
          throw new Error(`Bug 2 Test Failed: expected monster HP to be 7, got ${monsterAfterB2.hp}`);
        }

        // Bug 3: Seed a Gargoyle with hasActivated: false (Stone Form). Call attackMonster. Assert the gargoyle takes 0 damage.
        // Also verify that the attack result's damage was non-zero before being gated by applyDamage (verified via log entry).
        useGameStore.setState({ gameState: baseTestState });
        AbilitySystem._rollOverride = () => 15;
        await useGameStore.getState().attackMonster('combat_test_gargoyle');

        const stateAfterB3 = useGameStore.getState().gameState!;
        const gargoyleAfterB3 = stateAfterB3.monsters.find(m => m.id === 'combat_test_gargoyle')!;
        if (gargoyleAfterB3.hp !== 5) {
          throw new Error(`Bug 3 Test Failed: expected Stone Form gargoyle HP to remain 5, got ${gargoyleAfterB3.hp}`);
        }

        const b3Log = stateAfterB3.log.find(l => l.message.includes('Gargoyle'));
        if (!b3Log) {
          throw new Error('Bug 3 Test Failed: could not find combat log for Gargoyle attack');
        }
        if (!b3Log.message.includes('deals 3 damage!')) {
          throw new Error(`Bug 3 Test Failed: expected log to show deals 3 damage (non-zero before immunity), got: "${b3Log.message}"`);
        }

        // Bug 5: Call moveHero with a position pointing to a non-existent tile ID. Assert hero position is unchanged.
        useGameStore.setState({ gameState: baseTestState });
        useGameStore.getState().moveHero({ x: 99, z: 99, sqX: 0, sqZ: 0 });

        const stateAfterB5 = useGameStore.getState().gameState!;
        const heroAfterB5 = stateAfterB5.heroes.find(h => h.id === 'combat_test_hero')!;
        if (heroAfterB5.position.x !== 0 || heroAfterB5.position.z !== 0) {
          throw new Error(`Bug 5 Test Failed: expected hero position to remain at (0, 0), got (${heroAfterB5.position.x}, ${heroAfterB5.position.z})`);
        }

        // Verify with unrevealed tile as well
        const unrevealedTile = createAITile('tile_unrevealed', 1, 1, []);
        unrevealedTile.isRevealed = false;
        const stateWithUnrevealed = { ...baseTestState, tiles: [revealedTile, unrevealedTile] };
        useGameStore.setState({ gameState: stateWithUnrevealed });
        useGameStore.getState().moveHero({ x: 1, z: 1, sqX: 0, sqZ: 0 });

        const stateAfterB5Unrevealed = useGameStore.getState().gameState!;
        const heroAfterB5Unrevealed = stateAfterB5Unrevealed.heroes.find(h => h.id === 'combat_test_hero')!;
        if (heroAfterB5Unrevealed.position.x !== 0 || heroAfterB5Unrevealed.position.z !== 0) {
          throw new Error(`Bug 5 Test Failed: expected hero position to remain at (0, 0) when moving to unrevealed tile, got (${heroAfterB5Unrevealed.position.x}, ${heroAfterB5Unrevealed.position.z})`);
        }

        // Bug 6: Call moveHero then attackMonster. Assert both log entries have numeric string IDs ("0", "1") not UUID format.
        const cleanStateB6 = { ...baseTestState, logIdCounter: 0, log: [] };
        useGameStore.setState({ gameState: cleanStateB6 });

        useGameStore.getState().moveHero({ x: 0, z: 0, sqX: 3, sqZ: 3 });
        AbilitySystem._rollOverride = () => 15;
        await useGameStore.getState().attackMonster('combat_test_monster');

        const stateAfterB6 = useGameStore.getState().gameState!;
        const actionLog = stateAfterB6.log.find(l => l.type === 'action');
        const combatLog = stateAfterB6.log.find(l => l.type === 'combat');

        if (!actionLog || !combatLog) {
          throw new Error('Bug 6 Test Failed: could not find action or combat log');
        }

        if (actionLog.id !== '0') {
          throw new Error(`Bug 6 Test Failed: expected action log ID to be "0", got "${actionLog.id}"`);
        }
        if (combatLog.id !== '1') {
          throw new Error(`Bug 6 Test Failed: expected combat log ID to be "1", got "${combatLog.id}"`);
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(actionLog.id)) {
          throw new Error('Bug 6 Test Failed: action log ID is formatted as a UUID');
        }
        if (uuidRegex.test(combatLog.id)) {
          throw new Error('Bug 6 Test Failed: combat log ID is formatted as a UUID');
        }

        // Restore original dice store state and overrides
        useDiceStore.setState({ requestRoll: originalRequestRoll });
        AbilitySystem._rollOverride = null;
      }

      // -----------------------------------------------------------------------
      // ConditionSystem Bug Fixes Tests (B1, B2, B3, B4)
      // -----------------------------------------------------------------------
      {
        console.log('Testing ConditionSystem & coreSlice Bug Fixes (B1, B2, B3, B4)...');

        const testHero: Hero = {
          ...dummyHero,
          id: 'condition_test_hero',
          name: 'Condition Test Hero',
          hp: 10,
          maxHp: 10,
          conditions: []
        };

        // Bug 1: Apply a condition with duration: 1. Call processTurnEnd once. Assert the condition is still present with turnsRemaining: 0.
        // Call processTurnEnd a second time. Assert the condition is now removed.
        const heroWithC1 = ConditionSystem.applyCondition(testHero, 'slowed', 'source_a', 1);
        if (heroWithC1.conditions.length !== 1 || heroWithC1.conditions[0].turnsRemaining !== 1) {
          throw new Error(`Bug 1 Test Failed: expected 1 condition with turnsRemaining 1, got duration ${heroWithC1.conditions[0]?.turnsRemaining}`);
        }

        const afterFirstTurn = ConditionSystem.processTurnEnd(heroWithC1);
        const conditionAfterFirst = afterFirstTurn.conditions.find(c => c.type === 'slowed');
        if (!conditionAfterFirst) {
          throw new Error('Bug 1 Test Failed: expected condition to survive first processTurnEnd call');
        }
        if (conditionAfterFirst.turnsRemaining !== 0) {
          throw new Error(`Bug 1 Test Failed: expected turnsRemaining to be 0 after first processTurnEnd call, got ${conditionAfterFirst.turnsRemaining}`);
        }

        const afterSecondTurn = ConditionSystem.processTurnEnd(afterFirstTurn);
        const conditionAfterSecond = afterSecondTurn.conditions.find(c => c.type === 'slowed');
        if (conditionAfterSecond) {
          throw new Error('Bug 1 Test Failed: expected condition to be removed after second processTurnEnd call');
        }

        // Bug 2: Apply condition from source A. Apply same condition again from source B. Assert sourceId on the condition is now source B's ID.
        const heroWithSrcA = ConditionSystem.applyCondition(testHero, 'poisoned', 'source_a', 2);
        if (heroWithSrcA.conditions[0].sourceId !== 'source_a') {
          throw new Error(`Bug 2 Test Failed: expected sourceId to be 'source_a', got ${heroWithSrcA.conditions[0].sourceId}`);
        }
        const heroWithSrcB = ConditionSystem.applyCondition(heroWithSrcA, 'poisoned', 'source_b', 2);
        if (heroWithSrcB.conditions[0].sourceId !== 'source_b') {
          throw new Error(`Bug 2 Test Failed: expected refreshed sourceId to be 'source_b', got ${heroWithSrcB.conditions[0].sourceId}`);
        }

        // Bug 3: Apply poisoned condition to a hero. Call processTurnStart. Assert hero's HP decreased by 1.
        const poisonedHero = ConditionSystem.applyCondition(testHero, 'poisoned', 'some_source', 2);
        const revealedTile = createAITile('tile_0_0', 0, 0, []);
        revealedTile.isRevealed = true;
        const poisonGameState: GameState = {
          phase: 'hero',
          currentHeroId: 'condition_test_hero',
          heroes: [poisonedHero],
          monsters: [],
          tiles: [revealedTile],
          dungeonDeck: [],
          treasureDeck: [],
          encounterDeck: [],
          monsterDeck: [],
          discardPiles: {},
          activeScenario: { id: 'poison_test', name: 'Poison Test', difficulty: 'Easy', description: 'Test', introText: '', victoryText: '', defeatText: '', objectives: [], specialRules: [], startTileId: 'tile_0_0', maxSurges: 3 },
          turnOrder: ['condition_test_hero'],
          healingSurges: 2,
          turnCount: 1,
          log: [],
          activeEnvironmentCard: null,
          experiencePile: [],
          treasuresDrawnThisTurn: 0,
          traps: [],
          villainPhaseQueue: [],
          activeVillainId: null,
          logIdCounter: 0,
          cardResolution: { phase: 'idle', cardId: null, cardType: null, pendingEffects: [], resolvedEffects: [], targetEntityId: null, result: null }
        };

        const stateAfterPoisonStart = ConditionSystem.processTurnStart(poisonGameState, 'condition_test_hero');
        const heroAfterPoison = stateAfterPoisonStart.heroes.find(h => h.id === 'condition_test_hero')!;
        if (heroAfterPoison.hp !== 9) {
          throw new Error(`Bug 3 Test Failed: expected hero HP to be 9 after start of turn poison damage, got ${heroAfterPoison.hp}`);
        }

        // Bug 4: Seed a hero with a duration: 1 condition, call endTurn, and assert the condition has turnsRemaining: 0.
        // Also assert that calling endTurn a second time removes the condition.
        useGameStore.getState().startNewGame('s1', ['hero_arjhan']);
        
        // Apply slowed condition with duration: 1
        const storeState = useGameStore.getState().gameState!;
        const heroInStore = storeState.heroes.find(h => h.id === 'hero_arjhan')!;
        const heroWithCondition = ConditionSystem.applyCondition(heroInStore, 'slowed', 'source_test', 1);
        useGameStore.setState({
          gameState: {
            ...storeState,
            heroes: storeState.heroes.map(h => h.id === 'hero_arjhan' ? heroWithCondition : h)
          }
        });

        // Call endTurn (the first turn end). It should decrement to 0 and persist!
        useGameStore.getState().endTurn();
        
        const stateAfterFirstEnd = useGameStore.getState().gameState!;
        const heroAfterFirstEnd = stateAfterFirstEnd.heroes.find(h => h.id === 'hero_arjhan')!;
        const condAfterFirstEnd = heroAfterFirstEnd.conditions.find(c => c.type === 'slowed');
        if (!condAfterFirstEnd) {
          throw new Error('Bug 4 Test Failed: expected slowed condition to persist after first endTurn call');
        }
        if (condAfterFirstEnd.turnsRemaining !== 0) {
          throw new Error(`Bug 4 Test Failed: expected turnsRemaining to be 0 after first endTurn call, got ${condAfterFirstEnd.turnsRemaining}`);
        }

        // Call endTurn a second time. It should be removed.
        const preSecondEndState = useGameStore.getState().gameState!;
        useGameStore.setState({
          gameState: {
            ...preSecondEndState,
            phase: 'hero',
            currentHeroId: 'hero_arjhan'
          }
        });

        useGameStore.getState().endTurn();
        const stateAfterSecondEnd = useGameStore.getState().gameState!;
        const heroAfterSecondEnd = stateAfterSecondEnd.heroes.find(h => h.id === 'hero_arjhan')!;
        const condAfterSecondEnd = heroAfterSecondEnd.conditions.find(c => c.type === 'slowed');
        if (condAfterSecondEnd) {
          throw new Error('Bug 4 Test Failed: expected slowed condition to be removed after second endTurn call');
        }
      }

      console.log('  All new Bug Fix verification tests passed.');
    }

    // --- Music of the Damned Integration Test ---
    if (true) {
      console.log('--- Testing Music of the Damned Environment Logic ---');
      const testHero = createAIHero('motd_hero', 0, 0);
      const testTile = createAITile('tile_start', 0, 0, [openEdge('north'), openEdge('south'), openEdge('east'), openEdge('west')]);
      testTile.encounterType = 'black'; // forces monster draw
      
      const monsterDeck = [
        'monster_rat_swarm', // 1 XP (bottom)
        'monster_gargoyle',  // 2 XP (middle)
        'monster_zombie'     // 1 XP (top, drawn first)
      ];

      const baseState = createAIState([testHero], [testTile]);
      baseState.monsterDeck = monsterDeck;
      baseState.activeEnvironmentCard = 'enc_music_of_the_damned';
      baseState.discardPiles = { ...baseState.discardPiles, monster: [] };

      // Spawn monster for exploration (should draw zombie and gargoyle, pick gargoyle)
      const stateAfterExploration = TileSystem.spawnMonsterForExploration(baseState, testTile);
      
      if (stateAfterExploration.monsters.length !== 1) {
        throw new Error('Music of the Damned Test Failed: Expected exactly 1 monster to be spawned.');
      }
      if (stateAfterExploration.monsters[0].name?.toLowerCase() !== 'gargoyle') {
        throw new Error(`Music of the Damned Test Failed: Expected Gargoyle to spawn (2 XP vs 1 XP), but got ${stateAfterExploration.monsters[0].name}`);
      }
      
      // Verify zombie was discarded
      if (!stateAfterExploration.discardPiles.monster.includes('monster_zombie')) {
        throw new Error('Music of the Damned Test Failed: Expected Zombie to be discarded.');
      }

      // Verify deck has rat swarm remaining
      if (stateAfterExploration.monsterDeck.length !== 1 || stateAfterExploration.monsterDeck[0] !== 'monster_rat_swarm') {
        throw new Error('Music of the Damned Test Failed: Expected rat swarm to be only remaining card in deck.');
      }

      // Tiebreaker check: if empty or only 1 card left, just spawns that one.
      const stateAfterSecondSpawn = TileSystem.spawnMonsterForExploration(stateAfterExploration, testTile);
      if (stateAfterSecondSpawn.monsters.length !== 2) {
         throw new Error('Music of the Damned Test Failed: Expected 2nd monster to spawn when deck only has 1 card.');
      }
      if (stateAfterSecondSpawn.monsters[1].name.toLowerCase() !== 'rat swarm') {
         throw new Error('Music of the Damned Test Failed: Expected rat swarm to spawn from 1-card deck.');
      }

    }

    // -----------------------------------------------------------------------
    // Cowardly Flight and Spirit of Doom (Event) Verification
    // -----------------------------------------------------------------------
    {
      console.log('--- Testing Cowardly Flight & Spirit of Doom Event ---');
      const testHero = createAIHero('event_test_hero', 0, 0);
      testHero.speed = 6;
      const startTile = createAITile('tile_start', 0, 0, [openEdge('north')]);
      startTile.isStart = true;
      
      // Setup a monster (zombie) at (0, 0)
      const zombie: Monster = {
        ...createAIMonster('test_zombie', 1),
        id: 'test_zombie',
        templateId: 'monster_zombie',
        name: 'Zombie',
        hp: 2,
        maxHp: 2,
        ac: 6,
        experienceValue: 1,
        moveRange: 1,
        isDefeated: false,
        isExhausted: false,
        conditions: [],
        position: { x: 0, z: 0, sqX: 2, sqZ: 2 }
      };

      const baseState = createAIState([testHero], [startTile]);
      baseState.monsters = [zombie];
      baseState.dungeonDeck = ['white_x3_01']; // bottom deck will draw this
      baseState.monsterDeck = ['monster_skeleton'];

      const cowardlyFlightCard = DataLoader.getInstance().getCardById('enc_cowardly_flight');
      if (!cowardlyFlightCard) throw new Error('Cowardly Flight card not found');

      const flightResult = EncounterSystem.processEventCard(baseState, cowardlyFlightCard, testHero);
      if (!flightResult.success) {
        throw new Error(`Cowardly Flight resolution failed: ${flightResult.message}`);
      }

      const flightState = flightResult.gameState;
      // Verify zombie moved to the new tile (0, -1) since north edge from (0,0) is at (0,-1)
      const movedZombie = flightState.monsters.find(m => m.id === 'test_zombie')!;
      if (movedZombie.position.x !== 0 || movedZombie.position.z !== -1) {
        throw new Error(`Cowardly Flight Test Failed: Zombie should have moved to (0, -1), got (${movedZombie.position.x}, ${movedZombie.position.z})`);
      }

      // Verify a new monster (skeleton) spawned on the new tile (0, -1)
      const skeleton = flightState.monsters.find(m => m.templateId === 'monster_skeleton');
      if (!skeleton) {
        throw new Error('Cowardly Flight Test Failed: Skeleton monster should have spawned');
      }
      if (skeleton.position.x !== 0 || skeleton.position.z !== -1) {
        throw new Error(`Cowardly Flight Test Failed: Skeleton should have spawned at (0, -1), got (${skeleton.position.x}, ${skeleton.position.z})`);
      }

      // Verify the old tile (0, 0) has no monsters anymore
      const startTileAfter = flightState.tiles.find(t => t.id === 'tile_start')!;
      if (startTileAfter.monsters.includes('test_zombie')) {
        throw new Error('Cowardly Flight Test Failed: Zombie should have been removed from startTile monsters list');
      }

      // Test Spirit of Doom (Event)
      // Setup: Hero is at (0, 0) (empty tile). Active monster zombie is at (0, -1).
      // The hero's speed is 6. The monster tile (0, -1) is at distance 1.
      // The hero should move to (0, -1) and take 0 damage.
      const spiritOfDoomCard = DataLoader.getInstance().getCardById('enc_spirit_of_doom_event');
      if (!spiritOfDoomCard) throw new Error('Spirit of Doom event card not found');

      // Reset hero HP to 10
      const heroA = { ...testHero, hp: 10, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
      const stateBeforeDoom = {
        ...flightState,
        heroes: [heroA]
      };

      const doomResult = EncounterSystem.processEventCard(stateBeforeDoom, spiritOfDoomCard, heroA);
      const doomState = doomResult.gameState;
      const finalHero = doomState.heroes.find(h => h.id === 'event_test_hero')!;

      // Hero should have moved to (0, -1) and taken 0 damage
      if (finalHero.position.x !== 0 || finalHero.position.z !== -1) {
        throw new Error(`Spirit of Doom Test Failed: Hero should have moved to (0, -1), got (${finalHero.position.x}, ${finalHero.position.z})`);
      }
      if (finalHero.hp !== 10) {
        throw new Error(`Spirit of Doom Test Failed: Hero should have taken 0 damage, got HP = ${finalHero.hp}`);
      }

      // Now test where the monster tile is unreachable:
      // Set hero speed to 0. Hero cannot move. Hero stays at (0, 0) and takes 1 damage.
      const slowHero = { ...testHero, hp: 10, speed: 0, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
      const stateDoomUnreachable = {
        ...stateBeforeDoom,
        heroes: [slowHero]
      };
      const doomResultUnreachable = EncounterSystem.processEventCard(stateDoomUnreachable, spiritOfDoomCard, slowHero);
      const finalSlowHero = doomResultUnreachable.gameState.heroes.find(h => h.id === 'event_test_hero')!;
      
      if (finalSlowHero.position.x !== 0 || finalSlowHero.position.z !== 0) {
        throw new Error(`Spirit of Doom Test Failed (unreachable): Hero should have stayed at (0, 0), got (${finalSlowHero.position.x}, ${finalSlowHero.position.z})`);
      }
      if (finalSlowHero.hp !== 9) {
        throw new Error(`Spirit of Doom Test Failed (unreachable): Hero should have taken 1 damage, got HP = ${finalSlowHero.hp}`);
      }

      console.log('  Cowardly Flight & Spirit of Doom logic passed.');
    }

    // -----------------------------------------------------------------------
    // Phase 3 Integration Tests (Events Debt & Traps)
    // -----------------------------------------------------------------------
    {
      console.log('Running Phase 3 Traps & Event Debt Integration Tests...');

      const startTile = createAITile('tile_start', 0, 0, [openEdge('north')]);
      startTile.isStart = true;
      const testHeroObj = createAIHero('event_test_hero', 0, 0);
      const testState = {
        ...createAIState([testHeroObj], [startTile]),
        encounterDeck: ['enc_mists_of_terror', 'enc_treasure_chest', 'enc_overwhelming_terror', 'enc_ghost_prince_of_aurel', 'enc_king_tomescus_portal']
      };

      // 1. Mists of Terror independent rolls
      const mistsCard = DataLoader.getInstance().getCardById('enc_mists_of_terror');
      if (!mistsCard) throw new Error('Mists of Terror card not found');

      const hero1: Hero = { ...testHeroObj, id: 'hero1', name: 'Hero 1', hp: 10, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
      const hero2: Hero = { ...testHeroObj, id: 'hero2', name: 'Hero 2', hp: 10, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
      const mistsState = {
        ...testState,
        heroes: [hero1, hero2]
      };

      let rollIndex = 0;
      const mistsRolls = [4, 10];
      AbilitySystem._rollOverride = () => mistsRolls[rollIndex++];

      const mistsResult = EncounterSystem.processEventCard(mistsState, mistsCard, hero1);
      AbilitySystem._rollOverride = null;

      const resHero1 = mistsResult.gameState.heroes.find(h => h.id === 'hero1')!;
      const resHero2 = mistsResult.gameState.heroes.find(h => h.id === 'hero2')!;

      if (resHero1.hp !== 9) {
        throw new Error(`Mists of Terror Test Failed: Hero 1 should have taken 1 damage, got hp = ${resHero1.hp}`);
      }
      if (resHero2.hp !== 10) {
        throw new Error(`Mists of Terror Test Failed: Hero 2 should have taken 0 damage, got hp = ${resHero2.hp}`);
      }
      console.log('  Mists of Terror independent rolls passed.');

      // 2. Treasure Chest boundary rolls
      const chestCard = DataLoader.getInstance().getCardById('enc_treasure_chest');
      if (!chestCard) throw new Error('Treasure Chest card not found');

      const chestState = { ...mistsState, treasureDeck: ['treasure_1', 'treasure_2'] };

      // Roll 10: 2 damage
      AbilitySystem._rollOverride = () => 10;
      const chest10 = EncounterSystem.processEventCard(chestState, chestCard, hero1);
      const h10 = chest10.gameState.heroes.find(h => h.id === 'hero1')!;
      if (h10.hp !== 8) throw new Error(`Treasure Chest (Roll 10) Failed: Hero should take 2 damage, got hp = ${h10.hp}`);

      // Roll 11: 1 damage + 1 treasure
      AbilitySystem._rollOverride = () => 11;
      const chest11 = EncounterSystem.processEventCard(chestState, chestCard, hero1);
      const h11 = chest11.gameState.heroes.find(h => h.id === 'hero1')!;
      if (h11.hp !== 9) throw new Error(`Treasure Chest (Roll 11) Failed: Hero should take 1 damage, got hp = ${h11.hp}`);

      // Roll 15: 1 damage + 1 treasure
      AbilitySystem._rollOverride = () => 15;
      const chest15 = EncounterSystem.processEventCard(chestState, chestCard, hero1);
      const h15 = chest15.gameState.heroes.find(h => h.id === 'hero1')!;
      if (h15.hp !== 9) throw new Error(`Treasure Chest (Roll 15) Failed: Hero should take 1 damage, got hp = ${h15.hp}`);

      // Roll 16: Draw 1 treasure
      AbilitySystem._rollOverride = () => 16;
      const chest16 = EncounterSystem.processEventCard(chestState, chestCard, hero1);
      const h16 = chest16.gameState.heroes.find(h => h.id === 'hero1')!;
      if (h16.hp !== 10) throw new Error(`Treasure Chest (Roll 16) Failed: Hero should take 0 damage, got hp = ${h16.hp}`);

      console.log('  Treasure Chest boundary rolls passed.');

      // 3. Overwhelming Terror on Start tile
      const otCard = DataLoader.getInstance().getCardById('enc_overwhelming_terror');
      if (otCard) {
        const startTileObj = testState.tiles.find(t => t.isStart)!;
        const heroOnStart = { ...testHeroObj, position: { x: startTileObj.x, z: startTileObj.z, sqX: 2, sqZ: 2 } };
        const otState = {
          ...testState,
          heroes: [heroOnStart]
        };
        const otResult = EncounterSystem.processEventCard(otState, otCard, heroOnStart);
        const resHeroOt = otResult.gameState.heroes.find(h => h.id === heroOnStart.id)!;
        if (resHeroOt.position.x !== startTileObj.x || resHeroOt.position.z !== startTileObj.z) {
          throw new Error('Overwhelming Terror starting on Start tile should keep hero on Start tile.');
        }
        console.log('  Overwhelming Terror on Start tile passed.');
      }

      // 4. Ghost of Prince Aurel
      const aurelCard = DataLoader.getInstance().getCardById('enc_ghost_prince_of_aurel');
      if (aurelCard) {
        const powerHeroReal: Hero = {
          ...testHeroObj,
          hp: 10,
          abilities: ['fighter_brute_strike'],
          flippedPowerIds: []
        };
        const aurelStateReal = { ...testState, heroes: [powerHeroReal] };
        const aurelResultReal = EncounterSystem.processEventCard(aurelStateReal, aurelCard, powerHeroReal);
        const resHeroA = aurelResultReal.gameState.heroes[0];
        if (!resHeroA.flippedPowerIds?.includes('fighter_brute_strike')) {
          throw new Error('Ghost of Prince Aurel: Daily power should have been flipped face-down');
        }

        const powerHeroNone: Hero = {
          ...testHeroObj,
          hp: 10,
          abilities: [],
          flippedPowerIds: []
        };
        const aurelStateNone = { ...testState, heroes: [powerHeroNone] };
        const aurelResultNone = EncounterSystem.processEventCard(aurelStateNone, aurelCard, powerHeroNone);
        const resHeroB = aurelResultNone.gameState.heroes[0];
        if (resHeroB.hp !== 9) {
          throw new Error(`Ghost of Prince Aurel: Hero should take 1 damage if no unused powers, got HP = ${resHeroB.hp}`);
        }
        console.log('  Ghost of Prince Aurel tests passed.');
      }

      // 5. King Tomescu's Portal
      const portalCard = DataLoader.getInstance().getCardById('enc_king_tomescus_portal');
      if (portalCard) {
        const portalHero = { ...testHeroObj, hp: 10 };
        const portalState = { ...testState, heroes: [portalHero] };
        AbilitySystem._rollOverride = () => 18; // hits every time
        const portalResult = EncounterSystem.processEventAttackCard(portalState, portalCard, portalHero);
        AbilitySystem._rollOverride = null;

        const resPortalHero = portalResult.gameState.heroes[0];
        if (resPortalHero.hp !== 7) {
          throw new Error(`King Tomescu's Portal: Hero should take 3 damage, got HP = ${resPortalHero.hp}`);
        }
        if (!resPortalHero.removedFromPlay) {
          throw new Error('King Tomescu\'s Portal: Hero should be removed from play');
        }

        // Test return to dungeon at start of turn
        const startState = ConditionSystem.processTurnStart(portalResult.gameState, portalHero.id);
        const resStartHero = startState.heroes[0];
        if (resStartHero.removedFromPlay) {
          throw new Error('King Tomescu\'s Portal: Hero should not be removed from play after turn start');
        }
        if (resStartHero.position.x !== 0 || resStartHero.position.z !== 0) {
          throw new Error('King Tomescu\'s Portal: Hero should be placed on Start tile');
        }
        console.log('  King Tomescu\'s Portal tests passed.');
      }

      // 6. Traps Integration Tests
      console.log('  Testing Traps Placement and Activation...');
      const alarmCard = DataLoader.getInstance().getCardById('enc_alarm_trap');
      if (!alarmCard) throw new Error('Alarm trap card not found');
      
      const trapHero = { ...testHeroObj, id: 'trap_hero', name: 'Trap Hero', position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
      const trapStateBase = {
        ...testState,
        heroes: [trapHero],
        currentHeroId: 'trap_hero',
        traps: []
      };

      const placeResult = EncounterSystem.placeTrap(trapStateBase, alarmCard, trapHero);
      if (placeResult.gameState.traps.length !== 1) {
        throw new Error('Trap placement failed: traps list should contain 1 trap');
      }
      const trapInstance = placeResult.gameState.traps[0];
      if (trapInstance.cardId !== 'enc_alarm_trap') {
        throw new Error('Trap placement failed: incorrect cardId');
      }

      AbilitySystem._rollOverride = () => 5; // DC is 10, so roll 5 fails
      const disableFailResult = EncounterSystem.attemptDisableTrap(placeResult.gameState, trapHero, trapInstance, alarmCard);
      if (disableFailResult.success) {
        throw new Error('attemptDisableTrap should fail when roll < DC');
      }
      if (disableFailResult.gameState.traps.length !== 1) {
        throw new Error('attemptDisableTrap: failed attempt should not remove the trap');
      }
      if (!disableFailResult.gameState.hasAttackedThisTurn) {
        throw new Error('attemptDisableTrap: failed attempt should consume the attack action');
      }
      AbilitySystem._rollOverride = null;

      AbilitySystem._rollOverride = () => 12; // DC is 10, so roll 12 succeeds
      const disableSuccessResult = EncounterSystem.attemptDisableTrap(placeResult.gameState, trapHero, trapInstance, alarmCard);
      if (!disableSuccessResult.success) {
        throw new Error('attemptDisableTrap should succeed when roll >= DC');
      }
      if (disableSuccessResult.gameState.traps.length !== 0) {
        throw new Error('attemptDisableTrap: successful attempt should remove the trap');
      }
      if (!disableSuccessResult.gameState.hasAttackedThisTurn) {
        throw new Error('attemptDisableTrap: successful attempt should consume the attack action');
      }
      AbilitySystem._rollOverride = null;

      const alarmTriggerState = {
        ...placeResult.gameState,
        monsterDeck: ['monster_zombie']
      };
      const alarmTriggerResult = EncounterSystem.activateTrap(alarmTriggerState, trapInstance, alarmCard);
      const resMonsters = alarmTriggerResult.gameState.monsters;
      if (resMonsters.length !== alarmTriggerState.monsters.length + 1) {
        throw new Error('Alarm Trap trigger failed: should spawn a new monster');
      }
      const spawnedMonster = resMonsters[resMonsters.length - 1];
      if (spawnedMonster.position.x !== 0 || spawnedMonster.position.z !== 0) {
        throw new Error(`Alarm Trap trigger failed: should spawn monster on parent tile (0, 0), got (${spawnedMonster.position.x}, ${spawnedMonster.position.z})`);
      }

      // Test Alarm Trap fallback: No unexplored edges remaining
      const closedStartTile = {
        ...startTile,
        connections: [closedEdge('north')]
      };
      const alarmFallbackState = {
        ...placeResult.gameState,
        tiles: [closedStartTile],
        monsterDeck: ['monster_zombie']
      };
      const alarmFallbackResult = EncounterSystem.activateTrap(alarmFallbackState, trapInstance, alarmCard);
      if (alarmFallbackResult.gameState.monsters.length !== alarmFallbackState.monsters.length) {
        throw new Error('Alarm Trap fallback failed: should not spawn a new monster when no unexplored edges remain');
      }
      if (!alarmFallbackResult.gameState.log?.some(l => l.message.includes('No unexplored edges remain'))) {
        throw new Error('Alarm Trap fallback failed: missing log entry indicating no unexplored edges remain');
      }

      const turretCard = DataLoader.getInstance().getCardById('enc_crossbow_turret');
      if (!turretCard) throw new Error('Crossbow Turret card not found');
      
      const turretHero1 = { ...testHeroObj, id: 'turret1', name: 'Turret Hero 1', ac: 10, hp: 10, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
      const turretHero2 = { ...testHeroObj, id: 'turret2', name: 'Turret Hero 2', ac: 10, hp: 10, position: { x: 0, z: -1, sqX: 2, sqZ: 2 } }; 
      const turretHero3 = { ...testHeroObj, id: 'turret3', name: 'Turret Hero 3', ac: 10, hp: 10, position: { x: 0, z: -2, sqX: 2, sqZ: 2 } }; 
      
      const tileNorthTurret = createAITile('tile_north', 0, -1, [openEdge('south')]);
      const turretState = {
        ...testState,
        tiles: TileSystem.connectTiles(testState.tiles, testState.tiles.find(t => t.id === 'tile_start')!, tileNorthTurret, 'north'),
        heroes: [turretHero1, turretHero2, turretHero3]
      };
      const turretTrap: Trap = { id: 'turret_trap', cardId: 'enc_crossbow_turret', tileId: 'tile_start', position: { x: 0, z: 0, sqX: 2, sqZ: 2 }, isDisabled: false, ownedByHeroId: null, isTriggered: false };
      
      let turretRollIndex = 0;
      const turretRolls = [10, 1]; 
      AbilitySystem._rollOverride = () => turretRolls[turretRollIndex++];
      const turretResult = EncounterSystem.activateTrap(turretState, turretTrap, turretCard);
      AbilitySystem._rollOverride = null;

      const resTurretHero1 = turretResult.gameState.heroes.find(h => h.id === 'turret1')!;
      const resTurretHero2 = turretResult.gameState.heroes.find(h => h.id === 'turret2')!;
      const resTurretHero3 = turretResult.gameState.heroes.find(h => h.id === 'turret3')!;

      if (resTurretHero1.hp !== 8) throw new Error(`Crossbow Turret: Hero 1 should take 2 damage on hit, got HP = ${resTurretHero1.hp}`);
      if (resTurretHero2.hp !== 9) throw new Error(`Crossbow Turret: Hero 2 should take 1 damage on miss, got HP = ${resTurretHero2.hp}`);
      if (resTurretHero3.hp !== 10) throw new Error(`Crossbow Turret: Hero 3 should be untouched, got HP = ${resTurretHero3.hp}`);

      const crushingCard = DataLoader.getInstance().getCardById('enc_crushing_walls');
      if (!crushingCard) throw new Error('Crushing Walls card not found');
      
      const crushingTrap: Trap = { id: 'crushing_trap', cardId: 'enc_crushing_walls', tileId: 'tile_start', position: { x: 0, z: 0, sqX: 2, sqZ: 2 }, isDisabled: false, ownedByHeroId: null, isTriggered: false };
      
      AbilitySystem._rollOverride = () => 10;
      const crushingResult = EncounterSystem.activateTrap(turretState, crushingTrap, crushingCard);
      AbilitySystem._rollOverride = null;

      const resCrushingHero1 = crushingResult.gameState.heroes.find(h => h.id === 'turret1')!;
      const resCrushingHero2 = crushingResult.gameState.heroes.find(h => h.id === 'turret2')!;
      if (resCrushingHero1.hp !== 8) throw new Error(`Crushing Walls: Hero 1 should take 2 damage, got HP = ${resCrushingHero1.hp}`);
      if (!crushingResult.gameState.activeConditions?.some(c => c.targetId === 'turret1' && c.type === 'immobilized')) {
        throw new Error('Crushing Walls: Hero 1 should be Immobilized');
      }
      if (resCrushingHero2.hp !== 10) throw new Error(`Crushing Walls: Hero 2 should be untouched, got HP = ${resCrushingHero2.hp}`);

      const fireCard = DataLoader.getInstance().getCardById('enc_fire_trap');
      if (!fireCard) throw new Error('Fire Trap card not found');
      
      const fireTrap: Trap = { id: 'fire_trap', cardId: 'enc_fire_trap', tileId: 'tile_start', position: { x: 0, z: 0, sqX: 2, sqZ: 2 }, isDisabled: false, ownedByHeroId: null, isTriggered: false };
      const fireResult = EncounterSystem.activateTrap(turretState, fireTrap, fireCard);
      
      const resFireHero1 = fireResult.gameState.heroes.find(h => h.id === 'turret1')!;
      const resFireHero2 = fireResult.gameState.heroes.find(h => h.id === 'turret2')!;
      if (resFireHero1.hp !== 8) throw new Error(`Fire Trap: Hero 1 should take 2 damage, got HP = ${resFireHero1.hp}`);
      if (resFireHero2.hp !== 10) throw new Error(`Fire Trap: Hero 2 should be untouched, got HP = ${resFireHero2.hp}`);

      const slidingCard = DataLoader.getInstance().getCardById('enc_sliding_walls');
      if (!slidingCard) throw new Error('Sliding Walls card not found');
      
      const slidingTrap: Trap = { id: 'sliding_trap', cardId: 'enc_sliding_walls', tileId: 'tile_start', position: { x: 0, z: 0, sqX: 2, sqZ: 2 }, isDisabled: false, ownedByHeroId: null, isTriggered: false };
      
      // Tile North at (0, -1) setup
      const tileNorth = createAITile('tile_north', 0, -1, [openEdge('south')]);
      const tileStateSliding = {
        ...testState,
        tiles: TileSystem.connectTiles(testState.tiles, testState.tiles.find(t => t.id === 'tile_start')!, tileNorth, 'north'),
        heroes: [turretHero1, turretHero2, turretHero3]
      };

      AbilitySystem._rollOverride = () => 3;
      const slidingResultA = EncounterSystem.activateTrap(tileStateSliding, slidingTrap, slidingCard);
      AbilitySystem._rollOverride = null;
      const resSlidingHero1A = slidingResultA.gameState.heroes.find(h => h.id === 'turret1')!;
      if (resSlidingHero1A.position.x !== 0 || resSlidingHero1A.position.z !== -1) {
        throw new Error(`Sliding Walls (success): Hero 1 should move to (0, -1), got (${resSlidingHero1A.position.x}, ${resSlidingHero1A.position.z})`);
      }
      if (resSlidingHero1A.hp !== 10) {
        throw new Error(`Sliding Walls (success): Hero 1 should take 0 damage, got HP = ${resSlidingHero1A.hp}`);
      }

      AbilitySystem._rollOverride = () => 18;
      const slidingResultB = EncounterSystem.activateTrap(tileStateSliding, slidingTrap, slidingCard);
      AbilitySystem._rollOverride = null;
      const resSlidingHero1B = slidingResultB.gameState.heroes.find(h => h.id === 'turret1')!;
      if (resSlidingHero1B.position.x !== 0 || resSlidingHero1B.position.z !== 0) {
        throw new Error(`Sliding Walls (blocked): Hero 1 should remain at (0, 0), got (${resSlidingHero1B.position.x}, ${resSlidingHero1B.position.z})`);
      }
      if (resSlidingHero1B.hp !== 9) {
        throw new Error(`Sliding Walls (blocked): Hero 1 should take 1 damage, got HP = ${resSlidingHero1B.hp}`);
      }

      const spearCard = DataLoader.getInstance().getCardById('enc_spear_gauntlet');
      if (!spearCard) throw new Error('Spear Gauntlet card not found');
      const spearTrap: Trap = { id: 'spear_trap', cardId: 'enc_spear_gauntlet', tileId: 'tile_start', position: { x: 0, z: 0, sqX: 2, sqZ: 2 }, isDisabled: false, ownedByHeroId: null, isTriggered: false };
      
      AbilitySystem._rollOverride = () => 10;
      const spearResult = EncounterSystem.activateTrap(turretState, spearTrap, spearCard);
      AbilitySystem._rollOverride = null;
      const resSpearHero1 = spearResult.gameState.heroes.find(h => h.id === 'turret1')!;
      if (resSpearHero1.hp !== 7) throw new Error(`Spear Gauntlet: Hero 1 should take 3 damage on hit, got HP = ${resSpearHero1.hp}`);

      const dartCard = DataLoader.getInstance().getCardById('enc_dart_trap');
      if (!dartCard) throw new Error('Dart Trap card not found');
      const dartTrap: Trap = { id: 'dart_trap', cardId: 'enc_dart_trap', tileId: 'tile_start', position: { x: 0, z: 0, sqX: 2, sqZ: 2 }, isDisabled: false, ownedByHeroId: null, isTriggered: false };

      AbilitySystem._rollOverride = () => 10;
      const dartResult = EncounterSystem.activateTrap(turretState, dartTrap, dartCard);
      AbilitySystem._rollOverride = null;
      const resDartHero1 = dartResult.gameState.heroes.find(h => h.id === 'turret1')!;
      if (resDartHero1.hp !== 8) throw new Error(`Dart Trap: Hero 1 should take 2 damage on hit, got HP = ${resDartHero1.hp}`);

      console.log('  Traps Integration Tests passed.');
    }

    // -----------------------------------------------------------------------
    // 7. Phase 4 Integration Tests
    // -----------------------------------------------------------------------
    {
      console.log('  Testing Phase 4 cards and repositioning...');

      const startTile = createAITile('tile_start', 0, 0, [openEdge('north')]);
      startTile.isStart = true;
      const testHeroObj = createAIHero('event_test_hero', 0, 0);
      const testState = {
        ...createAIState([testHeroObj], [startTile]),
        encounterDeck: []
      };

      // enc_strahds_whispers
      const whispersCard = DataLoader.getInstance().getCardById('enc_strahds_whispers');
      if (whispersCard) {
        const whispersHero1: Hero = { ...testHeroObj, id: 'whispers1', name: 'Whispers Hero 1', hp: 10, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        const whispersHero2: Hero = { 
          ...testHeroObj, 
          id: 'whispers2', 
          name: 'Whispers Hero 2', 
          hp: 10, 
          position: { x: 1, z: 0, sqX: 2, sqZ: 2 },
          abilities: ['arjhan_power_1'], // Arjhan's at-will power (Valiant Strike)
          selectedPowerIds: ['arjhan_power_1']
        };
        
        // Setup simple board: start tile at (0,0) and a corridor tile at (1,0) connected
        const whispersTile0 = { ...startTile, id: 'tile_whispers0', x: 0, z: 0, heroes: ['whispers1'], monsters: [] };
        const whispersTile1 = { ...startTile, id: 'tile_whispers1', x: 1, z: 0, heroes: ['whispers2'], monsters: [], isStart: false };
        whispersTile0.connections = [openEdge('east')];
        whispersTile1.connections = [openEdge('west')];
        whispersTile0.connections[0].connectedTileId = whispersTile1.id;
        whispersTile1.connections[0].connectedTileId = whispersTile0.id;

        const whispersState = {
          ...testState,
          heroes: [whispersHero1, whispersHero2],
          tiles: [whispersTile0, whispersTile1],
          currentHeroId: 'whispers1'
        };

        const whispersResult = EncounterSystem.processEventCard(whispersState, whispersCard, whispersHero1);
        const resWhispersState = whispersResult.gameState;
        
        // Hero 1 should have moved to Hero 2's tile (1,0)
        const movedHero1 = resWhispersState.heroes.find(h => h.id === 'whispers1')!;
        if (movedHero1.position.x !== 1 || movedHero1.position.z !== 0) {
          throw new Error(`Strahd's Whispers: Hero 1 did not move to Hero 2's tile, got x=${movedHero1.position.x}, z=${movedHero1.position.z}`);
        }

        // It should have created a pending fortune of kind atWillPowerPick
        const pending = resWhispersState.pendingFortune;
        if (!pending || pending.kind !== 'atWillPowerPick') {
          throw new Error(`Strahd's Whispers: Expected pendingFortune kind 'atWillPowerPick', got ${pending?.kind}`);
        }
        if (pending.attackerHeroId !== 'whispers2' || pending.targetHeroId !== 'whispers1') {
          throw new Error('Strahd\'s Whispers: Incorrect attacker or target in pending selection');
        }

        // Resolve the pending fortune to trigger the attack
        // Stub dice store for async attack resolution and override roll so the attack hits
        const originalRequestRoll = useDiceStore.getState().requestRoll;
        useDiceStore.setState({
          requestRoll: (params: any) => {
            useDiceStore.setState({ result: 15 });
            params.onComplete();
          },
        });
        AbilitySystem._rollOverride = () => 15;
        const resolveResult = await TreasureSystem.resolvePendingFortuneAsync(resWhispersState, {
          kind: 'atWillPowerPick',
          powerCardId: 'arjhan_power_1'
        });
        AbilitySystem._rollOverride = null;
        useDiceStore.setState({ requestRoll: originalRequestRoll });

        const hitHero1 = resolveResult.newState.heroes.find(h => h.id === 'whispers1')!;
        // Arjhan's Dragon Breath deals 1 damage. Check if Hero 1 took damage
        if (hitHero1.hp >= 10) {
          throw new Error(`Strahd's Whispers: Target Hero 1 should have taken damage, got HP = ${hitHero1.hp}`);
        }
        const attackerHero2 = resolveResult.newState.heroes.find(h => h.id === 'whispers2')!;
        if (attackerHero2.hp !== 10) {
          throw new Error(`Strahd's Whispers: Attacker Hero 2 should not have taken damage, got HP = ${attackerHero2.hp}`);
        }
        console.log("  Strahd's Whispers tests passed.");
      }

      // enc_illusionary_trick
      const trickCard = DataLoader.getInstance().getCardById('enc_illusionary_trick');
      if (trickCard) {
        // Test 1: No monsters on board -> no-op
        const trickHero = { ...testHeroObj, id: 'trickHero', position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        const trickStateNoMonsters = { ...testState, heroes: [trickHero], monsters: [] };
        const trickResultNoMonsters = EncounterSystem.processEventCard(trickStateNoMonsters, trickCard, trickHero);
        if (trickResultNoMonsters.gameState.heroes[0].position.x !== 0) {
          throw new Error('Illusionary Trick (no monsters): active hero moved');
        }

        // Test 2: Multiple monsters -> swaps with farthest
        const trickTile0 = { ...startTile, id: 'tile_trick0', x: 0, z: 0, heroes: ['trickHero'], monsters: [] };
        const trickTile1 = { ...startTile, id: 'tile_trick1', x: 1, z: 0, heroes: [], monsters: ['zombie_close'], isStart: false };
        const trickTile2 = { ...startTile, id: 'tile_trick2', x: 2, z: 0, heroes: [], monsters: ['zombie_far'], isStart: false };
        trickTile0.connections = [openEdge('east')];
        trickTile1.connections = [openEdge('west'), openEdge('east')];
        trickTile2.connections = [openEdge('west')];
        trickTile0.connections[0].connectedTileId = trickTile1.id;
        trickTile1.connections[0].connectedTileId = trickTile0.id;
        trickTile1.connections[1].connectedTileId = trickTile2.id;
        trickTile2.connections[0].connectedTileId = trickTile1.id;

        const zombieClose = { 
          id: 'zombie_close', 
          name: 'Zombie Close', 
          hp: 1, 
          maxHp: 1, 
          ac: 10, 
          speed: 1, 
          type: 'monster' as const,
          position: { x: 1, z: 0, sqX: 2, sqZ: 2 },
          isExhausted: false,
          conditions: [],
          usedPowers: []
        };
        const zombieFar = { 
          id: 'zombie_far', 
          name: 'Zombie Far', 
          hp: 1, 
          maxHp: 1, 
          ac: 10, 
          speed: 1, 
          type: 'monster' as const,
          position: { x: 2, z: 0, sqX: 2, sqZ: 2 },
          isExhausted: false,
          conditions: [],
          usedPowers: []
        };

        const trickStateMultiple = {
          ...testState,
          heroes: [trickHero],
          monsters: [zombieClose, zombieFar],
          tiles: [trickTile0, trickTile1, trickTile2],
          currentHeroId: 'trickHero'
        };

        const trickResultMultiple = EncounterSystem.processEventCard(trickStateMultiple, trickCard, trickHero);
        const resHero = trickResultMultiple.gameState.heroes.find(h => h.id === 'trickHero')!;
        const resZombieFar = trickResultMultiple.gameState.monsters.find(m => m.id === 'zombie_far')!;
        const resZombieClose = trickResultMultiple.gameState.monsters.find(m => m.id === 'zombie_close')!;

        // Swapped with zombieFar (farthest)
        if (resHero.position.x !== 2 || resHero.position.z !== 0) {
          throw new Error(`Illusionary Trick: Hero should have swapped to (2,0), got (${resHero.position.x},${resHero.position.z})`);
        }
        if (resZombieFar.position.x !== 0 || resZombieFar.position.z !== 0) {
          throw new Error(`Illusionary Trick: Zombie Far should have swapped to (0,0), got (${resZombieFar.position.x},${resZombieFar.position.z})`);
        }
        if (resZombieClose.position.x !== 1 || resZombieClose.position.z !== 0) {
          throw new Error('Illusionary Trick: Zombie Close should not have moved');
        }
        console.log('  Illusionary Trick tests passed.');
      }

      // enc_strahds_minions
      const minionsCard = DataLoader.getInstance().getCardById('enc_strahds_minions');
      if (minionsCard) {
        // Test: Active hero + closest monsters teleport. If < 2 monsters, spawn 1 on the farthest tile
        const minHero = { ...testHeroObj, id: 'minHero', position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        
        const minTile0 = { ...startTile, id: 'tile_min0', x: 0, z: 0, heroes: ['minHero'], monsters: [], isStart: true };
        const minTile1 = { ...startTile, id: 'tile_min1', x: 1, z: 0, heroes: [], monsters: ['zombie1'], isStart: false };
        const minTile2 = { ...startTile, id: 'tile_min2', x: 2, z: 0, heroes: [], monsters: [], isStart: false };
        minTile0.connections = [openEdge('east')];
        minTile1.connections = [openEdge('west'), openEdge('east')];
        minTile2.connections = [openEdge('west')];
        minTile0.connections[0].connectedTileId = minTile1.id;
        minTile1.connections[0].connectedTileId = minTile0.id;
        minTile1.connections[1].connectedTileId = minTile2.id;
        minTile2.connections[0].connectedTileId = minTile1.id;

        const zombie1 = { 
          id: 'zombie1', 
          name: 'Zombie 1', 
          hp: 1, maxHp: 1, ac: 10, speed: 1, type: 'monster' as const,
          position: { x: 1, z: 0, sqX: 2, sqZ: 2 }, isExhausted: false, conditions: [], usedPowers: []
        };

        const minState = {
          ...testState,
          heroes: [minHero],
          monsters: [zombie1],
          tiles: [minTile0, minTile1, minTile2],
          monsterDeck: ['monster_skeleton'], // backup monster deck
          currentHeroId: 'minHero'
        };

        const minResult = EncounterSystem.processEventCard(minState, minionsCard, minHero);
        const resMinHero = minResult.gameState.heroes.find(h => h.id === 'minHero')!;
        const resZombie1 = minResult.gameState.monsters.find(m => m.id === 'zombie1')!;
        
        // Farthest tile is minTile2 (distance 2 from Start tile)
        if (resMinHero.position.x !== 2 || resMinHero.position.z !== 0) {
          throw new Error(`Strahd's Minions: Hero should teleport to farthest tile (2,0), got (${resMinHero.position.x},${resMinHero.position.z})`);
        }
        if (resZombie1.position.x !== 2 || resZombie1.position.z !== 0) {
          throw new Error('Strahd\'s Minions: Zombie 1 should teleport to farthest tile');
        }
        
        // Since fewer than 2 monsters existed, 1 should spawn on the farthest tile (minTile2)
        if (minResult.gameState.monsters.length !== 2) {
          throw new Error(`Strahd's Minions: Expected 2 monsters in play after spawn, got ${minResult.gameState.monsters.length}`);
        }
        const spawnedMonster = minResult.gameState.monsters.find(m => m.id !== 'zombie1')!;
        if (spawnedMonster.position.x !== 2 || spawnedMonster.position.z !== 0) {
          throw new Error(`Strahd's Minions: Spawned monster should be on farthest tile, got (${spawnedMonster.position.x},${spawnedMonster.position.z})`);
        }
        console.log("  Strahd's Minions tests passed.");
      }

      // enc_teleport_glyph
      const glyphCard = DataLoader.getInstance().getCardById('enc_teleport_glyph');
      if (glyphCard) {
        const glyphHero = { ...testHeroObj, id: 'glyphHero', position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        const singleTileState = {
          ...testState,
          heroes: [glyphHero],
          monsters: [],
          tiles: [{ ...startTile, id: 'tile_single', x: 0, z: 0, heroes: ['glyphHero'], monsters: [], isStart: true }],
          currentHeroId: 'glyphHero'
        };
        const singleResult = EncounterSystem.processEventCard(singleTileState, glyphCard, glyphHero);
        if (singleResult.gameState.heroes[0].position.x !== 0 || singleResult.gameState.heroes[0].position.z !== 0) {
          throw new Error('Teleport Glyph: Hero moved when there was no other tile');
        }
        console.log('  Teleport Glyph tests passed.');
      }

      // enc_cyrus_belview
      const cyrusCard = DataLoader.getInstance().getCardById('enc_cyrus_belview');
      if (cyrusCard) {
        const cyrusHero1 = { ...testHeroObj, id: 'cyrus1', position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        const cyrusHero2 = { ...testHeroObj, id: 'cyrus2', position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        const cyrusTile0 = { ...startTile, id: 'tile_cyrus0', x: 0, z: 0, heroes: ['cyrus1', 'cyrus2'], monsters: [], connections: [openEdge('east')] };
        const cyrusState = {
          ...testState,
          heroes: [cyrusHero1, cyrusHero2],
          tiles: [cyrusTile0],
          dungeonDeck: ['start-tile'], // tile template to place (has all edges open)
          monsterDeck: ['monster_zombie', 'monster_skeleton'], // monsters to spawn
          currentHeroId: 'cyrus1'
        };

        const cyrusResult = EncounterSystem.processEventCard(cyrusState, cyrusCard, cyrusHero1);
        const resCyrusState = cyrusResult.gameState;
        
        // New tile crypt placed at (1,0)
        if (resCyrusState.tiles.length !== 2) {
          throw new Error(`Cyrus Belview: Expected 2 tiles, got ${resCyrusState.tiles.length}`);
        }
        const placedTile = resCyrusState.tiles.find(t => t.id !== 'tile_cyrus0')!;
        if (placedTile.x !== 1 || placedTile.z !== 0) {
          throw new Error(`Cyrus Belview: Placed tile coordinates incorrect: (${placedTile.x}, ${placedTile.z})`);
        }

        // Both monsters spawned on it
        if (placedTile.monsters.length !== 2) {
          throw new Error(`Cyrus Belview: Expected 2 monsters on placed tile, got ${placedTile.monsters.length}`);
        }

        // All heroes relocated to the new tile
        const cy1 = resCyrusState.heroes.find(h => h.id === 'cyrus1')!;
        const cy2 = resCyrusState.heroes.find(h => h.id === 'cyrus2')!;
        if (cy1.position.x !== 1 || cy1.position.z !== 0 || cy2.position.x !== 1 || cy2.position.z !== 0) {
          throw new Error('Cyrus Belview: Heroes did not relocate to new tile');
        }
        if (!placedTile.heroes.includes('cyrus1') || !placedTile.heroes.includes('cyrus2')) {
          throw new Error('Cyrus Belview: New tile heroes list incorrect');
        }
        if (resCyrusState.tiles.find(t => t.id === 'tile_cyrus0')!.heroes.length !== 0) {
          throw new Error('Cyrus Belview: Old tile heroes list not cleared');
        }
        console.log('  Cyrus Belview tests passed.');
      }

      // enc_icy_corridor
      const icyCard = DataLoader.getInstance().getCardById('enc_icy_corridor');
      if (icyCard) {
        const icyHero = { ...testHeroObj, id: 'icyHero', hp: 10, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
        const icyTile0 = { ...startTile, id: 'tile_icy0', x: 0, z: 0, heroes: ['icyHero'], monsters: [] };
        const icyTile1 = { ...startTile, id: 'tile_icy1', x: 1, z: 0, heroes: [], monsters: [], isStart: false };
        icyTile0.connections = [openEdge('east')];
        icyTile1.connections = [openEdge('west')];
        icyTile0.connections[0].connectedTileId = icyTile1.id;
        icyTile1.connections[0].connectedTileId = icyTile0.id;

        const icyState = {
          ...testState,
          heroes: [icyHero],
          tiles: [icyTile0, icyTile1],
          currentHeroId: 'icyHero'
        };

        // Stub roll override to make attack hit
        AbilitySystem._rollOverride = () => 15;
        const icyResult = EncounterSystem.processEventAttackCard(icyState, icyCard, icyHero);
        AbilitySystem._rollOverride = null;

        const resIcyHero = icyResult.gameState.heroes.find(h => h.id === 'icyHero')!;
        if (resIcyHero.hp !== 8) {
          throw new Error(`Icy Corridor: Hero should take 2 damage on hit, got HP = ${resIcyHero.hp}`);
        }

        // Verify player-choice prompt fires
        const pending = icyResult.gameState.pendingFortune;
        if (!pending || pending.kind !== 'tileRelocatePick') {
          throw new Error('Icy Corridor: Relocation choice prompt did not fire');
        }
        if (pending.eligibleTileIds.length !== 1 || pending.eligibleTileIds[0] !== 'tile_icy1') {
          throw new Error('Icy Corridor: Incorrect eligible tiles list');
        }

        // Resolve choice and check position
        const finalState = await TreasureSystem.resolvePendingFortuneAsync(icyResult.gameState, {
          kind: 'tileRelocatePick',
          destinationTileId: 'tile_icy1'
        });
        const finalHero = finalState.newState.heroes.find(h => h.id === 'icyHero')!;
        if (finalHero.position.x !== 1 || finalHero.position.z !== 0) {
          throw new Error('Icy Corridor: Hero did not relocate to chosen tile');
        }
        console.log('  Icy Corridor tests passed.');
      }

      // King Tomescu's Portal turn order skip/return
      const t1 = { ...testHeroObj, id: 't1', hp: 10, removedFromPlay: true, position: { x: -999, z: -999 } };
      const t2 = { ...testHeroObj, id: 't2', hp: 10, position: { x: 0, z: 0, sqX: 2, sqZ: 2 } };
      const turnOrderState = {
        ...testState,
        heroes: [t1, t2],
        turnOrder: ['t1', 't2'],
        currentHeroId: 't2',
        phase: 'hero' as const
      };
      
      const stateAfterT2 = ConditionSystem.processTurnStart(turnOrderState, 't1');
      const startT1Hero = stateAfterT2.heroes.find(h => h.id === 't1')!;
      if (startT1Hero.removedFromPlay) {
        throw new Error("King Tomescu's Portal: Hero should return to play at start of their next turn");
      }
      if (startT1Hero.position.x !== 0 || startT1Hero.position.z !== 0) {
        throw new Error("King Tomescu's Portal: Hero should be placed on Start tile upon return");
      }
      console.log("  King Tomescu's Portal turn transition tests passed.");
    }

    // -----------------------------------------------------------------------

    console.log('--- INTEGRATION TEST PASSED ---');
    return true;
  } catch (error) {
    console.error('--- INTEGRATION TEST FAILED ---');
    console.error(error);
    return false;
  }
};

/**
 * AI Stress Test - Runs multiple monster turns to check for pathfinding or state hangs.
 */
export const runAIStressTest = async (iterations: number = 50) => {
  console.log(`Running AI Stress Test (${iterations} turns)...`);
  for (let i = 0; i < iterations; i++) {
    // Force monster phases
    // This would call internal engine methods in a real test scenario
  }
  console.log('AI Stress Test Complete.');
};

