import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import { playHapticProfile } from './XRHaptics';
import { useUIStore } from '../store/uiStore';

interface XRTabletopRigProps {
  children: React.ReactNode;
}

const DEFAULT_XR_POS: [number, number, number] = [0, 0, 0];
const DEFAULT_XR_SCALE = 1.0;

// Scratch variables to avoid GC allocations in 90Hz VR animation loop
const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _deltaMid = new THREE.Vector3();
const _newPos = new THREE.Vector3();
const _tempPos = new THREE.Vector3();
const _lastSyncedPos = new THREE.Vector3(...DEFAULT_XR_POS);

/**
 * XRTabletopRig manages the master spatial playspace transform for Castle Ravenloft.
 *
 * Capabilities:
 *  1. Grasp & Pull (Single Grip): Squeeze grip on empty space and pull to smoothly move
 *     the whole playspace forward, back, left, right, up, or down.
 *  2. Dual Grip: Squeeze both controller grips to pinch-scale and twist-rotate the playspace.
 *  3. Right Thumbstick (X): Fixed-circle Orbit around the table center (360° continuous rotation).
 *  4. Right Thumbstick (Y): Height / Elevation adjustment (raise or lower the playspace).
 *  5. Left Thumbstick (X/Y): Smooth strafe and forward/backward locomotion.
 */
