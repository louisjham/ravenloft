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
  const treasureAssignments = useGameStore(s => s.gameState?.treasureAssignments ?? []);
  const hasUsableTreasure = treasureAssignments.some(a => a.heroId === currentHeroId && !a.isUsed);
  const searchStatus = canSearch();
  const searchableTokens = getSearchableTokens();
  const activeHero = gameState?.heroes.find(h => h.id === currentHeroId);
  const heroTile = gameState && activeHero
    ? gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z)
    : null;
  const canEscape = gameState?.activeScenario?.id === 'adventure_04' && heroTile?.id === 'start-tile' && !activeHero?.escaped && gameState?.phase === 'hero';
  const anyAliveMonsters = useGameStore(s => s.gameState?.monsters.some(m => !m.isDefeated && m.hp > 0) ?? false);
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

  const buttons = [
    { id: 'move', icon: '⬆', key: 'M', disabled: !hasMovement, title: 'Move' },
    { id: 'attack', icon: '⚔', key: 'A', disabled: !anyAliveMonsters, title: 'Attack' },
    { id: 'ability', icon: '✦', key: 'C', disabled: !hasUsablePowers, title: 'Ability' },
    { id: 'explore', icon: '🗺', key: 'E', disabled: !canExplore, title: 'Explore' },
    { id: 'endTurn', icon: '⏭', key: 'Space', disabled: false, title: 'End Turn' },
  ];

  const handleClick = (id: string) => {
    if (id === 'endTurn') {
      handleEndTurn();
      setInteractionMode('none');
    } else if (id === 'search') {
      if (searchableTokens.length > 0) handleSearchToken(searchableTokens[0].id);
    } else {
      setInteractionMode(interactionMode === id ? 'none' : id as any);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      pointerEvents: 'auto'
    }}>
      {buttons.map((btn) => {
        const isActive = interactionMode === btn.id;
        const isDisabled = btn.disabled || gameState?.phase !== 'hero';
        return (
          <button
            key={btn.id}
            title={`${btn.title} [${btn.key}]`}
            onClick={() => handleClick(btn.id)}
            disabled={isDisabled}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? 'rgba(0, 255, 255, 0.2)' : 'rgba(10, 10, 15, 0.6)',
              border: isActive ? '1px solid #00ffff' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '4px',
              color: isActive ? '#00ffff' : (isDisabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)'),
              fontSize: '1rem',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              padding: 0,
              backdropFilter: 'blur(4px)',
              boxShadow: isActive ? '0 0 8px rgba(0, 255, 255, 0.3)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            {btn.icon}
          </button>
        );
      })}

      <button
        title={`Search [S]${searchStatus.canSearch ? ` - ${searchableTokens.length} token(s)` : ''}`}
        onClick={() => handleClick('search')}
        disabled={gameState?.phase !== 'hero' || !searchStatus.canSearch}
        style={{
          width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10, 10, 15, 0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '4px',
          color: searchStatus.canSearch ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
          fontSize: '1rem',
          cursor: searchStatus.canSearch ? 'pointer' : 'not-allowed',
          padding: 0,
          backdropFilter: 'blur(4px)'
        }}
      >
        🔍
      </button>

      <button
        title={`Treasure [T]`}
        onClick={() => onOpenTreasure?.(currentHeroId ?? '')}
        disabled={gameState?.phase !== 'hero' || !hasUsableTreasure}
        style={{
          width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10, 10, 15, 0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '4px',
          color: hasUsableTreasure ? 'rgba(255,215,0,0.8)' : 'rgba(255,255,255,0.2)',
          fontSize: '1rem',
          cursor: hasUsableTreasure ? 'pointer' : 'not-allowed',
          padding: 0,
          backdropFilter: 'blur(4px)'
        }}
      >
        💎
      </button>

      {canEscape && (
        <button
          title="Escape Dungeon [Esc]"
          onClick={() => { if (currentHeroId) useGameStore.getState().escapeHero(currentHeroId); }}
          style={{
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255, 0, 255, 0.15)',
            border: '1px solid rgba(255, 0, 255, 0.4)',
            borderRadius: '4px',
            color: '#ff00ff',
            fontSize: '1rem',
            cursor: 'pointer',
            padding: 0,
            backdropFilter: 'blur(4px)',
            boxShadow: '0 0 8px rgba(255, 0, 255, 0.3)'
          }}
        >
          🚪
        </button>
      )}
    </div>
  );
};
