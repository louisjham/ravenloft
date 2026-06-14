import React, { useCallback, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { Tile3D } from './Tile3D';
import { Token3D } from './Token3D';
import { useGameActions } from '../../hooks/useGameActions';
import { TileSystem } from '../../game/engine/TileSystem';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { GAME_CONSTANTS } from '../../game/constants';

/**
 * Renders the entire dungeon layout from the game state.
 */
export const DungeonBoard: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const tiles = gameState?.tiles || [];
  const tokens = gameState?.tokens || [];
  const interactionMode = useUIStore((state) => state.interactionMode);

  const { handleSearchToken } = useGameActions();

  /**
   * Square-level reachability for the active hero during move mode.
   * Returns a Set of "tileId:sqX:sqZ" keys — only populated during hero move.
   */
  const reachableSquares = useMemo(() => {
    if (!gameState || gameState.phase !== 'hero' || interactionMode !== 'move') {
      return new Set<string>();
    }

    const activeHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    if (!activeHero) return new Set<string>();

    const effectiveSpeed = ConditionSystem.getEffectiveSpeed(activeHero, gameState);

    // Build blocked squares from live monsters (heroes can move through heroes)
    const TS = GAME_CONSTANTS.TILE_SIZE_SQUARES;
    const blockedSquares = new Set<string>(
      gameState.monsters
        .filter(m => !m.isDefeated && m.hp > 0)
        .map(m => `${m.position.x * TS + m.position.sqX},${m.position.z * TS + m.position.sqZ}`)
    );

    return TileSystem.getReachableSquares(
      activeHero.position,
      gameState.tiles,
      effectiveSpeed,
      blockedSquares
    );
  }, [gameState, interactionMode]);

  const handleTokenSearch = useCallback((tokenId: string) => {
    handleSearchToken(tokenId);
  }, [handleSearchToken]);

  return (
    <group name="dungeon-board">
      {tiles.map((tile) => (
        <Tile3D
          key={tile.id}
          tile={tile}
          isRevealed={tile.isRevealed}
          reachableSquares={reachableSquares}
        />
      ))}

      {/* Render tokens on tiles */}
      {tokens.map((token) => (
        <Token3D
          key={token.id}
          token={token}
          onSearch={handleTokenSearch}
        />
      ))}
    </group>
  );
};
