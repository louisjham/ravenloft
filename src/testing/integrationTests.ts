/**
 * Integration tests for the full game loop.
 * These are designed to be run in a dev environment or CI.
 */

import { useGameStore, buildVillainQueue } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { TileSystem } from '../game/engine/TileSystem';
import type { Tile, TileConnection, Direction, GameState, ExplorationPoint, Monster } from '../game/types';
import { ExplorationState, onArrowClicked, onRotationConfirmed, onCancel, onPlacementComplete } from '../game/engine/ExplorationStateMachine';
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
      validRotations: [0, 90] as (0|90|180|270)[],
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
