import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useDiceStore } from '../store/diceStore';
import { playHapticProfile } from './XRHaptics';

/**
 * XRInteractionBridge handles controller button shortcuts and bridges
 * WebXR input events with the game state, dice rolling, and tactile haptics.
 */
export const XRInteractionBridge: React.FC = () => {
  const { isPresenting, controllers } = useXR();
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const prevSelectedRef = useRef<string | null>(null);

  // Trigger haptic feedback when entity selection changes
  useEffect(() => {
    if (isPresenting && selectedEntity) {
      if (prevSelectedRef.current !== selectedEntity.id) {
        playHapticProfile('click');
        prevSelectedRef.current = selectedEntity.id;
      }
    } else {
      prevSelectedRef.current = null;
    }
  }, [selectedEntity, isPresenting]);

  // Primary action button (A / X / Trigger) state tracker to prevent repeated triggers per press
  const buttonPressedRef = useRef<{ [key: string]: boolean }>({});

  useFrame(() => {
    if (!isPresenting) return;

    controllers.forEach((ctrl, idx) => {
      const inputSource = ctrl.inputSource;
      const gp = inputSource?.gamepad;
      if (!gp || !gp.buttons) return;

      const handedness = (inputSource?.handedness as 'left' | 'right') ?? 'right';
      const triggerBtn = gp.buttons[0]; // Primary Trigger
      const primaryFaceBtn = gp.buttons[4] || gp.buttons[3]; // A or X button

      const isTriggerDown = triggerBtn && (triggerBtn.pressed || triggerBtn.value > 0.8);
      const isFaceBtnDown = primaryFaceBtn && primaryFaceBtn.pressed;

      const key = `${handedness}-primary`;
      const isDown = isTriggerDown || isFaceBtnDown;
      const wasDown = buttonPressedRef.current[key] ?? false;

      if (isDown && !wasDown) {
        // Just pressed primary button
        buttonPressedRef.current[key] = true;

        // Check if dice store is awaiting roll or dismiss
        const diceStore = useDiceStore.getState();
        if (diceStore.phase === 'announcing') {
          playHapticProfile('rollDice', handedness);
          diceStore.finishAnnouncement();
          if (!diceStore.isAutoRoll) {
            diceStore.playerRoll();
          }
        } else if (diceStore.phase === 'waiting_for_roll') {
          playHapticProfile('rollDice', handedness);
          diceStore.playerRoll();
        } else if (diceStore.phase === 'showing_result') {
          playHapticProfile('click', handedness);
          diceStore.dismiss();
        } else if (diceStore.phase === 'dismissing') {
          diceStore.reset();
        }
      } else if (!isDown && wasDown) {
        // Released button
        buttonPressedRef.current[key] = false;
      }
    });
  });

  return null;
};

export default XRInteractionBridge;