export const XRTabletopRig: React.FC<XRTabletopRigProps> = ({ children }) => {
  const { isPresenting, controllers } = useXR();
  const rigRef = useRef<THREE.Group>(null);

  // Mutable refs for 90Hz direct scene graph updates without React re-renders
  const worldPosRef = useRef<THREE.Vector3>(new THREE.Vector3(...DEFAULT_XR_POS));
  const worldRotYRef = useRef<number>(0);
  const worldScaleRef = useRef<number>(DEFAULT_XR_SCALE);

  const lastSyncedRotYRef = useRef<number>(0);
  const lastSyncedScaleRef = useRef<number>(DEFAULT_XR_SCALE);

  // Single Grip (Grasp & Pull) State
  const singleGripRef = useRef<{
    controllerIndex: number;
    startHandPos: THREE.Vector3;
    initialWorldPos: THREE.Vector3;
  } | null>(null);

  // Dual Grip (Scale & Rotate) State
  const dualGripRef = useRef<{
    initialWorldPos: THREE.Vector3;
    initialWorldRotY: number;
    initialWorldScale: number;
    initialMidpoint: THREE.Vector3;
    initialAngle: number;
    initialDistance: number;
  } | null>(null);

  useEffect(() => {
    if (!isPresenting) {
      worldPosRef.current.set(...DEFAULT_XR_POS);
      worldRotYRef.current = 0;
      worldScaleRef.current = DEFAULT_XR_SCALE;
      singleGripRef.current = null;
      dualGripRef.current = null;

      if (rigRef.current) {
        rigRef.current.position.set(...DEFAULT_XR_POS);
        rigRef.current.rotation.set(0, 0, 0);
        rigRef.current.scale.setScalar(DEFAULT_XR_SCALE);
      }
    }
  }, [isPresenting]);

  useFrame((_, delta) => {
    if (!isPresenting || !rigRef.current) return;

    let transformChanged = false;

    // ================= 1. DETECT ACTIVE GRIP CONTROLLERS =================
    const activeGrippers: { index: number; pos: THREE.Vector3; handedness: string }[] = [];
    for (let idx = 0; idx < controllers.length; idx++) {
      const ctrl = controllers[idx];
      const gp = ctrl.inputSource?.gamepad;
      if (gp && gp.buttons && gp.buttons.length > 1) {
        const gripButton = gp.buttons[1]; // Grip / Squeeze trigger
        if (gripButton && (gripButton.pressed || gripButton.value > 0.6)) {
          ctrl.controller.getWorldPosition(_tempPos);
          const handedness = ctrl.inputSource?.handedness ?? (idx === 0 ? 'left' : 'right');
          activeGrippers.push({ index: idx, pos: _tempPos.clone(), handedness });
        }
      }
    }

    // ================= 2. GRIP MANIPULATION (DUAL OR SINGLE) =================
    if (activeGrippers.length >= 2) {
      // DUAL GRIP: Pinch-to-scale and twist-to-rotate around midpoint
      singleGripRef.current = null; // Dual grip overrides single grip

      _posA.copy(activeGrippers[0].pos);
      _posB.copy(activeGrippers[1].pos);
      _mid.copy(_posA).add(_posB).multiplyScalar(0.5);

      const dx = _posB.x - _posA.x;
      const dz = _posB.z - _posA.z;
      const angle = Math.atan2(dx, dz);
      const dist = Math.hypot(dx, dz);

      if (!dualGripRef.current) {
        dualGripRef.current = {
          initialWorldPos: worldPosRef.current.clone(),
          initialWorldRotY: worldRotYRef.current,
          initialWorldScale: worldScaleRef.current,
          initialMidpoint: _mid.clone(),
          initialAngle: angle,
          initialDistance: Math.max(dist, 0.05),
        };
        playHapticProfile('hover');
      } else {
        // Rotation delta
        const deltaAngle = angle - dualGripRef.current.initialAngle;
        worldRotYRef.current = dualGripRef.current.initialWorldRotY + deltaAngle;

        // Scaling delta
        const scaleMultiplier = dist / dualGripRef.current.initialDistance;
        worldScaleRef.current = Math.max(0.4, Math.min(2.5, dualGripRef.current.initialWorldScale * scaleMultiplier));

        // Translation delta
        _deltaMid.copy(_mid).sub(dualGripRef.current.initialMidpoint);
        _newPos.copy(dualGripRef.current.initialWorldPos).add(_deltaMid);
        worldPosRef.current.copy(_newPos);

        transformChanged = true;
      }
    } else if (activeGrippers.length === 1) {
      // SINGLE GRIP: "Grasp & Pull" Locomotion
      if (dualGripRef.current) {
        dualGripRef.current = null;
      }

      const g = activeGrippers[0];
      if (!singleGripRef.current || singleGripRef.current.controllerIndex !== g.index) {
        singleGripRef.current = {
          controllerIndex: g.index,
          startHandPos: g.pos.clone(),
          initialWorldPos: worldPosRef.current.clone(),
        };
        playHapticProfile('hover', g.handedness as any);
      } else {
        // World moves directly with the hand displacement
        const deltaX = g.pos.x - singleGripRef.current.startHandPos.x;
        const deltaY = g.pos.y - singleGripRef.current.startHandPos.y;
        const deltaZ = g.pos.z - singleGripRef.current.startHandPos.z;

        worldPosRef.current.x = singleGripRef.current.initialWorldPos.x + deltaX;
        worldPosRef.current.y = singleGripRef.current.initialWorldPos.y + deltaY;
        worldPosRef.current.z = singleGripRef.current.initialWorldPos.z + deltaZ;
        transformChanged = true;
      }
    } else {
      // Released all grips
      if (dualGripRef.current || singleGripRef.current) {
        dualGripRef.current = null;
        singleGripRef.current = null;
        playHapticProfile('click');
      }
    }

    // ================= 3. THUMBSTICK LOCOMOTION & ORBIT =================
    for (let idx = 0; idx < controllers.length; idx++) {
      const ctrl = controllers[idx];
      const handedness = ctrl.inputSource?.handedness ?? (idx === 0 ? 'left' : 'right');
      const gp = ctrl.inputSource?.gamepad;
      if (!gp || !gp.axes || gp.axes.length < 2) continue;

      const stickX = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
      const stickY = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];

      const deadzone = 0.18;
      if (Math.abs(stickX) > deadzone || Math.abs(stickY) > deadzone) {
        if (handedness === 'right') {
          // Right Stick: Fixed-Circle Orbit (Left/Right) & Elevation (Up/Down)
          if (Math.abs(stickX) > deadzone) {
            worldRotYRef.current += stickX * 1.6 * delta;
            transformChanged = true;
          }
          if (Math.abs(stickY) > deadzone) {
            // Stick up (negative) raises elevation, stick down lowers
            worldPosRef.current.y -= stickY * 0.9 * delta;
            transformChanged = true;
          }
        } else {
          // Left Stick: Smooth Strafe & Forward/Backward Push-Pull
          const cosR = Math.cos(worldRotYRef.current);
          const sinR = Math.sin(worldRotYRef.current);

          const moveSpeed = 1.4 * delta;
          const forwardX = -sinR * stickY;
          const forwardZ = -cosR * stickY;
          const strafeX = cosR * stickX;
          const strafeZ = -sinR * stickX;

          worldPosRef.current.x += (forwardX + strafeX) * moveSpeed;
          worldPosRef.current.z += (forwardZ + strafeZ) * moveSpeed;
          transformChanged = true;
        }
      }
    }

    // ================= 4. APPLY TO SCENE GRAPH =================
    rigRef.current.position.copy(worldPosRef.current);
    rigRef.current.rotation.y = worldRotYRef.current;
    rigRef.current.scale.setScalar(worldScaleRef.current);

    // ================= 5. SYNC TO STORE (WHEN CHANGED) =================
    if (transformChanged) {
      const posDistSq = worldPosRef.current.distanceToSquared(_lastSyncedPos);
      const rotDiff = Math.abs(worldRotYRef.current - lastSyncedRotYRef.current);
      const scaleDiff = Math.abs(worldScaleRef.current - lastSyncedScaleRef.current);

      if (posDistSq > 0.0001 || rotDiff > 0.005 || scaleDiff > 0.001) {
        _lastSyncedPos.copy(worldPosRef.current);
        lastSyncedRotYRef.current = worldRotYRef.current;
        lastSyncedScaleRef.current = worldScaleRef.current;

        useUIStore.getState().setXRTableTransform({
          position: [worldPosRef.current.x, worldPosRef.current.y, worldPosRef.current.z],
          rotationY: worldRotYRef.current,
          scale: worldScaleRef.current,
        });
      }
    }
  });

  return (
    <group ref={rigRef} position={DEFAULT_XR_POS} scale={DEFAULT_XR_SCALE} rotation={[0, 0, 0]}>
      {children}
    </group>
  );
};

export default XRTabletopRig;
