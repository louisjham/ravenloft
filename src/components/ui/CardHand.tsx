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
      {/* Items Section */}
      {itemCards.length > 0 && (
        <div className="items-row" style={{
          display: 'flex',
          gap: '12px',
          pointerEvents: 'auto',
          background: 'rgba(0,0,0,0.4)',
          padding: '8px 16px',
          borderRadius: '20px',
          border: '1px solid rgba(192, 160, 96, 0.3)',
          backdropFilter: 'blur(4px)',
          marginBottom: '-5px',
          zIndex: 10
        }}>
          <span style={{ 
            color: '#c0a060', 
            fontFamily: 'Cinzel, serif', 
            fontSize: '0.8rem', 
            alignSelf: 'center',
            marginRight: '8px',
            letterSpacing: '1px'
          }}>TREASURES :</span>
          {itemCards.map((card, i) => (
            <div key={`item-${card.id}-${i}`} className="item-token" style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ffd700, #b8860b)',
              border: '2px solid #555',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
              transition: 'all 0.2s'
            }}
              title={`${card.name}: ${card.description}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2) translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 0 15px #ffd700';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
              }}
            >
              <img src="/icons/treasure_chest.png" style={{ width: '24px', opacity: 0.9 }} alt="treasure" 
                onError={(e) => { (e.target as any).style.display = 'none'; (e.target as any).parentElement.innerText = '💎'; }} 
              />
            </div>
          ))}
        </div>
      )}

      {/* Powers (The Main Hand) */}
      <div className="powers-row" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: '12px',
        pointerEvents: 'auto',
        perspective: '1000px'
      }}>
        {powerCards.map((card, index) => {
          const isFlipped = (currentHero?.flippedPowerIds ?? []).includes(card.id);
          const isActiveAbility = interactionMode === 'ability' && selectedPowerId === card.id;
          return (
          <div key={`${card.id}-${index}`} className="card-wrapper" style={{
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: `translateY(${gameState?.phase === 'hero' ? '0' : '60px'}) rotate(${(index - (powerCards.length - 1) / 2) * 4}deg)`,
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
              e.currentTarget.style.transform = `translateY(${gameState?.phase === 'hero' ? '0' : '60px'}) rotate(${(index - (powerCards.length - 1) / 2) * 4}deg)`;
              e.currentTarget.style.zIndex = String(index);
            }}
          >
            <PowerCardDisplay
              card={card}
              isSelected={isActiveAbility}
              isDisabled={isFlipped || false}
              isFlipped={isFlipped}
              showDetails={!isFlipped}
              onSelect={() => {
                if (isFlipped) return;
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

