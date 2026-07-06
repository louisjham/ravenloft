import React, { useCallback, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { Tile3D } from './Tile3D';
import { Token3D } from './Token3D';
import { useGameActions } from '../../hooks/useGameActions';
import { TileSystem } from '../../game/engine/TileSystem';
import { ConditionSystem } from '../../game/engine/ConditionSystem';
import { GAME_CONSTANTS } from '../../game/constants';
import { Position } from '../../game/types';

/**
 * Renders the entire dungeon layout from the game state.
 *
 * Performance notes:
 *  - useGameActions() is called ONCE here, not inside each Tile3D instance.
 *    handleMoveHero is passed as a stable prop (useCallback) so React.memo on Tile3D works.
 *  - reachableSquares memo depends only on the fields that affect reachability
 *    (heroes, monsters, tiles, interactionMode), not the whole gameState object.
 *    This prevents all 41 tiles from receiving a new Set ref on unrelated state changes.
 */
export const DungeonBoard: React.FC = () => {
  // Narrow selectors — only re-render DungeonBoard when these specific fields change.
  const tiles = useGameStore((state) => state.gameState?.tiles ?? []);
  const tokens = useGameStore((state) => state.gameState?.tokens ?? []);
  const heroes = useGameStore((state) => state.gameState?.heroes ?? []);
  const monsters = useGameStore((state) => state.gameState?.monsters ?? []);
  const phase = useGameStore((state) => state.gameState?.phase);
  const currentHeroId = useGameStore((state) => state.gameState?.currentHeroId);
  const interactionMode = useUIStore((state) => state.interactionMode);

  // Single call site for useGameActions — not replicated per tile.
  const { handleMoveHero, handleSearchToken } = useGameActions();

  /**
   * Stable move callback passed into every Tile3D as a prop.
   * useCallback ensures reference identity is preserved across re-renders,
   * which keeps React.memo effective on Tile3DInner.
   */
  const stableMoveHero = useCallback((pos: Position) => {
    handleMoveHero(pos);
  }, [handleMoveHero]);

  /**
   * Square-level reachability for the active hero during move mode.
   * Returns a Set of "tileId:sqX:sqZ" keys — only populated during hero move.
   *
   * Dependencies are narrowed to the specific fields that affect reachability:
   *   - heroes: active hero position and conditions
   *   - monsters: blocked squares
   *   - tiles: board graph
   *   - phase: only relevant in 'hero' phase
   *   - currentHeroId: which hero is active
   *   - interactionMode: only compute in 'move' mode
   */
  const reachableSquares = useMemo(() => {
    if (phase !== 'hero' || interactionMode !== 'move') {
      return new Set<string>();
    }

    const activeHero = heroes.find(h => h.id === currentHeroId);
    if (!activeHero) return new Set<string>();

    // Reconstruct a minimal gameState-like object for engine calls.
    // ConditionSystem.getEffectiveSpeed only reads hero.conditions, hero.speed,
    // and gameState.tiles — so this is safe.
    const minimalState = { heroes, monsters, tiles } as any;
    const effectiveSpeed = ConditionSystem.getEffectiveSpeed(activeHero, minimalState);

    // Build blocked squares from live monsters (heroes can move through heroes).
    const TS = GAME_CONSTANTS.TILE_SIZE_SQUARES;
    const blockedSquares = new Set<string>(
      monsters
        .filter(m => !m.isDefeated && m.hp > 0)
        .map(m => `${m.position.x * TS + m.position.sqX},${m.position.z * TS + m.position.sqZ}`)
    );

    return TileSystem.getReachableSquares(
      activeHero.position,
      tiles,
      effectiveSpeed,
      blockedSquares
    );
  }, [heroes, monsters, tiles, phase, currentHeroId, interactionMode]);

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
          onMoveHero={stableMoveHero}
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
