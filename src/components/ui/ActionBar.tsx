import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useGameActions } from '../../hooks/useGameActions';

interface ActionBarProps {
  onOpenTreasure?: (heroId: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ onOpenTreasure }) => {
  const gameState = useGameStore((state) => state.gameState);
  const { handleEndTurn, canSearch, getSearchableTokens, handleSearchToken } = useGameActions();

  const currentHeroId = useGameStore(s => s.gameState?.currentHeroId);
  const { interactionMode, setInteractionMode } = useUIStore();
  const treasureAssignments = useGameStore(
    s => s.gameState?.treasureAssignments ?? []
  );
  const hasUsableTreasure = treasureAssignments.some(
    a => a.heroId === currentHeroId && !a.isUsed
  );

  const searchStatus = canSearch();
  const searchableTokens = getSearchableTokens();

  const activeHero = gameState?.heroes.find(h => h.id === currentHeroId);
  const heroTile = gameState && activeHero
    ? gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z)
    : null;
  const canEscape = gameState?.activeScenario?.id === 'adventure_04' && heroTile?.id === 'start-tile' && !activeHero?.escaped && gameState?.phase === 'hero';

  const anyAliveMonsters = useGameStore(s =>
    s.gameState?.monsters.some(m => !m.isDefeated && m.hp > 0) ?? false
  );

  const hasUsablePowers = useGameStore(s => {
    if (!s.gameState) return false;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    return hero ? !!hero.hand && hero.hand.length > 0 : false;
  });

  const hasMovement = useGameStore(s => {
    if (!s.gameState) return false;
    const hero = s.gameState.heroes.find(h => h.id === s.gameState!.currentHeroId);
    return hero ? !hero.isExhausted : false;
  });

  const canExplore = useGameStore(s => {
    if (!s.gameState) return false;
    return !s.gameState.hasExploredThisTurn;
  });

  const actions = [
    { id: 'move', label: 'Move', key: 'M', isDisabled: !hasMovement },
    { id: 'attack', label: 'Attack', key: 'A', isDisabled: !anyAliveMonsters },
    { id: 'ability', label: 'Ability', key: 'C', isDisabled: !hasUsablePowers },
    { id: 'explore', label: 'Explore', key: 'E', isDisabled: !canExplore },
    { id: 'endTurn', label: 'End Turn', key: 'Space', isDisabled: false },
  ];

  const onActionClick = (actionId: string) => {
    if (actionId === 'endTurn') {
      handleEndTurn();
      setInteractionMode('none');
    } else if (actionId === 'search') {
      if (searchableTokens.length > 0) {
        handleSearchToken(searchableTokens[0].id);
      }
    } else {
      const mode = actionId as any;
      setInteractionMode(interactionMode === mode ? 'none' : mode);
    }
  };

  return (
    <div className="action-bar gothic-panel" style={{
      alignSelf: 'end',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      padding: '10px',
    }}>
      <h3 className="gothic-title" style={{ fontSize: '0.75rem', margin: '0 0 6px 0', letterSpacing: '1px' }}>Actions</h3>
      {actions.map((action) => {
        const isActive = interactionMode === action.id;
        const isDisabledState = action.isDisabled || gameState?.phase !== 'hero';
        return (
          <button
            key={action.id}
            className={`gothic-button ${isActive ? 'active' : ''}`}
            onClick={() => onActionClick(action.id)}
            disabled={isDisabledState}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 8px',
              fontSize: '0.7rem',
              boxShadow: isActive ? '0 0 8px rgba(0, 255, 255, 0.4)' : 'none',
              borderColor: isActive ? '#00ffff' : undefined,
              color: isActive ? '#00ffff' : undefined,
              opacity: isDisabledState ? 0.4 : 1,
              cursor: isDisabledState ? 'not-allowed' : 'pointer'
            }}
          >
            <span>{action.label}</span>
            <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>[{action.key}]</span>
          </button>
        );
      })}

      <button
        className="gothic-button"
        onClick={() => onActionClick('search')}
        disabled={gameState?.phase !== 'hero' || !searchStatus.canSearch}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
          fontSize: '0.7rem',
          opacity: searchStatus.canSearch ? 1 : 0.5
        }}
        title={searchStatus.canSearch ? `Search ${searchableTokens.length} token(s) on this tile` : searchStatus.reason}
      >
        <span>Search{searchableTokens.length > 0 ? ` (${searchableTokens.length})` : ''}</span>
        <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>[S]</span>
      </button>

      <button
        className="gothic-button"
        onClick={() => onOpenTreasure?.(currentHeroId ?? '')}
        disabled={gameState?.phase !== 'hero' || !hasUsableTreasure}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px',
          fontSize: '0.7rem'
        }}
      >
        <span>Treasure</span>
        <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>[T]</span>
      </button>

      {canEscape && (
        <button
          className="gothic-button"
          onClick={() => {
            if (currentHeroId) {
              useGameStore.getState().escapeHero(currentHeroId);
            }
          }}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: '0.7rem',
            borderColor: '#ff00ff',
            color: '#ff00ff',
            boxShadow: '0 0 8px rgba(255, 0, 255, 0.4)'
          }}
        >
          <span>Escape</span>
          <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>[Esc]</span>
        </button>
      )}
    </div>
  );
};
