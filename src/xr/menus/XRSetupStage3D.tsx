import React, { useState, useMemo, Suspense } from 'react';
import { useXR, Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { PhysicalCard3D } from '../cards/PhysicalCard3D';
import { GamePiece } from '../../components/3d/GamePiece';
import { getHeroModelPath, DUMMY_MODE } from '../../utils/modelLoader';
import PowerSelectionSystem from '../../game/engine/PowerSelectionSystem';
import { Card } from '../../game/types';
import { playHapticProfile } from '../XRHaptics';

const HeroPedestalPiece: React.FC<{ heroClass: string; isSelected: boolean }> = ({ heroClass, isSelected }) => {
  const modelUrl = getHeroModelPath(heroClass);

  return (
    <group position={[0, 0.012, 0]}>
      {DUMMY_MODE ? (
        <mesh position={[0, 0.035, 0]}>
          <boxGeometry args={[0.035, 0.07, 0.035]} />
          <meshStandardMaterial color={isSelected ? '#f5dfa3' : '#4444aa'} />
        </mesh>
      ) : (
        <Suspense
          fallback={
            <mesh position={[0, 0.035, 0]}>
              <boxGeometry args={[0.035, 0.07, 0.035]} />
              <meshStandardMaterial color="#4444aa" />
            </mesh>
          }
        >
          <GamePiece
            url={modelUrl}
            position={[0, 0.02, 0]}
            rotation={[0, 0, 0]}
            scale={0.075}
          />
        </Suspense>
      )}
    </group>
  );
};

/**
 * XRSetupStage3D renders a 3D Hall of Heroes pedestal and physical power card fan
 * during the game setup phase in WebXR.
 */
export const XRSetupStage3D: React.FC = () => {
  const { isPresenting } = useXR();
  const gameState = useGameStore((state) => state.gameState);
  const selectPower = useGameStore((state) => state.selectPower);
  const deselectPower = useGameStore((state) => state.deselectPower);
  const autoSelectPowers = useGameStore((state) => state.autoSelectPowers);
  const confirmHeroSelection = useGameStore((state) => state.confirmHeroSelection);
  const beginAdventure = useGameStore((state) => state.beginAdventure);

  const heroes = useMemo(() => gameState?.heroes ?? [], [gameState]);
  const powerSelections = useMemo(() => gameState?.powerSelections ?? [], [gameState]);

  const [activeHeroId, setActiveHeroId] = useState<string>(heroes[0]?.id ?? '');

  // Keep activeHeroId valid if heroes load
  const currentHeroId = activeHeroId || heroes[0]?.id || '';
  const activeHero = useMemo(() => heroes.find((h) => h.id === currentHeroId), [heroes, currentHeroId]);
  const activeSelection = useMemo(() => powerSelections.find((s) => s.heroId === currentHeroId), [powerSelections, currentHeroId]);

  // Available powers for active hero
  const availablePowers = useMemo(() => {
    if (!activeHero) return [];
    return PowerSelectionSystem.getAvailablePowers(activeHero.heroClass);
  }, [activeHero]);

  // Check if all heroes are confirmed
  const allConfirmed = useMemo(() => {
    if (heroes.length === 0) return false;
    return heroes.every((h) => powerSelections.find((s) => s.heroId === h.id)?.isConfirmed);
  }, [heroes, powerSelections]);

  if (!isPresenting || !gameState || gameState.phase !== 'setup' || !activeHero) {
    return null;
  }

  const handleCardClick = (card: Card) => {
    if (!activeSelection) return;
    const isSelected = activeSelection.selectedPowerIds.includes(card.id);
    playHapticProfile('click');

    if (isSelected) {
      deselectPower(activeHero.id, card.id);
    } else {
      selectPower(activeHero.id, card);
    }
  };

  const handleAutoEquipAll = () => {
    playHapticProfile('rollDice');
    heroes.forEach((h) => autoSelectPowers(h.id));
  };

  const handleConfirmHero = () => {
    playHapticProfile('click');
    confirmHeroSelection(activeHero.id);

    // Switch to next unconfirmed hero
    const nextUnconfirmed = heroes.find(
      (h) => h.id !== activeHero.id && !powerSelections.find((s) => s.heroId === h.id)?.isConfirmed
    );
    if (nextUnconfirmed) {
      setActiveHeroId(nextUnconfirmed.id);
    }
  };

  const handleEmbark = () => {
    playHapticProfile('rollDice');
    // Ensure all heroes are auto-selected if not yet confirmed
    heroes.forEach((h) => {
      const sel = powerSelections.find((s) => s.heroId === h.id);
      if (!sel || !sel.isConfirmed) {
        autoSelectPowers(h.id);
      }
    });
    beginAdventure();
  };

  const selectedCount = activeSelection?.selectedPowerIds.length ?? 0;
  const constraints = PowerSelectionSystem.getConstraints(activeHero.heroClass);

  return (
    <group position={[0, 0.95, -0.85]}>
      {/* Title & Active Hero Banner */}
      <group position={[0, 0.45, 0]}>
        <Text fontSize={0.055} color="#f5dfa3" textAlign="center" position={[0, 0.04, 0]}>
          HALL OF HEROES
        </Text>
        <Text fontSize={0.03} color="#ffffff" textAlign="center" position={[0, -0.02, 0]}>
          {`${activeHero.name} (${activeHero.heroClass.toUpperCase()})`}
        </Text>
        <Text fontSize={0.02} color="#a09080" textAlign="center" position={[0, -0.06, 0]}>
          {`Selected Powers: ${selectedCount} / ${constraints.totalMax}`}
        </Text>
      </group>

      {/* Hero Selection Pedestals */}
      <group position={[0, 0.22, 0.1]}>
        {heroes.map((hero, idx) => {
          const isSelected = hero.id === currentHeroId;
          const isConfirmed = powerSelections.find((s) => s.heroId === hero.id)?.isConfirmed;
          const xPos = (idx - (heroes.length - 1) / 2) * 0.18;

          return (
            <Interactive
              key={hero.id}
              onSelect={() => {
                playHapticProfile('click');
                setActiveHeroId(hero.id);
              }}
            >
              <group
                position={[xPos, 0, 0]}
                onClick={() => {
                  playHapticProfile('click');
                  setActiveHeroId(hero.id);
                }}
                scale={isSelected ? 1.15 : 1.0}
              >
                {/* Pedestal Base */}
                <mesh position={[0, 0, 0]} receiveShadow>
                  <cylinderGeometry args={[0.07, 0.08, 0.02, 16]} />
                  <meshStandardMaterial
                    color={isSelected ? '#7a2222' : isConfirmed ? '#1e4d2b' : '#22222a'}
                    roughness={0.7}
                  />
                </mesh>

                {/* Hero 3D Miniature Figure */}
                <HeroPedestalPiece heroClass={hero.heroClass} isSelected={isSelected} />

                {/* Selection Light Beacon */}
                {isSelected && (
                  <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.07, 0.085, 16]} />
                    <meshBasicMaterial color="#f5dfa3" side={2} />
                  </mesh>
                )}

                {/* Hero Label */}
                <Text fontSize={0.018} color={isSelected ? '#ffffff' : '#c0b0a0'} position={[0, -0.025, 0.04]}>
                  {hero.name}
                </Text>
              </group>
            </Interactive>
          );
        })}
      </group>

      {/* Available 3D Power Cards Fan */}
      <group position={[0, -0.05, 0.25]} rotation={[-Math.PI / 12, 0, 0]}>
        {availablePowers.map((card, idx) => {
          const isEquipped = activeSelection?.selectedPowerIds.includes(card.id) ?? false;
          const count = availablePowers.length;
          const arcSpan = Math.min(0.18 * count, 1.4);
          const t = count === 1 ? 0.5 : idx / (count - 1);
          const angle = -arcSpan / 2 + t * arcSpan;

          const posX = Math.sin(angle) * 0.8;
          const posZ = -Math.cos(angle) * 0.8 + 0.8;
          const posY = isEquipped ? 0.05 : 0;

          return (
            <PhysicalCard3D
              key={card.id}
              card={card}
              position={[posX, posY, posZ]}
              rotation={[0, angle, -angle * 0.4]}
              scale={isEquipped ? 1.08 : 0.95}
              onSelect={() => handleCardClick(card)}
            />
          );
        })}
      </group>

      {/* Bottom Setup Action Buttons */}
      <group position={[0, -0.28, 0.35]}>
        {/* Auto-Equip All Button */}
        <Interactive onSelect={handleAutoEquipAll}>
          <group position={[-0.24, 0, 0]} onClick={handleAutoEquipAll}>
            <mesh>
              <boxGeometry args={[0.18, 0.045, 0.01]} />
              <meshStandardMaterial color="#2d223a" roughness={0.6} />
            </mesh>
            <Text fontSize={0.016} color="#c5a059" position={[0, 0, 0.007]} textAlign="center">
              AUTO-EQUIP PARTY
            </Text>
          </group>
        </Interactive>

        {/* Confirm Hero Button */}
        <Interactive onSelect={handleConfirmHero}>
          <group position={[0, 0, 0]} onClick={handleConfirmHero}>
            <mesh>
              <boxGeometry args={[0.18, 0.045, 0.01]} />
              <meshStandardMaterial color={activeSelection?.isConfirmed ? '#1e4d2b' : '#4a2574'} roughness={0.6} />
            </mesh>
            <Text fontSize={0.016} color="#ffffff" position={[0, 0, 0.007]} textAlign="center">
              {activeSelection?.isConfirmed ? 'HERO READY ✓' : 'CONFIRM HERO'}
            </Text>
          </group>
        </Interactive>

        {/* Embark / Begin Adventure Button */}
        <Interactive onSelect={handleEmbark}>
          <group position={[0.24, 0, 0]} onClick={handleEmbark}>
            <mesh>
              <boxGeometry args={[0.18, 0.045, 0.01]} />
              <meshStandardMaterial color={allConfirmed ? '#7a1c1c' : '#522020'} roughness={0.6} />
            </mesh>
            <Text fontSize={0.016} color="#f5dfa3" position={[0, 0, 0.007]} textAlign="center">
              BEGIN ADVENTURE
            </Text>
          </group>
        </Interactive>
      </group>
    </group>
  );
};

export default XRSetupStage3D;
