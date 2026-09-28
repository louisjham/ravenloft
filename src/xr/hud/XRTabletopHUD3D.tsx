import React, { useState, useMemo } from 'react';
import { useXR, Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { playHapticProfile } from '../XRHaptics';

interface HUDButtonProps {
  label: string;
  subtext?: string;
  position: [number, number, number];
  width?: number;
  active?: boolean;
  color?: string;
  onClick: () => void;
}

const HUDButton3D: React.FC<HUDButtonProps> = ({
  label,
  subtext,
  position,
  width = 0.16,
  active = false,
  color = '#2d1c3a',
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    playHapticProfile('click');
    onClick();
  };

  const bgColor = active ? '#1e5e3a' : hovered ? '#4a2574' : color;
  const borderColor = active ? '#55ff88' : hovered ? '#f5dfa3' : '#c5a059';

  return (
    <Interactive
      onSelect={handleClick}
      onHover={() => {
        setHovered(true);
        playHapticProfile('hover');
      }}
      onBlur={() => setHovered(false)}
    >
      <group
        position={position}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          playHapticProfile('hover');
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        scale={hovered ? 1.08 : 1.0}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, 0.05, 0.012]} />
          <meshStandardMaterial color={bgColor} roughness={0.6} metalness={0.1} />
        </mesh>

        <mesh position={[0, 0, 0.007]}>
          <boxGeometry args={[width - 0.008, 0.042, 0.002]} />
          <meshBasicMaterial color={borderColor} wireframe />
        </mesh>

        <Text
          position={[0, subtext ? 0.006 : 0, 0.01]}
          fontSize={0.016}
          color={hovered || active ? '#ffffff' : '#f5dfa3'}
          textAlign="center"
        >
          {label}
        </Text>

        {subtext && (
          <Text position={[0, -0.012, 0.01]} fontSize={0.01} color="#a09080" textAlign="center">
            {subtext}
          </Text>
        )}
      </group>
    </Interactive>
  );
};

/**
 * XRTabletopHUD3D renders the in-world action bar, active hero status,
 * tile placement dial, and game-over altar in WebXR.
 */
export const XRTabletopHUD3D: React.FC = () => {
  const { isPresenting } = useXR();
  const phase = useGameStore((state) => state.gameState?.phase);
  const currentHeroId = useGameStore((state) => state.gameState?.currentHeroId);
  const healingSurges = useGameStore((state) => state.gameState?.healingSurges ?? 2);
  const activeHero = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs || !gs.currentHeroId) return null;
    return gs.heroes.find((h) => h.id === gs.currentHeroId) ?? null;
  });

  const endTurn = useGameStore((state) => state.endTurn);
  const setGameState = useGameStore((state) => state.setGameState);

  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  if (!isPresenting || !phase || phase === 'setup') {
    return null;
  }

  const isHeroPhase = phase === 'hero';
  const isVictory = phase === 'victory';
  const isDefeat = phase === 'defeat';

  // Victory / Defeat Altar
  if (isVictory || isDefeat) {
    return (
      <group position={[0, 1.25, -0.85]}>
        <mesh receiveShadow>
          <boxGeometry args={[1.0, 0.55, 0.03]} />
          <meshStandardMaterial color={isVictory ? '#10301a' : '#301010'} roughness={0.7} />
        </mesh>

        <mesh position={[0, 0, 0.016]}>
          <boxGeometry args={[0.96, 0.51, 0.002]} />
          <meshBasicMaterial color={isVictory ? '#55ff88' : '#ff4444'} wireframe />
        </mesh>

        <Text
          fontSize={0.075}
          color={isVictory ? '#f5dfa3' : '#ff6666'}
          position={[0, 0.14, 0.02]}
          textAlign="center"
        >
          {isVictory ? 'VICTORY' : 'DEFEAT'}
        </Text>

        <Text
          fontSize={0.024}
          color="#d0c0b0"
          position={[0, 0.04, 0.02]}
          textAlign="center"
        >
          {isVictory ? 'The darkness recedes and Castle Ravenloft is cleansed!' : 'Your party has fallen into the darkness...'}
        </Text>

        <HUDButton3D
          label="RETURN TO MAIN MENU"
          position={[0, -0.14, 0.02]}
          width={0.36}
          color="#451820"
          onClick={() => {
            playHapticProfile('rollDice');
            setGameState(null as any);
          }}
        />
      </group>
    );
  }

  return (
    <group position={[0, 1.06, -0.68]} rotation={[-Math.PI / 7, 0, 0]}>
      {/* HUD Backdrop Rail */}
      <mesh position={[0, 0, -0.01]} receiveShadow>
        <boxGeometry args={[0.82, 0.10, 0.015]} />
        <meshStandardMaterial color="#0e0a14" roughness={0.8} metalness={0.2} />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.80, 0.085, 0.002]} />
        <meshBasicMaterial color="#a08040" wireframe />
      </mesh>

      {/* Hero Stats (Left side) */}
      {activeHero && (
        <group position={[-0.26, 0, 0.01]}>
          <Text fontSize={0.020} color="#ffffff" position={[0, 0.015, 0]} textAlign="center">
            {activeHero.name}
          </Text>
          <Text fontSize={0.014} color="#f5dfa3" position={[0, -0.015, 0]} textAlign="center">
            {`HP: ${activeHero.hp}/${activeHero.maxHp}  |  Surges: ${healingSurges}`}
          </Text>
        </group>
      )}

      {/* Action Buttons (Center & Right side) */}
      {isHeroPhase && (
        <group position={[0.12, 0, 0.01]}>
          {/* Move Button */}
          <HUDButton3D
            label="MOVE"
            subtext={interactionMode === 'move' ? 'SELECT TILE' : undefined}
            position={[-0.14, 0, 0]}
            width={0.13}
            active={interactionMode === 'move'}
            onClick={() => setInteractionMode(interactionMode === 'move' ? 'none' : 'move')}
          />

          {/* Attack Button */}
          <HUDButton3D
            label="ATTACK"
            subtext={interactionMode === 'attack' ? 'TARGET' : undefined}
            position={[0.0, 0, 0]}
            width={0.13}
            active={interactionMode === 'attack'}
            color="#451818"
            onClick={() => setInteractionMode(interactionMode === 'attack' ? 'none' : 'attack')}
          />

          {/* End Turn Button */}
          <HUDButton3D
            label="END TURN"
            position={[0.15, 0, 0]}
            width={0.14}
            color="#3d1e5a"
            onClick={() => {
              playHapticProfile('click');
              endTurn();
            }}
          />
        </group>
      )}

      {!isHeroPhase && (
        <group position={[0.14, 0, 0.01]}>
          <Text fontSize={0.020} color="#f5dfa3" textAlign="center">
            {`${phase.toUpperCase()} PHASE`}
          </Text>
        </group>
      )}
    </group>
  );
};

export default XRTabletopHUD3D;
