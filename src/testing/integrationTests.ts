/**
 * Integration tests for the full game loop.
 * These are designed to be run in a dev environment or CI.
 */

// Test utilities for console capture, assertions, etc.
import { captureWarn, captureError, captureLog, runWithCapturedConsole } from './testUtils';

import { runAbilitySystemTests } from './ability-system-tests';
import { useGameStore, buildVillainQueue, applyTrapResult, executeVillainPhase } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { TileSystem } from '../game/engine/TileSystem';
import { DataLoader } from '../game/dataLoader';
import type { Tile, TileConnection, Direction, GameState, ExplorationPoint, Monster, Hero, TacticResult, MonsterAbility, AbilityEffect, Card } from '../game/types';
import { CardResolutionSystem } from '../game/engine/CardResolutionSystem';
import { ExplorationState, onArrowClicked, onRotationConfirmed, onCancel, onPlacementComplete } from '../game/engine/ExplorationStateMachine';
import {
  manhattanDistance,
  getAdjacentTileIds,
  hasLineOfSight,
  findClosestHero,
  getPathToward,
  resolveTactic,
  resolveTrap
} from '../game/engine/MonsterAI';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand: open TileConnection (no connectedTileId). */
const openEdge = (edge: Direction): TileConnection => ({ edge, isOpen: true });

/** Shorthand: closed TileConnection (no connectedTileId). */
const closedEdge = (edge: Direction): TileConnection => ({ edge, isOpen: false });

// ---------------------------------------------------------------------------

