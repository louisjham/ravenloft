import React, { useMemo } from 'react';
import { useXR } from '@react-three/xr';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { DataLoader } from '../../game/dataLoader';
import { PhysicalCard3D } from './PhysicalCard3D';
import { Card } from '../../game/types';

/**
 * CardHandDock3D renders a floating, curved card fan in front of the player
 * containing the active hero's chosen Power Cards and equipped Treasure Items.
 */
export const CardHandDock3D: React.FC = () => {
  const { isPresenting } = useXR();
  const phase = useGameStore((state) => state.gameState?.phase);
  const activeHero = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs || !gs.currentHeroId) return null;
    return gs.heroes.find((h) => h.id === gs.currentHeroId) ?? null;
  });

  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);

  const xrTableTransform = useUIStore((state) => state.xrTableTransform);

  // Collect active hero's power cards and items
  const heroCards = useMemo(() => {
    if (!activeHero) return [];
    const loader = DataLoader.getInstance();
    const powerIds = activeHero.selectedPowerIds ?? activeHero.abilities ?? [];
    const itemIds = activeHero.items ?? [];

    const cards: Card[] = [];
    [...powerIds, ...itemIds].forEach((id) => {
      const card = loader.getCardById(id);
      if (card) cards.push(card);
    });
    return cards;
  }, [activeHero]);

  if (!isPresenting || !phase || phase === 'setup' || heroCards.length === 0) {
    return null;
  }

  const handleSelectCard = (card: Card) => {
    if (selectedPowerId === card.id) {
      setSelectedPowerId(null);
      setInteractionMode('none');
    } else {
      setSelectedPowerId(card.id);
      setInteractionMode('ability');
    }
  };

  const cardCount = heroCards.length;
  const radius = 0.70; // Curvature arc radius in meters
  const arcSpan = Math.min(0.18 * cardCount, 1.1); // Total arc angle in radians

  return (
    <group position={[0, 0.78, -0.45]} rotation={[-Math.PI / 6, 0, 0]}>
      {heroCards.map((card, idx) => {
        // Compute fan arc position and angle
        const t = cardCount === 1 ? 0.5 : idx / (cardCount - 1);
        const angle = -arcSpan / 2 + t * arcSpan;

        const posX = Math.sin(angle) * radius;
        const posZ = -Math.cos(angle) * radius + radius;
        const posY = -Math.abs(angle) * 0.04; // Gentle downward dip at the edges

        const isUsed = activeHero?.flippedPowerIds?.includes(card.id) ?? false;
        const isSelected = selectedPowerId === card.id;

        return (
          <PhysicalCard3D
            key={card.id}
            card={card}
            position={[posX, isSelected ? posY + 0.05 : posY, isSelected ? posZ + 0.03 : posZ]}
            rotation={[0, angle, -angle * 0.4]}
            scale={isSelected ? 1.12 : 1.0}
            isUsed={isUsed}
            onSelect={handleSelectCard}
          />
        );
      })}
    </group>
  );
};

export default CardHandDock3D;
