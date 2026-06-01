import React from 'react'
import { Entity } from '../../game/types'
import { useGameStore } from '../../store/gameStore'
import { useGameActions } from '../../hooks/useGameActions'

import { ThreeEvent } from '@react-three/fiber';

interface EntityInteractionProps {
  entity: Entity;
  children: React.ReactNode;
}

/**
 * Wraps a 3D Entity (Hero or Monster) to provide interaction logic.
 */
export const EntityInteraction: React.FC<EntityInteractionProps> = ({ entity, children }) => {
  const { selectedCard } = useGameStore();
  const { handleSelectEntity, handleAttackMonster } = useGameActions();

  const onEntityClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    
    // If we have an attack card/ability selected and target is a monster
    if (selectedCard && entity.type === 'monster') {
      handleAttackMonster(entity.id);
    } else {
      handleSelectEntity(entity);
    }
  };

  const onEntityHover = (e: ThreeEvent<MouseEvent>) => {
    // Show stats tooltip logic
  };

  return (
    <group 
      onClick={onEntityClick}
      onPointerOver={onEntityHover}
    >
      {children}
    </group>
  );
}
