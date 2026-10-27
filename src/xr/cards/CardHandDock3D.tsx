import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { DataLoader } from '../../game/dataLoader';
import { PhysicalCard3D } from './PhysicalCard3D';
import { Card } from '../../game/types';
import { playHapticProfile } from '../XRHaptics';

// Static scratch vectors & quaternions for 90Hz palm detection loop
const _wristPos = new THREE.Vector3();
const _indexPos = new THREE.Vector3();
const _pinkyPos = new THREE.Vector3();
const _vIndex = new THREE.Vector3();
const _vPinky = new THREE.Vector3();
const _palmNormal = new THREE.Vector3();
const _ctrlQuat = new THREE.Quaternion();

/**
 * CardHandDock3D renders a floating, curved card fan in front of the player
 * containing the active hero's chosen Power Cards and equipped Treasure Items.
 *
 * Appears and vanishes via a latched toggle driven by the right-hand palm-up
 * show/hide gesture (or 'C' shortcut). Once shown or hidden, state persists
 * across arbitrary hand movements and tracking updates until the next toggle gesture.
 */
export const CardHandDock3D: React.FC = () => {
  const { isPresenting, controllers } = useXR();
  const phase = useGameStore((state) => state.gameState?.phase);
  const activeHero = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs || !gs.currentHeroId) return null;
    return gs.heroes.find((h) => h.id === gs.currentHeroId) ?? null;
  });

  const selectedPowerId = useUIStore((state) => state.selectedPowerId);
  const setSelectedPowerId = useUIStore((state) => state.setSelectedPowerId);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);

  // Group reference for 3D fan transform & visibility
  const groupRef = useRef<THREE.Group>(null);

  // Persistent latched show/hide state:
  // The gesture flips this state. The live hand pose does not directly drive visibility.
  const [isDockVisible, setIsDockVisible] = useState(false);
  const isDockVisibleRef = useRef(false);
  const animScaleRef = useRef(0);

  // Gesture detection latching & re-arming
  const isGestureArmedRef = useRef(true);
  const palmHoldDurationRef = useRef(0);

  // Keyboard shortcut toggle ('C') for desktop testing & manual override
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && !e.repeat) {
        if (document.activeElement?.tagName !== 'INPUT') {
          isDockVisibleRef.current = !isDockVisibleRef.current;
          setIsDockVisible(isDockVisibleRef.current);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // 90Hz hand palm orientation detection & scale transition
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    let palmDetected = false;
    let palmUpComponent = 0;

    if (isPresenting && controllers.length > 0) {
      // Find right hand / controller
      const rightCtrl = controllers.find(
        (c) => c.inputSource?.handedness === 'right'
      );

      if (rightCtrl) {
        // 1. Hand-tracking path: derive physical palm normal from wrist & knuckles
        const hand = rightCtrl.hand as THREE.XRHandSpace | undefined;
        if (hand && hand.joints && hand.joints['wrist']) {
          const wrist = hand.joints['wrist'];
          const index =
            hand.joints['index-finger-phalanx-proximal'] ||
            hand.joints['index-finger-metacarpal'];
          const pinky =
            hand.joints['pinky-finger-phalanx-proximal'] ||
            hand.joints['pinky-finger-metacarpal'];

          if (wrist && index && pinky) {
            wrist.getWorldPosition(_wristPos);
            index.getWorldPosition(_indexPos);
            pinky.getWorldPosition(_pinkyPos);

            _vIndex.subVectors(_indexPos, _wristPos);
            _vPinky.subVectors(_pinkyPos, _wristPos);

            // Right hand: Pinky-vector cross Index-vector points outward from palm surface
            _palmNormal.crossVectors(_vPinky, _vIndex).normalize();
            palmUpComponent = _palmNormal.y;
            palmDetected = true;
          }
        }

        // 2. VR Controller path: inspect right controller roll
        if (!palmDetected) {
          const ctrlObj = rightCtrl.grip || rightCtrl.controller;
          if (ctrlObj) {
            ctrlObj.updateWorldMatrix(true, false);
            ctrlObj.getWorldQuaternion(_ctrlQuat);

            // For right-hand controller held in hand:
            // Neutral handshake points inner palm towards -X.
            // Rotating right hand palm-up rolls the -X vector into world +Y.
            _palmNormal.set(-1, 0, 0).applyQuaternion(_ctrlQuat);
            palmUpComponent = _palmNormal.y;
            palmDetected = true;
          }
        }
      }
    }

    // Evaluate right-hand show/hide gesture as a latched toggle.
    // The gesture flips a persistent show/hide state that survives arbitrary hand movement.
    if (palmDetected) {
      if (palmUpComponent > 0.40) {
        palmHoldDurationRef.current += delta;
        if (isGestureArmedRef.current && palmHoldDurationRef.current >= 0.12) {
          // Gesture triggered: flip persistent latched state
          isGestureArmedRef.current = false;
          isDockVisibleRef.current = !isDockVisibleRef.current;
          setIsDockVisible(isDockVisibleRef.current);
          if (isPresenting) {
            playHapticProfile('hover', 'right');
          }
        }
      } else {
        palmHoldDurationRef.current = 0;
        // Re-arm when hand returns to neutral/relaxed pose
        if (palmUpComponent < 0.20) {
          isGestureArmedRef.current = true;
        }
      }
    } else {
      palmHoldDurationRef.current = 0;
    }

    // Smooth exponential scale lerp for card fan appear / vanish transition.
    // Controlled exclusively by the latched state, not live per-frame hand pose.
    const targetScale = isDockVisibleRef.current ? 1.0 : 0.0;
    const speed = 1 - Math.pow(0.0001, delta);
    animScaleRef.current = THREE.MathUtils.lerp(
      animScaleRef.current,
      targetScale,
      speed
    );

    if (animScaleRef.current < 0.005) {
      groupRef.current.visible = false;
      groupRef.current.scale.setScalar(0.0001);
    } else {
      groupRef.current.visible = true;
      groupRef.current.scale.setScalar(animScaleRef.current);
    }
  });

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
    <group
      ref={groupRef}
      position={[0, 0.05, 0.42]}
      rotation={[-Math.PI / 4.5, 0, 0]}
      visible={false}
      scale={0.0001}
    >
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
