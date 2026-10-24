import React, { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { DataLoader } from '../../game/dataLoader';
import { PowerCardDisplay } from './PowerCardDisplay';
import type { Card, Hero } from '../../game/types';

export const CardHand: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const { interactionMode, setInteractionMode, selectedPowerId, setSelectedPowerId } = useUIStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const currentHero = useMemo(() => 
    gameState?.heroes?.find(h => h.id === gameState?.currentHeroId) as Hero | undefined
  , [gameState]);

  // Resolve card IDs to full card objects
  const powerCards = useMemo(() => {
    if (!currentHero) return [];
    const ids = [...(currentHero.abilities || []), ...(currentHero.selectedPowerIds || [])];
    const uniqueIds = Array.from(new Set(ids));
    return uniqueIds.map(id => DataLoader.getInstance().getCardById(id)).filter(c => !!c) as Card[];
  }, [currentHero]);

  const itemCards = useMemo(() => {
    if (!currentHero) return [];
    return (currentHero.items || []).map(id => DataLoader.getInstance().getCardById(id)).filter(c => !!c) as Card[];
  }, [currentHero]);

  const totalCards = powerCards.length + itemCards.length;

  if (!currentHero || totalCards === 0) return null;

  return (
    <div className="card-hand-container" style={{
      gridArea: 'bot',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: '10px',
      gap: '8px',
      pointerEvents: 'none',
      width: '100%',
      position: 'relative',
      zIndex: 100,
    }}>
      {/* Collapse / Expand Toggle Tab */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          pointerEvents: 'auto',
          background: 'rgba(15, 12, 22, 0.92)',
          border: '1px solid rgba(192, 160, 96, 0.45)',
          borderRadius: '4px 4px 0 0',
          padding: '4px 14px',
          color: 'var(--color-gold)',
          fontFamily: 'var(--font-gothic)',
          fontSize: '0.75rem',
          letterSpacing: '1px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.6)',
          transform: isCollapsed ? 'translateY(10px)' : 'none',
          transition: 'transform 0.3s ease, background 0.2s ease',
        }}
        title={isCollapsed ? 'Expand card hand' : 'Collapse card hand to view board'}
      >
        <span>{isCollapsed ? '▲' : '▼'}</span>
        <span>
          {isCollapsed
            ? `Cards & Powers (${totalCards})`
            : 'Hide Cards'}
        </span>
      </button>

      {/* Hand (Powers + Items) */}
      {!isCollapsed && (
        <div className="powers-row" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '12px',
          pointerEvents: 'auto',
          perspective: '1000px',
          transition: 'all 0.3s ease',
        }}>
          {[...powerCards, ...itemCards].map((card, index) => {
            const isItem = card.type === 'treasure';
            const isFlipped = (currentHero?.flippedPowerIds ?? []).includes(card.id);
            const isActiveAbility = interactionMode === 'ability' && selectedPowerId === card.id;
            const isDisabled = isFlipped || !!(gameState?.hasAttackedThisTurn && card.powerType !== 'utility' && !isItem);
            const numCards = totalCards;
            
            return (
            <div key={`${card.id}-${index}`} className="card-wrapper" style={{
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              transform: `translateY(${gameState?.phase === 'hero' ? '0' : '60px'}) rotate(${(index - (numCards - 1) / 2) * 4}deg)`,
              transformOrigin: 'bottom center',
              zIndex: isActiveAbility ? 1000 : index,
              filter: isFlipped ? 'grayscale(0.7) brightness(0.6)' : 'none',
            }}
              onMouseEnter={(e) => {
                if (isActiveAbility || isFlipped) return;
                e.currentTarget.style.transform = `translateY(-100px) scale(1.1) rotate(0deg)`;
                e.currentTarget.style.zIndex = '500';
              }}
              onMouseLeave={(e) => {
                if (isActiveAbility || isFlipped) return;
                e.currentTarget.style.transform = `translateY(${gameState?.phase === 'hero' ? '0' : '60px'}) rotate(${(index - (numCards - 1) / 2) * 4}deg)`;
                e.currentTarget.style.zIndex = String(index);
              }}
            >
              <PowerCardDisplay
                card={card}
                isSelected={isActiveAbility}
                isDisabled={isDisabled}
                isFlipped={isFlipped}
                showDetails={!isFlipped}
                onSelect={() => {
                  if (isDisabled) return;
                  setInteractionMode('ability');
                  setSelectedPowerId(card.id);
                }}
                onDeselect={() => {
                  setInteractionMode('none');
                  setSelectedPowerId(null);
                }}
              />
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
