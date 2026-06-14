import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { animationQueue } from '../utils/animationQueue'
import { Position, Entity, Tile, TokenSearchResult } from '../game/types'
import { TokenSystem } from '../game/engine/TokenSystem'
import { TileSystem } from '../game/engine/TileSystem'
import { ConditionSystem } from '../game/engine/ConditionSystem'

export const useGameActions = () => {
  const {
    gameState,
    moveHero: storeMoveHero,
    attackMonster: storeAttackMonster,
    endTurn: storeEndTurn,
    selectEntity: storeSelectEntity,
    searchToken,
    canSearchTokens,
    getTokensOnTile,
  } = useGameStore();

  const { addNotification } = useUIStore();

  // ---------------------------------------------------------------------------
  // Move hero — validated via square-level BFS (matches Castle Ravenloft 2010 rules)
  // ---------------------------------------------------------------------------
  const handleMoveHero = async (targetPosition: Position) => {
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
      await new Promise<void>(resolve => setTimeout(resolve, 350));
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
    if (!gameState) return;

    const monster = gameState.monsters.find(m => m.id === monsterId);
    if (!monster) return;

    await animationQueue.enqueue('HeroAttack', async () => {
      console.log('Playing attack animation on:', monsterId);
      await new Promise<void>(resolve => setTimeout(resolve, 800));
    });

    storeAttackMonster(monsterId);
    addNotification(`Attacked ${monster.name}!`, 'info');
  };

  // ---------------------------------------------------------------------------
  // End Turn
  // ---------------------------------------------------------------------------
  const handleEndTurn = () => {
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
      await new Promise<void>(resolve => setTimeout(resolve, 500));
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
