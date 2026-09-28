import React, { useState } from 'react';
import { useXR, Interactive } from '@react-three/xr';
import { useGameStore } from '../../store/gameStore';
import { DataLoader } from '../../game/dataLoader';
import { PhysicalCard3D } from './PhysicalCard3D';
import { Text } from '@react-three/drei';
import { playHapticProfile } from '../XRHaptics';

/**
 * SpatialCardPresenter3D deals and presents drawn Encounter and Treasure cards
 * in 3D space directly in front of the player's view during resolution phases.
 */
export const SpatialCardPresenter3D: React.FC = () => {
  const { isPresenting } = useXR();
  const cardResolution = useGameStore((state) => state.gameState?.cardResolution);
  const dismissCardResolution = useGameStore((state) => state.dismissCardResolution);
  const advanceCardResolution = useGameStore((state) => state.advanceCardResolution);

  const [isFlipped, setIsFlipped] = useState(false);

  if (!isPresenting || !cardResolution || cardResolution.phase === 'idle' || !cardResolution.cardId) {
    return null;
  }

  const card = DataLoader.getInstance().getCardById(cardResolution.cardId);
  if (!card) return null;

  const handleResolve = () => {
    playHapticProfile('click');
    if (cardResolution.phase === 'revealing' || cardResolution.phase === 'resolving') {
      advanceCardResolution();
    } else {
      dismissCardResolution();
    }
  };

  const handleFlip = () => {
    playHapticProfile('hover');
    setIsFlipped((prev) => !prev);
  };

  return (
    <group position={[0, 1.18, -0.65]} rotation={[-Math.PI / 16, 0, 0]}>
      {/* 3D Physical Card */}
      <PhysicalCard3D
        card={card}
        position={[0, 0, 0]}
        scale={1.25}
        isFlipped={isFlipped}
        onFlipToggle={handleFlip}
        onSelect={handleFlip}
      />

      {/* Floating 3D Action Controls */}
      <group position={[0, -0.19, 0.03]}>
        {/* Flip Card Button */}
        <Interactive onSelect={handleFlip}>
          <group position={[-0.09, 0, 0]} onClick={handleFlip}>
            <mesh>
              <boxGeometry args={[0.12, 0.045, 0.015]} />
              <meshStandardMaterial color="#2d1c3a" roughness={0.6} />
            </mesh>
            <Text fontSize={0.018} color="#c5a059" position={[0, 0, 0.009]} textAlign="center">
              FLIP
            </Text>
          </group>
        </Interactive>

        {/* Resolve / Continue Button */}
        <Interactive onSelect={handleResolve}>
          <group position={[0.09, 0, 0]} onClick={handleResolve}>
            <mesh>
              <boxGeometry args={[0.14, 0.045, 0.015]} />
              <meshStandardMaterial color="#1e4d2b" roughness={0.6} />
            </mesh>
            <Text fontSize={0.018} color="#ffffff" position={[0, 0, 0.009]} textAlign="center">
              RESOLVE
            </Text>
          </group>
        </Interactive>
      </group>
    </group>
  );
};

export default SpatialCardPresenter3D;