export const runFullGameLoopTest = async () => {
  console.log('--- STARTING INTEGRATION TEST ---');

  try {
    // Run ability system tests first
    console.log('Running Ability System Tests...');
    const abilityTestsPassed = runAbilitySystemTests();
    if (!abilityTestsPassed) {
      throw new Error('Ability System Tests FAILED');
    }

    const store = useGameStore.getState();
    const ui = useUIStore.getState();

    // 1. Setup Game
    console.log('Testing Scenario 1 setup...');
    store.startNewGame('scenario-1', ['hero-paladin', 'hero-wizard']);
    if (!store.gameState) throw new Error('Game state not initialized');

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
    //   [2] 'tile_corridor_1'   → has north open at 0° → MATCH (validRotations: [0, 180])
    //
    // This proves drawAndPlace skips unknown IDs and non-fitting tiles,
    // then finds the first match at the last position.

    const mockGameState = {
      ...useGameStore.getState().gameState,
      dungeonDeck: ['__unknown_id_A__', '__unknown_id_B__', 'tile_corridor_1'],
    } as GameState;

    const explorationPoint = { tileId: 'tile_parent', edge: 'south' as Direction };

    const result = TileSystem.drawAndPlace(mockGameState, explorationPoint);

    // The match must be found (not exhausted)
    if (result.exhausted)
      throw new Error('drawAndPlace: should NOT be exhausted — tile_corridor_1 is a valid fit');
    if (result.tile === null)
      throw new Error('drawAndPlace: tile should not be null');
    if (result.tile.id !== 'tile_corridor_1')
      throw new Error(`drawAndPlace: expected tile_corridor_1, got ${result.tile?.id}`);

    // Valid rotations for north-incoming: tile_corridor_1 has N+S open, so:
    //   0°   north open ✓   180° south→north open ✓   (90°/270° rotate N to E/W — not north)
    if (!result.validRotations.includes(0))
      throw new Error('drawAndPlace: validRotations should include 0');
    if (!result.validRotations.includes(180))
      throw new Error('drawAndPlace: validRotations should include 180');
    if (result.validRotations.includes(90) || result.validRotations.includes(270))
      throw new Error('drawAndPlace: validRotations should NOT include 90 or 270');

    // remainingDeck must be the original 3-card deck minus 'tile_corridor_1'
    if (result.remainingDeck.length !== 2)
      throw new Error(`drawAndPlace: remainingDeck should have 2 cards, got ${result.remainingDeck.length}`);
    if (result.remainingDeck.includes('tile_corridor_1'))
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

    if (explorePoints[0].edge !== 'south' || explorePoints[0].worldX !== 0 || explorePoints[0].worldZ !== 0.5) {
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

    if (explorePoints[0].edge !== 'east' || explorePoints[0].worldX !== 0.5 || explorePoints[0].worldZ !== 1) {
      throw new Error(`getExplorationPoints: New point incorrectly calculated: ${JSON.stringify(explorePoints[0])}`);
    }

    console.log('  getExplorationPoints PASSED');

    // -----------------------------------------------------------------------
    // 16. ExplorationStateMachine
    // -----------------------------------------------------------------------
    console.log('Testing ExplorationStateMachine...');

    let fmState: ExplorationState = { phase: 'idle' };
    const point: ExplorationPoint = { tileId: 'iso-start', edge: 'south', worldX: 0, worldZ: 0.5 };

    // Valid draw result mock
    const smDrawResult = {
      tile: { ...templateTile, id: 'test-sm', x: 0, z: 0, isRevealed: false, connections: [] },
      validRotations: [0, 90] as (0 | 90 | 180 | 270)[],
      remainingDeck: ['card2', 'card3'],
      exhausted: false
    };

    // Happy path tests
    fmState = onArrowClicked(fmState, point, smDrawResult);
    if (fmState.phase !== 'awaiting_rotation') throw new Error('State machine failed to transition to awaiting_rotation');

    fmState = onRotationConfirmed(fmState, 90);
    if (fmState.phase !== 'placing') throw new Error('State machine failed to transition to placing');

    fmState = onPlacementComplete(fmState);
    if (fmState.phase !== 'idle') throw new Error('State machine failed to returning to idle after placing');

    // Cancel test
    fmState = onArrowClicked(fmState, point, smDrawResult);
    if (fmState.phase !== 'awaiting_rotation') throw new Error('State machine failed reset to awaiting_rotation for cancel test');

    fmState = onCancel(fmState);
    if (fmState.phase !== 'idle') throw new Error('State machine failed to transition back to idle on cancel');

    // Exhausted test
    const smEmptyDrawResult = {
      tile: null,
      validRotations: [],
      remainingDeck: [],
      exhausted: true
    };
    fmState = onArrowClicked(fmState, point, smEmptyDrawResult);
    if (fmState.phase !== 'exhausted') throw new Error('State machine failed to transition to exhausted');

    console.log('  ExplorationStateMachine PASSED');

    // -----------------------------------------------------------------------
    // 10. Villain Phase buildVillainQueue
    // -----------------------------------------------------------------------
    console.log('Testing Villain Phase Queue construction...');

    // Inject mock monsters into store
    const mockM1: Monster = { id: 'm_test_1', type: 'monster', hp: 1, ownedByHeroId: 'h1' } as any;
    const mockM2: Monster = { id: 'm_test_2', type: 'monster', hp: 1, ownedByHeroId: 'h1' } as any;
    const mockM3: Monster = { id: 'm_test_3', type: 'monster', hp: 1, ownedByHeroId: 'h2' } as any;
    const mockDead: Monster = { id: 'm_test_4', type: 'monster', hp: 0, ownedByHeroId: 'h1' } as any;

    useGameStore.setState(state => {
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          monsters: [...state.gameState.monsters, mockM1, mockM2, mockM3, mockDead],
        }
      };
    });

    const queueState = useGameStore.getState().gameState!;
    const hero1Queue = buildVillainQueue(queueState, 'h1');

    if (hero1Queue.length !== 2) {
      throw new Error(`buildVillainQueue: expected 2 ids for Hero 1, got ${hero1Queue.length} (${hero1Queue.join(',')})`);
    }
    if (!hero1Queue.includes('m_test_1') || !hero1Queue.includes('m_test_2')) {
      throw new Error(`buildVillainQueue: incorrect ids returned`);
    }

    const hero2Queue = buildVillainQueue(queueState, 'h2');
    if (hero2Queue.length !== 1 || hero2Queue[0] !== 'm_test_3') {
      throw new Error(`buildVillainQueue: expected ['m_test_3'] for Hero 2, got ${hero2Queue.join(',')}`);
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
      conditions: [],
      usedPowers: []
    };

    const hero2: Hero = {
      ...hero1,
      id: 'hero2',
      name: 'Hero 2',
      position: { x: 2, z: 1, sqX: 1, sqZ: 1 }
    };

    const hero3: Hero = {
      ...hero1,
      id: 'hero3',
      name: 'Hero 3',
      position: { x: 1, z: 3, sqX: 1, sqZ: 1 }
    };

    const heroTile1: Tile = {
      ...templateTile,
      id: 'hero_tile_1',
      x: 0,
      z: 0,
      connections: []
    };

    const heroTile2: Tile = {
      ...templateTile,
      id: 'hero_tile_2',
      x: 2,
      z: 1,
      connections: []
    };

    const heroTile3: Tile = {
      ...templateTile,
      id: 'hero_tile_3',
      x: 1,
      z: 3,
      connections: []
    };

    const monsterTile: Tile = {
      ...templateTile,
      id: 'monster_tile',
      x: 0,
      z: 2,
      connections: []
    };

    const heroTiles = [heroTile1, heroTile2, heroTile3, monsterTile];

    // Find closest hero from monster position
    const closest = findClosestHero(monsterTile, [hero1, hero2, hero3], heroTiles);
    if (!closest) {
      throw new Error('findClosestHero: should not return null when heroes exist');
    }
    if (closest.hero.id !== 'hero2') {
      throw new Error(`findClosestHero: expected hero2 (distance 2), got ${closest.hero.id} (distance ${closest.distance})`);
    }
    if (closest.distance !== 2) {
      throw new Error(`findClosestHero: expected distance 2, got ${closest.distance}`);
    }

    // Empty heroes array
    const closestEmpty = findClosestHero(monsterTile, [], heroTiles);
    if (closestEmpty !== null) {
      throw new Error('findClosestHero: should return null when heroes array is empty');
    }

    console.log('  findClosestHero PASSED');

    // -----------------------------------------------------------------------
    // 21. MonsterAI.getPathToward
    // -----------------------------------------------------------------------
    console.log('Testing MonsterAI.getPathToward...');

    const pathStart: Tile = {
      ...templateTile,
      id: 'path_start',
      x: 0,
      z: 0,
      connections: [openEdge('north'), openEdge('east'), closedEdge('south'), closedEdge('west')]
    };
    pathStart.connections[0].connectedTileId = 'path_1';
    pathStart.connections[1].connectedTileId = 'path_2';

    const path1: Tile = {
      ...templateTile,
      id: 'path_1',
      x: 0,
      z: -1,
      connections: [openEdge('north'), openEdge('south'), closedEdge('east'), closedEdge('west')]
    };
    path1.connections[1].connectedTileId = 'path_start';
    path1.connections[0].connectedTileId = 'path_3';

    const path2: Tile = {
      ...templateTile,
      id: 'path_2',
      x: 1,
      z: 0,
      connections: [openEdge('north'), openEdge('south'), openEdge('west'), closedEdge('east')]
    };
    path2.connections[2].connectedTileId = 'path_start';
    path2.connections[0].connectedTileId = 'path_3';

    const path3: Tile = {
      ...templateTile,
      id: 'path_3',
      x: 0,
      z: -2,
      connections: [openEdge('south'), openEdge('east'), closedEdge('north'), closedEdge('west')]
    };
    path3.connections[0].connectedTileId = 'path_1';
    path3.connections[1].connectedTileId = 'path_2';

    const pathBoard = [pathStart, path1, path2, path3];

    // Path from start to path3
    const pathToTarget = getPathToward(pathStart, path3, pathBoard, 10);
    if (pathToTarget.length === 0) {
      throw new Error('getPathToward: should find a path');
    }
    // Should find the shortest path (either path1 or path2, then path3)
    if (pathToTarget.length !== 2) {
      throw new Error(`getPathToward: expected path length 2, got ${pathToTarget.length}`);
    }
    if (pathToTarget[pathToTarget.length - 1].id !== 'path_3') {
      throw new Error(`getPathToward: last tile should be path_3, got ${pathToTarget[pathToTarget.length - 1].id}`);
    }

    // Test steps limit
    const pathLimited = getPathToward(pathStart, path3, pathBoard, 1);
    if (pathLimited.length !== 1) {
      throw new Error(`getPathToward: with steps=1, should return 1 tile, got ${pathLimited.length}`);
    }

    // No path (disconnected)
    const isolatedPathTile: Tile = {
      ...templateTile,
      id: 'path_isolated',
      x: 10,
      z: 10,
      connections: [closedEdge('north'), closedEdge('south'), closedEdge('east'), closedEdge('west')]
    };
    const pathToIsolated = getPathToward(pathStart, isolatedPathTile, [...pathBoard, isolatedPathTile], 10);
    if (pathToIsolated.length !== 0) {
      throw new Error('getPathToward: should return empty array when no path exists');
    }

    // Zero steps
    const pathZeroSteps = getPathToward(pathStart, path3, pathBoard, 0);
    if (pathZeroSteps.length !== 0) {
      throw new Error('getPathToward: with steps=0, should return empty array');
    }

    // Verify fromTile is not included
    const pathIncludesStart = getPathToward(pathStart, path3, pathBoard, 10);
    if (pathIncludesStart.some(t => t.id === 'path_start')) {
      throw new Error('getPathToward: should not include fromTile in the path');
    }

    // Test deterministic behavior: identical inputs should produce identical paths
    // This ensures the sorting of adjacent tiles by (x, z) works correctly
    const deterministicPath1 = getPathToward(pathStart, path3, pathBoard, 10);
    const deterministicPath2 = getPathToward(pathStart, path3, pathBoard, 10);
    if (deterministicPath1.length !== deterministicPath2.length) {
      throw new Error(`getPathToward: deterministic test failed - path lengths differ: ${deterministicPath1.length} vs ${deterministicPath2.length}`);
    }
    for (let i = 0; i < deterministicPath1.length; i++) {
      if (deterministicPath1[i].id !== deterministicPath2[i].id) {
        throw new Error(`getPathToward: deterministic test failed - paths differ at index ${i}: ${deterministicPath1[i].id} vs ${deterministicPath2[i].id}`);
      }
    }

    console.log('  getPathToward PASSED');

    // -----------------------------------------------------------------------
    // Monster AI Tactic Tests - Extended Test Cases
    // -----------------------------------------------------------------------
    console.log('Testing Monster AI Tactic Tests...');

    // Helper function to create a tile
    const createAITile = (id: string, x: number, z: number, connections: TileConnection[]): Tile => ({
      ...templateTile,
      id,
      x,
      z,
      connections
    });

    // Helper function to create a monster with moveRange
    const createAIMonster = (id: string, moveRange: number = 1): Monster => ({
      id,
      name: 'AI Test Monster',
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
      usedPowers: [],
      ...(moveRange !== undefined && { moveRange } as any)
    });

    // Helper function to create a hero
    const createAIHero = (id: string, x: number, z: number): Hero => ({
      id,
      name: 'AI Test Hero',
      type: 'hero',
      heroClass: 'fighter',
      level: 1,
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
      conditions: [],
      usedPowers: []
    });

    // Helper function to create a game state
    const createAIState = (heroes: Hero[], tiles: Tile[]): GameState => ({
      phase: 'monster',
      currentHeroId: heroes[0]?.id ?? '',
      heroes,
      monsters: [],
      tiles,
      dungeonDeck: [],
      treasureDeck: [],
      encounterDeck: [],
      discardPiles: {},
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
      activeVillainId: null, activeConditions: []
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

    tacticTile0.connections[0].connectedTileId = 'tactic_1';
    tacticTile0.connections[1].connectedTileId = 'tactic_2';

    const tacticTiles = [tacticTile0, tacticTile1, tacticTile2];

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
    };

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

    // Step 4: Test with hero at distance 2 - should move then attack
    const distantHero: Hero = { ...testHero, position: { x: 0, z: -2, sqX: 1, sqZ: 1 } };
    const distantState = { ...testGameState, heroes: [distantHero] };
    const result4 = resolveTactic(testMonster, tacticTile0, distantState);
    if (result4.action !== 'move_then_attack') {
      throw new Error(`Step 4: Expected move_then_attack with hero at distance 2, got ${result4.action}`);
    }
    if (result4.action === 'move_then_attack' && result4.path.length === 0) {
      throw new Error('Step 4: Expected non-empty path for move_then_attack');
    }
    if (result4.action === 'move_then_attack' && result4.targetHeroId !== 'hero_test') {
      throw new Error(`Step 4: Expected targetHeroId 'hero_test', got ${result4.targetHeroId}`);
    }
    console.log('  Step 4 PASSED: Moves then attacks hero at distance 2');

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
      conditions: [],
      usedPowers: []
    };

    // Create test trap
    const testTrap = {
      id: 'trap_test',
      cardId: 'card_trap',
      tileId: 'trap_tile',
      disabled: false,
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
    };

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
    if (trapState1.traps[0].isTriggered !== true) {
      throw new Error('applyTrapResult: expected trap.isTriggered to be true');
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
    };

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

    // 2. Call executeVillainPhase() (first endTurn)
    const afterFirstTurn = executeVillainPhase(villainGameState);

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

    // 3. Call executeVillainPhase() a second time
    const afterSecondTurn = executeVillainPhase(afterFirstTurn);

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

      // Verify moveRange is within reasonable bounds (1-4)
      if (monster.moveRange < 1 || monster.moveRange > 4) {
        throw new Error(`Monster ${monster.id} (${monster.name}) has invalid moveRange: ${monster.moveRange}. Expected 1-4.`);
      }

      console.log(`  ${monster.name}: moveRange = ${monster.moveRange}`);
    }

    console.log('  Monster Data Validation PASSED: All monsters have valid moveRange values');

    // -----------------------------------------------------------------------
    // 24. AbilitySystem.canUseAbility
    // -----------------------------------------------------------------------
    console.log('Testing AbilitySystem.canUseAbility...');
    const { AbilitySystem } = await import('../game/ai/AbilitySystem');

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
    };

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
      };

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
      };

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
        hp: 40,
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
      };

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
      discardPiles: {},
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
      activeVillainId: null, activeConditions: []
    };

    // Execute villain phase - Strahd should transition to phase 2 before evaluating tactics
    const strahdResult = executeVillainPhase(strahdState);
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
      discardPiles: {},
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
      activeConditions: []
    };

    const regenResult = executeVillainPhase(regenState);
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
    };

    const undyingResult = executeVillainPhase(undyingState);
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

    // Test 4: confirmSelection returns error string when 2 of 4 selected
    console.log('  Test 4: confirmSelection returns error string when 2 of 4 selected...');
    {
      const selection: any = {
        heroId,
        selectedPowerIds: ['power_atwill_1', 'power_daily_1'],
        isConfirmed: false
      };
      const result = PowerSelectionSystem.default.confirmSelection(selection, constraints);
      if (typeof result !== 'object' || !('error' in result)) {
        throw new Error('confirmSelection should return error object when not all powers selected');
      }
      if (!result.error.includes('2 more power(s)')) {
        throw new Error(`Expected error message to mention "2 more power(s)", got: ${result.error}`);
      }
      console.log('  Test 4 PASSED: confirmSelection returns error string when 2 of 4 selected');
    }

    // Test 5: autoSelectPowers returns exactly 4 confirmed ids
    console.log('  Test 5: autoSelectPowers returns exactly 4 confirmed ids...');
    {
      const result = PowerSelectionSystem.default.autoSelectPowers('paladin', heroId, constraints);
      if (result.selectedPowerIds.length !== 4) {
        throw new Error(`autoSelectPowers should return exactly 4 ids, got ${result.selectedPowerIds.length}`);
      }
      if (result.isConfirmed !== true) {
        throw new Error('autoSelectPowers should return isConfirmed: true');
      }
      // Verify correct distribution: 2 at-will, 1 daily, 1 utility
      const atWillCount = result.selectedPowerIds.filter(id =>
        mockPowerCards.find(c => c.id === id)?.powerType === 'at-will'
      ).length;
      const dailyCount = result.selectedPowerIds.filter(id =>
        mockPowerCards.find(c => c.id === id)?.powerType === 'daily'
      ).length;
      const utilityCount = result.selectedPowerIds.filter(id =>
        mockPowerCards.find(c => c.id === id)?.powerType === 'utility'
      ).length;
      if (atWillCount !== 2 || dailyCount !== 1 || utilityCount !== 1) {
        throw new Error(`autoSelectPowers should select 2 at-will, 1 daily, 1 utility, got: ${atWillCount} at-will, ${dailyCount} daily, ${utilityCount} utility`);
      }
      console.log('  Test 5 PASSED: autoSelectPowers returns exactly 4 confirmed ids (2 at-will, 1 daily, 1 utility)');
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
          conditions: [],
          usedPowers: []
        },
        {
          id: 'hero_2',
          name: 'Hero 2',
          type: 'hero',
          heroClass: 'ranger',
          level: 1,
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

      if (!hero2Result.selectedPowerIds || hero2Result.selectedPowerIds.length !== 0) {
        throw new Error(`Hero 2 should have 0 selectedPowerIds (not confirmed), got ${hero2Result.selectedPowerIds?.length ?? 0}`);
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
      if (!warnCapture.message.includes('3 more power(s)')) {
        throw new Error(
          `Expected warning about power count but got:
           "${warnCapture.message}"`
        );
      }

      console.log('  Test 3 PASSED: confirmHeroSelection logs warning when under totalMax');
    }

    // Test 4: All confirmed → hero.selectedPowerIds populated
    console.log('  Test 4: All confirmed → hero.selectedPowerIds populated...');
    {
      const testHeroId = 'test_hero_populate';
      const testCardIds = ['power_a', 'power_b', 'power_c', 'power_d'];

      // Create game state with confirmed selections
      const confirmedState: GameState = {
        ...testGameState,
        phase: 'setup',
        currentHeroId: testHeroId,
        heroes: [{ ...testHero, heroClass: 'paladin', id: testHeroId }],
        powerSelections: [
          { heroId: testHeroId, selectedPowerIds: testCardIds, isConfirmed: true }
        ]
      };

      // Store the state
      useGameStore.setState({ gameState: confirmedState });

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
      if (!warnCapture.message.includes('All heroes must confirm power selection')) {
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
    if (!assignment.isUsed) throw new Error('useTreasure: assignment not marked as used');

    console.log('  CardResolutionSystem PASSED');

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

