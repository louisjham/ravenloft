import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import { playHapticProfile } from './XRHaptics';
import { useUIStore } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { ARLoadingBeat3D } from './entry/ARLoadingBeat3D';
import { ARTransitionMist3D } from './entry/ARTransitionMist3D';
import { ARFirstTimeDirection3D } from './entry/ARFirstTimeDirection3D';

interface XRTabletopRigProps {
  children: React.ReactNode;
}

// ── Spawn / default constants ─────────────────────────────────────────────────
// Head-relative placement is computed at session start; these are the fallbacks.
const DEFAULT_TABLE_OFFSET_Z = -0.95;  // metres in front of the user
const DEFAULT_TABLE_Y        = 0.70;   // metres above floor

// Scale limits (narrowed from 0.4-2.5 so pieces stay grippable)
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.8;

// Y clamp: table cannot go below knee height or above eye level
const MIN_Y = 0.35;
const MAX_Y = 1.60;

// Horizontal leash: table midpoint cannot wander more than 2.2 m from origin
const MAX_XZ_RADIUS = 2.2;

// Interaction damping & velocity limits (Item 20)
// Prevents fast hand motions from flipping or throwing the table out of view
const MAX_ANGULAR_VELOCITY    = Math.PI * 1.5; // rad/s (~270 deg/s) velocity cap on rotation
const MAX_TRANSLATION_SPEED   = 1.8;           // m/s velocity cap on planar translation
const MIN_ROTATION_DISTANCE   = 0.12;          // m minimum hand separation to engage rotation (prevents gimbal flips when hands touch)
const ROTATION_DAMP_LAMBDA    = 24.0;          // Damping factor for smooth responsive rotation without lag
const TRANSLATION_DAMP_LAMBDA = 26.0;          // Damping factor for smooth planar translation

// Scratch variables – allocated once, reused every frame to avoid GC pressure at 90 Hz
const _posA      = new THREE.Vector3();
const _posB      = new THREE.Vector3();
const _mid       = new THREE.Vector3();
const _deltaMid  = new THREE.Vector3();
const _newPos    = new THREE.Vector3();
const _tempPos   = new THREE.Vector3();
const _lastSyncedPos = new THREE.Vector3(0, DEFAULT_TABLE_Y, DEFAULT_TABLE_OFFSET_Z);

/**
 * Read the world-space position of a specific hand joint.
 * Returns null when the joint is unavailable (hand not tracked, joint occluded).
 */
function getJointPos(hand: THREE.XRHandSpace, joint: XRHandJoint, out: THREE.Vector3): boolean {
  const j = hand.joints[joint];
  if (!j) return false;
  j.getWorldPosition(out);
  return true;
}

/**
 * Returns true when the hand is actively pinching (Three.js inputState) AND
 * both the index-tip and thumb-tip joints are available so we can derive a
 * world position from them.
 */
function isHandPinching(hand: THREE.XRHandSpace): boolean {
  return hand.inputState.pinching && !!hand.joints['index-finger-tip'] && !!hand.joints['thumb-tip'];
}

/**
 * Returns the midpoint between the index-tip and thumb-tip as a stable "grip point"
 * analogous to the physical controller's grip pose.
 */
function getPinchPos(hand: THREE.XRHandSpace, out: THREE.Vector3): boolean {
  const itip = hand.joints['index-finger-tip'];
  const ttip = hand.joints['thumb-tip'];
  if (!itip || !ttip) return false;
  const a = itip.getWorldPosition(_posA);
  const b = ttip.getWorldPosition(_posB);
  out.copy(a).add(b).multiplyScalar(0.5);
  return true;
}

/**
 * XRTabletopRig manages the master spatial playspace transform for Castle Ravenloft.
 *
 * Controller inputs:
 *  1. Grasp & Pull (Single Grip): Move the playspace via controller grip.
 *  2. Dual Grip: Pinch-to-scale and twist-to-rotate.
 *  3. Right Thumbstick (X): Fixed-circle orbit around the table centre.
 *  4. Right Thumbstick (Y): Height / elevation adjustment.
 *  5. Left Thumbstick (X/Y): Smooth strafe and push-pull.
 *
 * Hand-tracking equivalents (new):
 *  1. Single sustained pinch on empty space: same delta math as single-grip.
 *  2. Both hands pinching simultaneously: same scale/rotate math as dual-grip,
 *     using index-tip/thumb-tip midpoints for distance and angle.
 *
 * Safety limits (new):
 *  - Y clamped to [MIN_Y, MAX_Y].
 *  - XZ distance from origin clamped to MAX_XZ_RADIUS.
 *  - Scale clamped to [MIN_SCALE, MAX_SCALE].
 *
 * Spawn (new):
 *  - On session start, table is placed along the head's forward vector at
 *    DEFAULT_TABLE_OFFSET_Z metres, with Y derived from headset height.
 */
