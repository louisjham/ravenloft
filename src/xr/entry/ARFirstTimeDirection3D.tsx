import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR, Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { playHapticProfile } from '../XRHaptics';

/**
 * ARFirstTimeDirection3D provides clear, one-step-at-a-time guidance
 * to ensure new players understand what is happening and what to do first,
 * with ghost highlights pointing directly to the required action.
 */
export const ARFirstTimeDirection3D: React.FC = () => {
  const { isPresenting } = useXR();
  const arEntryStage = useUIStore((state) => state.arEntryStage);
  const arDirectionDismissed = useUIStore((state) => state.arDirectionDismissed);
  const dismissARDirection = useUIStore((state) => state.dismissARDirection);
  const showSetupScreen = useUIStore((state) => state.showSetupScreen);
  const gameState = useGameStore((state) => state.gameState);

  const [dismissHovered, setDismissHovered] = useState(false);
  const ghostBeaconRef = useRef<THREE.Group>(null);
  const heroMovedRef = useRef<boolean>(false);

  // Auto-dismiss step 3 once hero moves from initial square (1, 1)
  const activeHeroPos = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs || !gs.currentHeroId) return null;
    const hero = gs.heroes.find((h) => h.id === gs.currentHeroId);
    return hero ? { x: hero.position.x, z: hero.position.z, sqX: hero.position.sqX, sqZ: hero.position.sqZ } : null;
  });

  useFrame((state) => {
    // Pulse ghost beacon
    if (ghostBeaconRef.current) {
      const time = state.clock.getElapsedTime();
      const scale = 1.0 + Math.sin(time * 4) * 0.12;
      ghostBeaconRef.current.scale.set(scale, scale, scale);
    }

    // Check if active hero has moved away from start square
    if (gameState && gameState.phase === 'hero' && activeHeroPos && !heroMovedRef.current) {
      if (activeHeroPos.sqX !== 1 || activeHeroPos.sqZ !== 1 || activeHeroPos.x !== 0 || activeHeroPos.z !== 0) {
        heroMovedRef.current = true;
        dismissARDirection();
      }
    }
  });

  if (!isPresenting || arDirectionDismissed || arEntryStage === 'idle' || arEntryStage === 'loading') {
    return null;
  }

  const handleDismiss = () => {
    playHapticProfile('click');
    dismissARDirection();
  };

  // Determine current direction step
  let stepNumber = 1;
  let title = 'STEP 1 OF 3: PREPARE YOUR ADVENTURE';
  let direction = "Tap 'Begin Adventure' to choose your heroes • Or pinch empty space to reposition table";
  let subtext = "The game box is open on your table. All buttons are labeled with their exact action.";
  // Ghost beacon target position in tabletop coordinates
  let beaconPos: [number, number, number] = [0, 0.08, -0.025];

  if (showSetupScreen || (gameState && gameState.phase === 'setup')) {
    stepNumber = 2;
    title = 'STEP 2 OF 3: ASSEMBLE YOUR PARTY';
    direction = "Review your heroes and power cards, then select 'Start Adventure'";
    subtext = "Flip cards to view Level 2 powers • Confirm each hero before entering the crypt.";
    beaconPos = [0, 0.25, 0.35];
  } else if (gameState && (gameState.phase === 'hero' || gameState.phase === 'exploration')) {
    stepNumber = 3;
    title = 'STEP 3 OF 3: EMBARK INTO THE CRYPT';
    direction = "Pinch & drag your hero miniature to an illuminated square to make your first move";
    subtext = "Reachable squares glow in emerald runes • Dropping onto an open edge explores a new tile.";
    beaconPos = [0.08, 0.08, 0.08]; // Centered near start hero
  }

  return (
    <group position={[0, 0.52, 0.18]} rotation={[-Math.PI / 10, 0, 0]}>
      {/* ================= FLOATING DIRECTION BANNER ================= */}
      <group position={[0, 0, 0]}>
        {/* Banner Slate */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.72, 0.14, 0.015]} />
          <meshStandardMaterial color="#0c0714" roughness={0.7} metalness={0.2} transparent opacity={0.92} />
        </mesh>

        {/* Clean Ornate Gold Border (Clean rectangular loop, zero diagonal X lines) */}
        <lineLoop position={[0, 0, 0.009]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  -0.355, -0.065, 0,
                   0.355, -0.065, 0,
                   0.355,  0.065, 0,
                  -0.355,  0.065, 0,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#c5a059" linewidth={2} />
        </lineLoop>

        {/* Direction Step Header */}
        <Text
          position={[0, 0.042, 0.012]}
          fontSize={0.022}
          color="#f5dfa3"
          textAlign="center"
          letterSpacing={0.06}
        >
          {title}
        </Text>

        {/* Primary Action Instruction Line */}
        <Text
          position={[0, 0.006, 0.012]}
          fontSize={0.017}
          color="#ffffff"
          textAlign="center"
          maxWidth={0.68}
        >
          {direction}
        </Text>

        {/* Context Subtitle */}
        <Text
          position={[0, -0.034, 0.012]}
          fontSize={0.012}
          color="#a090b0"
          textAlign="center"
          maxWidth={0.68}
        >
          {subtext}
        </Text>

        {/* Interactive "Got It / Dismiss" Button */}
        <Interactive
          onSelect={handleDismiss}
          onHover={() => setDismissHovered(true)}
          onBlur={() => setDismissHovered(false)}
        >
          <group
            position={[0.30, 0.078, 0.008]}
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            scale={dismissHovered ? 1.08 : 1.0}
          >
            <mesh>
              <boxGeometry args={[0.11, 0.03, 0.006]} />
              <meshStandardMaterial color={dismissHovered ? '#4a2574' : '#221530'} roughness={0.6} />
            </mesh>
            <lineLoop position={[0, 0, 0.004]}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      -0.052, -0.013, 0,
                       0.052, -0.013, 0,
                       0.052,  0.013, 0,
                      -0.052,  0.013, 0,
                    ]),
                    3,
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color={dismissHovered ? '#f5dfa3' : '#a08040'} />
            </lineLoop>
            <Text position={[0, 0, 0.006]} fontSize={0.011} color="#f5dfa3" textAlign="center">
              [DISMISS]
            </Text>
          </group>
        </Interactive>
      </group>

      {/* ================= GHOST HIGHLIGHT BEACON ================= */}
      {/* Downward beacon pulsing over the target interactive element */}
      <group ref={ghostBeaconRef} position={beaconPos}>
        {/* Pulsing Target Ground Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[0.06, 0.075, 24]} />
          <meshBasicMaterial
            color={stepNumber === 3 ? '#55ffaa' : '#ffd700'}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Ghost Vertical Guide Beam */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.003, 0.025, 0.16, 12, 1, true]} />
          <meshBasicMaterial
            color={stepNumber === 3 ? '#55ffaa' : '#ffd700'}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Downward Direction Arrow Indicator */}
        <mesh position={[0, 0.18, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.02, 0.04, 12]} />
          <meshBasicMaterial color={stepNumber === 3 ? '#55ffaa' : '#f5dfa3'} />
        </mesh>
      </group>
    </group>
  );
};

export default ARFirstTimeDirection3D;
