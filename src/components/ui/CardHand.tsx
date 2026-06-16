import React, { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { DataLoader } from '../../game/dataLoader';
import { PowerCardDisplay } from './PowerCardDisplay';
import type { Card, Hero } from '../../game/types';

export const CardHand: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const { interactionMode, setInteractionMode, selectedPowerId, setSelectedPowerId } = useUIStore();
  const currentHero = useMemo(() => 
    gameState?.heroes?.find(h => h.id === gameState?.currentHeroId) as Hero | undefined
  , [gameState]);

  // Resolve card IDs to full card objects
  const powerCards = useMemo(() => {
    if (!currentHero) return [];
    console.log('[CardHand] Calculating power cards for:', currentHero.name);
    const ids = [...(currentHero.abilities || []), ...(currentHero.selectedPowerIds || [])];
    const uniqueIds = Array.from(new Set(ids));
    return uniqueIds.map(id => DataLoader.getInstance().getCardById(id)).filter(c => !!c) as Card[];
  }, [currentHero, currentHero?.abilities?.length, currentHero?.selectedPowerIds?.length]);

  const itemCards = useMemo(() => {
    if (!currentHero) return [];
    console.log('[CardHand] Calculating item cards for:', currentHero.name, 'count:', currentHero.items?.length);
    return (currentHero.items || []).map(id => DataLoader.getInstance().getCardById(id)).filter(c => !!c) as Card[];
  }, [currentHero, currentHero?.items?.length]);

  if (!currentHero) return null;

  return (
    <div className="card-hand-container shadow-2xl" style={{
      gridArea: 'bot',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: '20px',
      gap: '15px',
      pointerEvents: 'none',
      width: '100%'
    }}>


      {/* Hand (Powers + Items) */}
      <div className="powers-row" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: '12px',
        pointerEvents: 'auto',
        perspective: '1000px'
      }}>
        {[...powerCards, ...itemCards].map((card, index) => {
          const isItem = card.type === 'treasure';
          const isFlipped = (currentHero?.flippedPowerIds ?? []).includes(card.id);
          const isActiveAbility = interactionMode === 'ability' && selectedPowerId === card.id;
          const isDisabled = isFlipped || !!(gameState?.hasAttackedThisTurn && card.powerType !== 'utility' && !isItem);
          const numCards = powerCards.length + itemCards.length;
          
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
    </div>
  );
};