export const XRTabletopRig: React.FC<XRTabletopRigProps> = ({ children }) => {
  const { isPresenting, controllers } = useXR();
  const { camera } = useThree();
  const rigRef = useRef<THREE.Group>(null);
  const tableAssemblyRef = useRef<THREE.Group>(null);
  const transitionProgressRef = useRef<number>(0);
  const hasSpawnedInXR = useRef(false);

  // Mutable refs for 90 Hz direct scene graph updates without React re-renders
  const worldPosRef        = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const worldRotYRef       = useRef<number>(0);
  const worldScaleRef      = useRef<number>(1.0);
  const lastSyncedRotYRef  = useRef<number>(0);
  const lastSyncedScaleRef = useRef<number>(1.0);

  // Single Grip / Single Pinch state
  const singleGripRef = useRef<{
    controllerIndex: number;       // -1 = hand-tracking source
    handedness: 'left' | 'right';
    startHandPos: THREE.Vector3;
    initialWorldPos: THREE.Vector3;
  } | null>(null);

  // Dual Grip / Dual Pinch state
  const initialSnapshotRef = useRef<{
    pos: THREE.Vector3;
    rotY: number;
    scale: number;
  } | null>(null);
  const lastResetVersionRef = useRef<number>(0);

  const dualGripRef = useRef<{
    initialWorldPos: THREE.Vector3;
    initialWorldRotY: number;
    initialWorldScale: number;
    initialMidpoint: THREE.Vector3;
    initialAngle: number;
    initialDistance: number;
    lastAngle: number;
    targetRotY: number;
  } | null>(null);

  // Reset to desktop origin when not presenting in XR
  useEffect(() => {
    if (!isPresenting) {
      hasSpawnedInXR.current = false;
      worldPosRef.current.set(0, 0, 0);
      worldRotYRef.current  = 0;
      worldScaleRef.current = 1.0;
      singleGripRef.current = null;
      dualGripRef.current   = null;

      if (rigRef.current) {
        rigRef.current.position.set(0, 0, 0);
        rigRef.current.rotation.set(0, 0, 0);
        rigRef.current.scale.setScalar(1.0);
      }
    }
  }, [isPresenting]);

  // Expose a reset-to-defaults action so the HUD "Reset Table" button can call it
  const resetTable = () => {
    if (initialSnapshotRef.current) {
      worldPosRef.current.copy(initialSnapshotRef.current.pos);
      worldRotYRef.current  = initialSnapshotRef.current.rotY;
      worldScaleRef.current = initialSnapshotRef.current.scale;
    } else {
      worldPosRef.current.set(0, DEFAULT_TABLE_Y, DEFAULT_TABLE_OFFSET_Z);
      worldRotYRef.current  = 0;
      worldScaleRef.current = 1.0;
    }
    singleGripRef.current = null;
    dualGripRef.current   = null;
    if (rigRef.current) {
      rigRef.current.position.copy(worldPosRef.current);
      rigRef.current.rotation.set(0, worldRotYRef.current, 0);
      rigRef.current.scale.setScalar(worldScaleRef.current);
    }
  };

  // ── Apply position clamps ────────────────────────────────────────────────
  function applyClamps() {
    // Y bounds
    worldPosRef.current.y = Math.max(MIN_Y, Math.min(MAX_Y, worldPosRef.current.y));
    // XZ leash from origin
    const xzDist = Math.hypot(worldPosRef.current.x, worldPosRef.current.z);
    if (xzDist > MAX_XZ_RADIUS) {
      const scale = MAX_XZ_RADIUS / xzDist;
      worldPosRef.current.x *= scale;
      worldPosRef.current.z *= scale;
    }
  }

  useFrame((state, delta) => {
    if (!isPresenting || !rigRef.current) return;

    // Spawn table in front of user's tracked headset position on first active XR frame
    if (!hasSpawnedInXR.current) {
      hasSpawnedInXR.current = true;
      const headPos = state.camera.position;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.quaternion);
      forward.y = 0;
      if (forward.lengthSq() < 0.001) {
        forward.set(0, 0, -1);
      } else {
        forward.normalize();
      }

      // Check if camera position is tracked (valid headset height between 0.4m and 2.5m)
      const validTracking = headPos.y > 0.4 && headPos.y < 2.5 && Math.hypot(headPos.x, headPos.z) < 3.0;
      const spawnDist = 0.85; // 85 cm in front of user
      const spawnX = validTracking ? headPos.x + forward.x * spawnDist : 0;
      const spawnZ = validTracking ? headPos.z + forward.z * spawnDist : DEFAULT_TABLE_OFFSET_Z;
      const spawnY = validTracking ? Math.max(MIN_Y, Math.min(MAX_Y, headPos.y - 0.45)) : DEFAULT_TABLE_Y;

      worldPosRef.current.set(spawnX, spawnY, spawnZ);
      worldRotYRef.current = 0;
      worldScaleRef.current = 1.0;

      rigRef.current.position.copy(worldPosRef.current);
      rigRef.current.rotation.set(0, 0, 0);
      rigRef.current.scale.setScalar(1.0);
    }

    // ── Snapshot initial playspace arrangement at scene start (post-setup) ──
    const phase = useGameStore.getState().gameState?.phase;
    if (phase && phase !== 'setup' && hasSpawnedInXR.current) {
      if (!initialSnapshotRef.current) {
        initialSnapshotRef.current = {
          pos: worldPosRef.current.clone(),
          rotY: worldRotYRef.current,
          scale: worldScaleRef.current,
        };
      }
    } else if (!phase || phase === 'setup') {
      initialSnapshotRef.current = null;
    }

    // ── Check for Reset All / Reset Table request ────────────────────────────
    const uiState = useUIStore.getState();
    if (uiState.resetAllVersion > lastResetVersionRef.current || uiState.xrTableResetRequested || uiState.resetAllRequested) {
      lastResetVersionRef.current = uiState.resetAllVersion;
      resetTable();
      uiState.clearResetAllRequest();
    }

    let transformChanged = false;

    // ── Determine whether this session uses hand tracking ──────────────────
    // At least one inputSource with .hand present → hand-tracking session.
    const isHandSession = controllers.some((c) => c.inputSource?.hand != null);

    // ─── HAND-TRACKING PATH ────────────────────────────────────────────────
    if (isHandSession) {
      // Collect hands that are actively pinching with a valid pinch position
      const activePinchers: { handedness: 'left' | 'right'; pos: THREE.Vector3 }[] = [];

      for (const ctrl of controllers) {
        const handedness = (ctrl.inputSource?.handedness ?? 'right') as 'left' | 'right';
        const hand = ctrl.hand as THREE.XRHandSpace | undefined;
        if (!hand) continue;

        if (isHandPinching(hand)) {
          const pp = new THREE.Vector3();
          if (getPinchPos(hand, pp)) {
            activePinchers.push({ handedness, pos: pp });
          }
        }
      }

      if (activePinchers.length >= 2) {
        // DUAL PINCH → scale + rotate + translate (mirrors dual-grip controller path)
        singleGripRef.current = null;

        _posA.copy(activePinchers[0].pos);
        _posB.copy(activePinchers[1].pos);
        _mid.copy(_posA).add(_posB).multiplyScalar(0.5);

        const dx   = _posB.x - _posA.x;
        const dy   = _posB.y - _posA.y;
        const dz   = _posB.z - _posA.z;
        const angle = Math.atan2(dx, dz);
        const dist  = Math.hypot(dx, dy, dz); // full 3D distance (fix #4: preserved double-pinch zoom)

        if (!dualGripRef.current) {
          dualGripRef.current = {
            initialWorldPos:   worldPosRef.current.clone(),
            initialWorldRotY:  worldRotYRef.current,
            initialWorldScale: worldScaleRef.current,
            initialMidpoint:   _mid.clone(),
            initialAngle:      angle,
            initialDistance:   Math.max(dist, 0.05),
            lastAngle:         angle,
            targetRotY:        worldRotYRef.current,
          };
          playHapticProfile('hover');
        } else {
          // 1. ZOOM: Preserved authentic double-pinch zoom (100% untouched formula)
          worldScaleRef.current = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
            dualGripRef.current.initialWorldScale * (dist / dualGripRef.current.initialDistance)));

          // 2. ROTATION: Angle-unwrapping, deadband & velocity cap (Item 20)
          // Prevents fast hand motions from flipping the board 360° or spinning out of view
          if (dist >= MIN_ROTATION_DISTANCE) {
            let deltaAngle = angle - dualGripRef.current.lastAngle;
            // Shortest angular path unwrapping (eliminates -PI / +PI branch cut flip)
            deltaAngle = Math.atan2(Math.sin(deltaAngle), Math.cos(deltaAngle));

            // Velocity cap on rotation rate
            const maxRotDelta = MAX_ANGULAR_VELOCITY * delta;
            deltaAngle = THREE.MathUtils.clamp(deltaAngle, -maxRotDelta, maxRotDelta);

            dualGripRef.current.targetRotY += deltaAngle;
            dualGripRef.current.lastAngle = angle;
          }
          // Smooth rotation damping (eliminates abrupt snapping and jitter)
          worldRotYRef.current = THREE.MathUtils.damp(
            worldRotYRef.current,
            dualGripRef.current.targetRotY,
            ROTATION_DAMP_LAMBDA,
            delta
          );

          // 3. PLANAR TRANSLATION with Floor Lock (Item 20: Y stays anchored to floor plane)
          const targetX = dualGripRef.current.initialWorldPos.x + (_mid.x - dualGripRef.current.initialMidpoint.x);
          const targetZ = dualGripRef.current.initialWorldPos.z + (_mid.z - dualGripRef.current.initialMidpoint.z);

          worldPosRef.current.x = THREE.MathUtils.damp(worldPosRef.current.x, targetX, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.z = THREE.MathUtils.damp(worldPosRef.current.z, targetZ, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.y = dualGripRef.current.initialWorldPos.y; // Floor-locked!

          transformChanged = true;
        }
      } else if (activePinchers.length === 1) {
        // SINGLE PINCH → grasp & pull with Floor Lock & Damping (Item 20)
        if (dualGripRef.current) dualGripRef.current = null;

        const p = activePinchers[0];
        const keyMatch = singleGripRef.current?.handedness === p.handedness && singleGripRef.current?.controllerIndex === -1;
        if (!keyMatch) {
          singleGripRef.current = {
            controllerIndex: -1,
            handedness: p.handedness,
            startHandPos:    p.pos.clone(),
            initialWorldPos: worldPosRef.current.clone(),
          };
          playHapticProfile('hover', p.handedness);
        } else {
          const targetX = singleGripRef.current!.initialWorldPos.x + (p.pos.x - singleGripRef.current!.startHandPos.x);
          const targetZ = singleGripRef.current!.initialWorldPos.z + (p.pos.z - singleGripRef.current!.startHandPos.z);

          worldPosRef.current.x = THREE.MathUtils.damp(worldPosRef.current.x, targetX, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.z = THREE.MathUtils.damp(worldPosRef.current.z, targetZ, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.y = singleGripRef.current!.initialWorldPos.y; // Floor-locked!
          transformChanged = true;
        }
      } else {
        // Released all pinches
        if (dualGripRef.current || singleGripRef.current) {
          dualGripRef.current   = null;
          singleGripRef.current = null;
          playHapticProfile('click');
        }
      }
    } else {
      // ─── CONTROLLER PATH (unchanged logic, with fix #4 for 3D distance) ────
      const activeGrippers: { index: number; pos: THREE.Vector3; handedness: string }[] = [];

      for (let idx = 0; idx < controllers.length; idx++) {
        const ctrl = controllers[idx];
        const gp = ctrl.inputSource?.gamepad;
        if (gp && gp.buttons && gp.buttons.length > 1) {
          const gripBtn = gp.buttons[1];
          if (gripBtn && (gripBtn.pressed || gripBtn.value > 0.6)) {
            ctrl.controller.getWorldPosition(_tempPos);
            const handedness = (ctrl.inputSource?.handedness ?? (idx === 0 ? 'left' : 'right')) as string;
            activeGrippers.push({ index: idx, pos: _tempPos.clone(), handedness });
          }
        }
      }

      if (activeGrippers.length >= 2) {
        singleGripRef.current = null;

        _posA.copy(activeGrippers[0].pos);
        _posB.copy(activeGrippers[1].pos);
        _mid.copy(_posA).add(_posB).multiplyScalar(0.5);

        const dx   = _posB.x - _posA.x;
        const dy   = _posB.y - _posA.y;
        const dz   = _posB.z - _posA.z;
        const angle = Math.atan2(dx, dz);
        const dist  = Math.hypot(dx, dy, dz); // fix #4: full 3D

        if (!dualGripRef.current) {
          dualGripRef.current = {
            initialWorldPos:   worldPosRef.current.clone(),
            initialWorldRotY:  worldRotYRef.current,
            initialWorldScale: worldScaleRef.current,
            initialMidpoint:   _mid.clone(),
            initialAngle:      angle,
            initialDistance:   Math.max(dist, 0.05),
            lastAngle:         angle,
            targetRotY:        worldRotYRef.current,
          };
          playHapticProfile('hover');
        } else {
          // Zoom scale preserved
          worldScaleRef.current = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
            dualGripRef.current.initialWorldScale * (dist / dualGripRef.current.initialDistance)));

          // Rotation with angle unwrapping & velocity cap
          if (dist >= MIN_ROTATION_DISTANCE) {
            let deltaAngle = angle - dualGripRef.current.lastAngle;
            deltaAngle = Math.atan2(Math.sin(deltaAngle), Math.cos(deltaAngle));
            const maxRotDelta = MAX_ANGULAR_VELOCITY * delta;
            deltaAngle = THREE.MathUtils.clamp(deltaAngle, -maxRotDelta, maxRotDelta);
            dualGripRef.current.targetRotY += deltaAngle;
            dualGripRef.current.lastAngle = angle;
          }
          worldRotYRef.current = THREE.MathUtils.damp(
            worldRotYRef.current,
            dualGripRef.current.targetRotY,
            ROTATION_DAMP_LAMBDA,
            delta
          );

          // Planar translation with Floor Lock
          const targetX = dualGripRef.current.initialWorldPos.x + (_mid.x - dualGripRef.current.initialMidpoint.x);
          const targetZ = dualGripRef.current.initialWorldPos.z + (_mid.z - dualGripRef.current.initialMidpoint.z);
          worldPosRef.current.x = THREE.MathUtils.damp(worldPosRef.current.x, targetX, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.z = THREE.MathUtils.damp(worldPosRef.current.z, targetZ, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.y = dualGripRef.current.initialWorldPos.y; // Floor-locked!
          transformChanged = true;
        }
      } else if (activeGrippers.length === 1) {
        if (dualGripRef.current) dualGripRef.current = null;

        const g = activeGrippers[0];
        if (!singleGripRef.current || singleGripRef.current.controllerIndex !== g.index) {
          singleGripRef.current = {
            controllerIndex: g.index,
            handedness: g.handedness as 'left' | 'right',
            startHandPos:    g.pos.clone(),
            initialWorldPos: worldPosRef.current.clone(),
          };
          playHapticProfile('hover', g.handedness as any);
        } else {
          const targetX = singleGripRef.current.initialWorldPos.x + (g.pos.x - singleGripRef.current.startHandPos.x);
          const targetZ = singleGripRef.current.initialWorldPos.z + (g.pos.z - singleGripRef.current.startHandPos.z);
          worldPosRef.current.x = THREE.MathUtils.damp(worldPosRef.current.x, targetX, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.z = THREE.MathUtils.damp(worldPosRef.current.z, targetZ, TRANSLATION_DAMP_LAMBDA, delta);
          worldPosRef.current.y = singleGripRef.current.initialWorldPos.y; // Floor-locked!
          transformChanged = true;
        }
      } else {
        if (dualGripRef.current || singleGripRef.current) {
          dualGripRef.current   = null;
          singleGripRef.current = null;
          playHapticProfile('click');
        }
      }

      // ── Thumbstick locomotion & orbit (controllers only) ─────────────────
      for (let idx = 0; idx < controllers.length; idx++) {
        const ctrl       = controllers[idx];
        const handedness = ctrl.inputSource?.handedness ?? (idx === 0 ? 'left' : 'right');
        const gp         = ctrl.inputSource?.gamepad;
        if (!gp || !gp.axes || gp.axes.length < 2) continue;

        const stickX = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
        const stickY = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
        const deadzone = 0.18;

        if (Math.abs(stickX) > deadzone || Math.abs(stickY) > deadzone) {
          if (handedness === 'right') {
            if (Math.abs(stickX) > deadzone) {
              worldRotYRef.current += stickX * 1.6 * delta;
              transformChanged = true;
            }
            if (Math.abs(stickY) > deadzone) {
              worldPosRef.current.y -= stickY * 0.9 * delta;
              transformChanged = true;
            }
          } else {
            const cosR = Math.cos(worldRotYRef.current);
            const sinR = Math.sin(worldRotYRef.current);
            const spd  = 1.4 * delta;
            worldPosRef.current.x += (-sinR * stickY + cosR * stickX) * spd;
            worldPosRef.current.z += (-cosR * stickY - sinR * stickX) * spd;
            transformChanged = true;
          }
        }
      }
    }

    // ── Apply safety clamps ───────────────────────────────────────────────
    applyClamps();

    // ── Apply to scene graph ──────────────────────────────────────────────
    // ── Apply to scene graph (Floor-locked: gravity-aligned, pitch/roll locked to 0) ──
    rigRef.current.position.copy(worldPosRef.current);
    rigRef.current.rotation.set(0, worldRotYRef.current, 0);
    rigRef.current.scale.setScalar(worldScaleRef.current);

    // ── Sync to store (throttled by minimum delta) ────────────────────────
    if (transformChanged) {
      const posDistSq  = worldPosRef.current.distanceToSquared(_lastSyncedPos);
      const rotDiff    = Math.abs(worldRotYRef.current  - lastSyncedRotYRef.current);
      const scaleDiff  = Math.abs(worldScaleRef.current - lastSyncedScaleRef.current);

      if (posDistSq > 0.0001 || rotDiff > 0.005 || scaleDiff > 0.001) {
        _lastSyncedPos.copy(worldPosRef.current);
        lastSyncedRotYRef.current  = worldRotYRef.current;
        lastSyncedScaleRef.current = worldScaleRef.current;

        useUIStore.getState().setXRTableTransform({
          position:  [worldPosRef.current.x, worldPosRef.current.y, worldPosRef.current.z],
          rotationY: worldRotYRef.current,
          scale:     worldScaleRef.current,
        });
      }
    }

    // ── Tabletop Entry Assembly Animation (Crossing from RR into AR) ──
    const arStage = useUIStore.getState().arEntryStage;
    if (tableAssemblyRef.current) {
      if (isPresenting && arStage === 'loading') {
        tableAssemblyRef.current.visible = false;
        transitionProgressRef.current = 0;
      } else if (isPresenting && arStage === 'transitioning') {
        tableAssemblyRef.current.visible = true;
        transitionProgressRef.current = Math.min(1, transitionProgressRef.current + delta / 1.8);
        const ease = 1 - Math.pow(1 - transitionProgressRef.current, 3);
        tableAssemblyRef.current.position.y = -(1 - ease) * 0.22;
        tableAssemblyRef.current.scale.setScalar(THREE.MathUtils.lerp(0.85, 1.0, ease));
      } else {
        tableAssemblyRef.current.visible = true;
        tableAssemblyRef.current.position.y = 0;
        tableAssemblyRef.current.scale.setScalar(1.0);
        transitionProgressRef.current = 0;
      }
    }
  });

  return (
    <group ref={rigRef} position={[0, 0, 0]} scale={1.0} rotation={[0, 0, 0]}>
      {/* AR Entry Visuals (Loading Beat, Transition Mist, First-Time Direction) */}
      <ARLoadingBeat3D />
      <ARTransitionMist3D />
      <ARFirstTimeDirection3D />

      {/* Assembly group containing the tabletop, board, cards, box, and HUD */}
      <group ref={tableAssemblyRef} position={[0, 0, 0]}>
        {children}
      </group>
    </group>
  );
};

export default XRTabletopRig;
