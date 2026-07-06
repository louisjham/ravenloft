import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { animationQueue } from '../utils/animationQueue'
import { Position, Entity, Tile, TokenSearchResult } from '../game/types'
import { TokenSystem } from '../game/engine/TokenSystem'
import { TileSystem } from '../game/engine/TileSystem'
import { ConditionSystem } from '../game/engine/ConditionSystem'

export const useGameActions = () => {
  // ── Stable actions — do not trigger re-renders because references are stable ──
  const storeMoveHero = useGameStore((state) => state.moveHero);
  const storeAttackMonster = useGameStore((state) => state.attackMonster);
  const storeEndTurn = useGameStore((state) => state.endTurn);
  const storeSelectEntity = useGameStore((state) => state.selectEntity);
  const searchToken = useGameStore((state) => state.searchToken);
  const canSearchTokens = useGameStore((state) => state.canSearchTokens);
  const getTokensOnTile = useGameStore((state) => state.getTokensOnTile);

  const { addNotification } = useUIStore();

  // ---------------------------------------------------------------------------
  // Move hero — validated via square-level BFS (matches Castle Ravenloft 2010 rules)
  // ---------------------------------------------------------------------------
  const handleMoveHero = async (targetPosition: Position) => {
    // Read state imperatively at execution time
    const gameState = useGameStore.getState().gameState;
    if (!gameState) return;

    const hero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    if (!hero) return;

    // ── Condition guards ──────────────────────────────────────────────────────
    const isImmobilized = hero.conditions.some(c => c.type === 'immobilized');
    const isSlowed = hero.conditions.some(c => c.type === 'slowed');

    if (isImmobilized) {
      addNotification(`${hero.name} is Immobilized and cannot move!`, 'warning');
      return;
    }

    const effectiveSpeed = ConditionSystem.getEffectiveSpeed(hero, gameState);

    // ── Locate tiles in the placed graph ─────────────────────────────────────
    const sourceTile = gameState.tiles.find(
      t => t.x === hero.position.x && t.z === hero.position.z
    );
    const destTile = gameState.tiles.find(
      t => t.x === targetPosition.x && t.z === targetPosition.z
    );

    if (!destTile) {
      addNotification('Cannot move to an unexplored area.', 'warning');
      return;
    }

    // Clicking the exact square the hero is already on — no-op
    if (
      sourceTile?.id === destTile.id &&
      hero.position.sqX === targetPosition.sqX &&
      hero.position.sqZ === targetPosition.sqZ
    ) return;

    // ── Square-level BFS reachability check ───────────────────────────────────
    if (!sourceTile) {
      // Hero position doesn't match a placed tile (edge case) — allow
      storeMoveHero(targetPosition);
      return;
    }

    // Build monster-blocked squares (heroes can pass through heroes, not monsters)
    const TS = 4; // TILE_SIZE_SQUARES
    const blockedSquares = new Set<string>(
      gameState.monsters
        .filter(m => !m.isDefeated && m.hp > 0)
        .map(m => `${m.position.x * TS + m.position.sqX},${m.position.z * TS + m.position.sqZ}`)
    );

    const reachable = TileSystem.getReachableSquares(
      hero.position,
      gameState.tiles,
      effectiveSpeed,
      blockedSquares
    );

    const targetKey = `${destTile.id}:${targetPosition.sqX}:${targetPosition.sqZ}`;
    if (!reachable.has(targetKey)) {
      const suffix = isSlowed ? ' (Slowed — speed halved)' : '';
      addNotification(
        `${hero.name} cannot reach that square within ${effectiveSpeed} square${effectiveSpeed !== 1 ? 's' : ''}${suffix}.`,
        'warning'
      );
      return;
    }

    // ── Valid move — animate then commit ──────────────────────────────────────
    await animationQueue.enqueue('HeroMove', async () => {
      const animSpeed = useGameStore.getState().settings?.animationSpeed ?? 'normal';
      const delay = animSpeed === 'instant' ? 0 : animSpeed === 'fast' ? 50 : 150;
      if (delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    });

    storeMoveHero(targetPosition);

    const slowedSuffix = isSlowed ? ' (Slowed)' : '';
    addNotification(
      `${hero.name} moves to ${destTile.name || destTile.id}${slowedSuffix}.`,
      'success'
    );
  };

  // ---------------------------------------------------------------------------
  // Attack monster
  // ---------------------------------------------------------------------------
  const handleAttackMonster = async (monsterId: string) => {
    // Read state imperatively at execution time
    const gameState = useGameStore.getState().gameState;
    if (!gameState) return;

    const monster = gameState.monsters.find(m => m.id === monsterId);
    if (!monster) return;

    await animationQueue.enqueue('HeroAttack', async () => {
      console.log('Playing attack animation on:', monsterId);
      const animSpeed = useGameStore.getState().settings?.animationSpeed ?? 'normal';
      const delay = animSpeed === 'instant' ? 0 : animSpeed === 'fast' ? 70 : 200;
      if (delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    });

    storeAttackMonster(monsterId);
    addNotification(`Attacked ${monster.name}!`, 'info');
  };

  // ---------------------------------------------------------------------------
  // End Turn
  // ---------------------------------------------------------------------------
  const handleEndTurn = () => {
    // Read state imperatively at execution time
    const gameState = useGameStore.getState().gameState;
    if (gameState && gameState.phase === 'hero' && !gameState.hasExploredThisTurn) {
      const activeHero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
      if (activeHero) {
        const heroPos = activeHero.position;
        const heroTile = gameState.tiles.find(t => t.x === heroPos.x && t.z === heroPos.z);
        if (heroTile) {
          const points = TileSystem.getExplorationPoints(gameState.tiles);
          const isHeroAtEdgeFor = (edge: string): boolean => {
            switch (edge) {
              case 'north': return heroPos.sqZ === 0;
              case 'south': return heroPos.sqZ === 3;
              case 'east':  return heroPos.sqX === 3;
              case 'west':  return heroPos.sqX === 0;
              default:      return false;
            }
          };
          const explorablePoints = points.filter(p => p.tileId === heroTile.id && isHeroAtEdgeFor(p.edge));
          
          if (explorablePoints.length > 0 && gameState.dungeonDeck && gameState.dungeonDeck.length > 0) {
            useUIStore.getState().setInteractionMode('explore');
            addNotification('Exploration Required: You must explore the adjacent edge before ending your turn!', 'warning');
            return;
          }
        }
      }
    }

    storeEndTurn();
    addNotification('End of turn', 'info');
  };

  // ---------------------------------------------------------------------------
  // Entity selection
  // ---------------------------------------------------------------------------
  const handleSelectEntity = (entity: Entity | null) => {
    storeSelectEntity(entity);
  };

  // ---------------------------------------------------------------------------
  // Token Search Action
  // ---------------------------------------------------------------------------
  const handleSearchToken = async (tokenId: string): Promise<TokenSearchResult | null> => {
    // Read state imperatively at execution time
    const gameState = useGameStore.getState().gameState;
    if (!gameState) return null;

    const hero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    if (!hero) return null;

    // Check if hero can search tokens
    const searchCheck = canSearchTokens(hero.id);
    if (!searchCheck.canSearch) {
      addNotification(searchCheck.reason, 'warning');
      return null;
    }

    // Verify the token is on the hero's tile
    const token = searchCheck.tokens.find(t => t.id === tokenId);
    if (!token) {
      addNotification('Token not found on this tile.', 'warning');
      return null;
    }

    // Animate the search
    await animationQueue.enqueue('TokenSearch', async () => {
      const animSpeed = useGameStore.getState().settings?.animationSpeed ?? 'normal';
      const delay = animSpeed === 'instant' ? 0 : animSpeed === 'fast' ? 70 : 200;
      if (delay > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    });

    // Perform the search
    const searchRes = searchToken(tokenId);

    if (searchRes) {
      addNotification(searchRes.message, searchRes.success ? 'success' : 'info');

      // Check for victory condition (Strahd's coffin found)
      if (searchRes.revealedData?.isStrahdsCoffin) {
        addNotification("VICTORY! You have found Strahd's Coffin!", 'success');

        // Trigger victory modal via UI store
        useUIStore.getState().showModal('victory');
      }
    }

    return searchRes;
  };

  // ---------------------------------------------------------------------------
  // Get searchable tokens on current hero's tile
  // ---------------------------------------------------------------------------
  const getSearchableTokens = () => {
    // Read state imperatively at execution time
    const gameState = useGameStore.getState().gameState;
    if (!gameState) return [];

    const hero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    if (!hero) return [];

    const heroTile = gameState.tiles.find(
      t => t.x === hero.position.x && t.z === hero.position.z
    );

    if (!heroTile) return [];

    return getTokensOnTile(heroTile.id).filter(t => !t.isSearched);
  };

  // ---------------------------------------------------------------------------
  // Check if current hero can search
  // ---------------------------------------------------------------------------
  const canSearch = (): { canSearch: boolean; reason: string } => {
    // Read state imperatively at execution time
    const gameState = useGameStore.getState().gameState;
    if (!gameState) return { canSearch: false, reason: 'No game state' };

    const hero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
    if (!hero) return { canSearch: false, reason: 'No current hero' };

    return canSearchTokens(hero.id);
  };

  return {
    handleMoveHero,
    handleAttackMonster,
    handleEndTurn,
    handleSelectEntity,
    handleSearchToken,
    getSearchableTokens,
    canSearch,
  };
};
