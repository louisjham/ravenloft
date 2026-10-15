import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useDiceStore } from '../store/diceStore';
import { playHapticProfile } from './XRHaptics';
import { DataLoader } from '../game/dataLoader';

/**
 * XRInteractionBridge handles controller button shortcuts and bridges
 * WebXR input events with the game state, dice rolling, and tactile haptics.
 *
 * Hand-tracking: a pinch-start on either hand advances the dice FSM in the
 * same way as trigger/face-button presses do for controllers.
 */
export const XRInteractionBridge: React.FC = () => {
  const { isPresenting, controllers } = useXR();
  const selectedEntity = useGameStore((state) => state.selectedEntity);
  const prevSelectedRef = useRef<string | null>(null);

  // Automatically initialize adventure when entering VR/AR if no game is in progress,
  // ensuring the user immediately sees the board and hero on tabletop upon putting on the headset
  useEffect(() => {
    if (isPresenting) {
      const gs = useGameStore.getState().gameState;
      if (!gs) {
        const dataLoader = DataLoader.getInstance();
        const heroes = dataLoader.getHeroes().map((h) => h.id);
        useGameStore.getState().startNewGame('adventure_01', heroes);
        heroes.forEach((hId) => useGameStore.getState().autoSelectPowers(hId));
        useGameStore.getState().beginAdventure();
      }
    }
  }, [isPresenting]);

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

  // Primary action button state tracker — prevents repeated triggers per press
  const buttonPressedRef = useRef<{ [key: string]: boolean }>({});

  // Track per-hand pinch state so we fire dice advance on pinch-start only
  const pinchActiveRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });

  useFrame(() => {
    if (!isPresenting) return;

    const isHandSession = controllers.some((c) => c.inputSource?.hand != null);

    if (isHandSession) {
      // ── Hand-tracking path: fire on pinch-start ─────────────────────────
      for (const ctrl of controllers) {
        const handedness = (ctrl.inputSource?.handedness ?? 'right') as 'left' | 'right';
        const hand = ctrl.hand as THREE.XRHandSpace | undefined;
        if (!hand) continue;

        const isPinching = hand.inputState.pinching;
        const wasPinching = pinchActiveRef.current[handedness];

        if (isPinching && !wasPinching) {
          // Pinch just started — advance dice FSM (same as primary button press)
          pinchActiveRef.current[handedness] = true;
          const diceStore = useDiceStore.getState();

          if (diceStore.phase === 'announcing') {
            playHapticProfile('rollDice', handedness);
            diceStore.finishAnnouncement();
            if (!diceStore.isAutoRoll) diceStore.playerRoll();
          } else if (diceStore.phase === 'waiting_for_roll') {
            playHapticProfile('rollDice', handedness);
            diceStore.playerRoll();
          } else if (diceStore.phase === 'showing_result') {
            playHapticProfile('click', handedness);
            diceStore.dismiss();
          } else if (diceStore.phase === 'dismissing') {
            diceStore.reset();
          }
        } else if (!isPinching && wasPinching) {
          pinchActiveRef.current[handedness] = false;
        }
      }
    } else {
      // ── Controller path (unchanged) ─────────────────────────────────────
      controllers.forEach((ctrl) => {
        const inputSource = ctrl.inputSource;
        const gp = inputSource?.gamepad;
        if (!gp || !gp.buttons) return;

        const handedness = (inputSource?.handedness as 'left' | 'right') ?? 'right';
        const triggerBtn     = gp.buttons[0]; // Primary Trigger
        const primaryFaceBtn = gp.buttons[4] || gp.buttons[3]; // A or X button

        const isTriggerDown  = triggerBtn     && (triggerBtn.pressed     || triggerBtn.value > 0.8);
        const isFaceBtnDown  = primaryFaceBtn && primaryFaceBtn.pressed;

        const key    = `${handedness}-primary`;
        const isDown = isTriggerDown || isFaceBtnDown;
        const wasDown = buttonPressedRef.current[key] ?? false;

        if (isDown && !wasDown) {
          buttonPressedRef.current[key] = true;

          const diceStore = useDiceStore.getState();
          if (diceStore.phase === 'announcing') {
            playHapticProfile('rollDice', handedness);
            diceStore.finishAnnouncement();
            if (!diceStore.isAutoRoll) diceStore.playerRoll();
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
          buttonPressedRef.current[key] = false;
        }
      });
    }
  });

  return null;
};

export default XRInteractionBridge;
