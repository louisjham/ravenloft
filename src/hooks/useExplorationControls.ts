import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import {
  onArrowClicked,
  onPlacementAttempted,
  setTileRotation,
  onCancel,
  onPlacementComplete,
} from '../game/engine/ExplorationStateMachine';
import { TileSystem } from '../game/engine/TileSystem';
import { ScenarioManager } from '../game/scenarios/ScenarioManager';
import { ExplorationPoint } from '../game/types';

export function useExplorationControls() {
  const gameState = useGameStore((state) => state.gameState);
  const setGameState = useGameStore((state) => state.setGameState);

  const exploration = useUIStore((state) => state.explorationState);
  const setExploration = useUIStore((state) => state.setExplorationState);

  const onEdgeSelected = useCallback((point: ExplorationPoint) => {
    if (!gameState || gameState.phase !== 'hero') return;
    if (gameState.hasExploredThisTurn) {
      console.log('[Explore] Already explored this turn');
      return;
    }
    const curExploration = useUIStore.getState().explorationState;
    const drawResult = TileSystem.drawAndPlace(gameState, point);
    const newState = onArrowClicked(curExploration, point, drawResult);
    setExploration(newState);
    if (newState.phase === 'positioning') {
      useUIStore.getState().openTilePlacer();
      useUIStore.setState({ pendingTileRotation: newState.currentRotation });
    }
  }, [gameState, setExploration]);

  const handlePlacementConfirm = useCallback(() => {
    const curExploration = useUIStore.getState().explorationState;
    if (!gameState || (curExploration.phase !== 'positioning' && curExploration.phase !== 'placement_blocked')) return;

    const { pendingTileRotation } = useUIStore.getState();

    const pt = gameState.tiles.find(t => t.id === curExploration.point.tileId)!;
    let targetX = pt.x;
    let targetZ = pt.z;
    if (curExploration.point.edge === 'north') targetZ -= 1;
    else if (curExploration.point.edge === 'south') targetZ += 1;
    else if (curExploration.point.edge === 'east') targetX += 1;
    else if (curExploration.point.edge === 'west') targetX -= 1;

    const validation = TileSystem.validateEdgeAlignment(
      gameState.tiles,
      curExploration.drawnTile,
      targetX,
      targetZ,
      pendingTileRotation,
      curExploration.point.edge
    );

    const newState = onPlacementAttempted(
      setTileRotation(curExploration, pendingTileRotation),
      validation
    );

    if (newState.phase === 'placing') {
      useUIStore.getState().closeTilePlacer();
      const finalState = TileSystem.placeTile(gameState, newState.point, newState.rotation);
      const placedTile = finalState.tiles.find(t => t.x === targetX && t.z === targetZ);
      if (placedTile) {
        const stateWithMonster = TileSystem.spawnMonsterForExploration(finalState, placedTile);
        const stateWithRules = ScenarioManager.processPostExplore(stateWithMonster, placedTile);
        setGameState({
          ...stateWithRules,
          hasExploredThisTurn: true,
          exploredThisTurn: true,
          lastPlacedTileEncounterType: placedTile.encounterType ?? null,
          lastPlacedTileId: placedTile.id
        });
      } else {
        setGameState({
          ...finalState,
          hasExploredThisTurn: true,
          exploredThisTurn: true,
          lastPlacedTileEncounterType: null,
          lastPlacedTileId: null
        });
      }
      setExploration(onPlacementComplete(newState));
    } else if (newState.phase === 'placement_blocked') {
      const c = validation.conflicts[0];
      const reason = c
        ? c.neighborTileId
          ? `Edge mismatch with ${c.neighborTileId}`
          : `Placement blocked: ${c.description}`
        : "Invalid placement";

      setGameState({
        ...gameState,
        log: [
          ...gameState.log,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message: `Placement Invalid: ${reason}`,
            type: 'system' as const
          }
        ].slice(-100)
      });
      useUIStore.getState().setTilePlacementError(reason);
      setExploration(newState);
    } else {
      setExploration(newState);
    }
  }, [gameState, setGameState, setExploration]);

  const handlePlacementCancel = useCallback(() => {
    const curExploration = useUIStore.getState().explorationState;
    if (!gameState || (curExploration.phase !== 'positioning' && curExploration.phase !== 'placement_blocked')) return;

    const { newState, tileToReturn } = onCancel(curExploration);
    if (tileToReturn) {
      setGameState({
        ...gameState,
        dungeonDeck: [tileToReturn, ...curExploration.remainingDeck],
      });
    }
    useUIStore.getState().closeTilePlacer();
    setExploration(newState);
  }, [gameState, setGameState, setExploration]);

  const onAcceptFate = useCallback(() => {
    setExploration({ phase: 'idle' });
  }, [setExploration]);

  return {
    exploration,
    onEdgeSelected,
    handlePlacementConfirm,
    handlePlacementCancel,
    onAcceptFate,
  };
}
