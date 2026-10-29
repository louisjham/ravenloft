import * as THREE from 'three';

// Scratch vectors allocated once for 90Hz performance without GC overhead
const _scratchPosA = new THREE.Vector3();
const _scratchPosB = new THREE.Vector3();
const _scratchTarget = new THREE.Vector3();

export interface XRGrabSource {
  controller: THREE.Object3D;
  hand?: THREE.XRHandSpace;
  inputSource?: XRInputSource;
  handedness?: 'left' | 'right';
  isHand: boolean;
  controllerIndex?: number;
}

/**
 * Technical thresholds for deliberate pickup and guaranteed release (Meta Horizon OS specs)
 */
export const PINCH_START_DISTANCE = 0.018;   // 1.8 cm: fingers must be within 1.8 cm to initiate grab (deliberate intent)
export const PINCH_RELEASE_DISTANCE = 0.026; // 2.6 cm: guaranteed drop when opening fingers (hysteresis band)
export const PINCH_REARM_DISTANCE = 0.038;   // 3.8 cm: hand must open to neutral before next grab (prevents re-grab)
export const RE_GRAB_COOLDOWN_MS = 140;      // 140 ms post-release lockout
export const DEFAULT_MAX_GRAB_DISTANCE = 0.24; // 24 cm maximum reach for direct piece grabbing

interface HandTrackState {
  isReArmed: boolean;
  lastReleaseTime: number;
  heldCount: number;
}

const handStates: Record<'left' | 'right' | 'default', HandTrackState> = {
  left: { isReArmed: true, lastReleaseTime: 0, heldCount: 0 },
  right: { isReArmed: true, lastReleaseTime: 0, heldCount: 0 },
  default: { isReArmed: true, lastReleaseTime: 0, heldCount: 0 },
};

/**
 * Checks if a hand is actively pinching to START a grab.
 * Requires physical fingertip proximity <= PINCH_START_DISTANCE (1.8 cm).
 */
export function isHandPinching(hand: THREE.XRHandSpace | undefined | null): boolean {
  if (!hand || !hand.joints) return false;
  const itip = hand.joints['index-finger-tip'];
  const ttip = hand.joints['thumb-tip'];
  if (!itip || !ttip) return false;

  itip.getWorldPosition(_scratchPosA);
  ttip.getWorldPosition(_scratchPosB);
  const dist = _scratchPosA.distanceTo(_scratchPosB);

  // Must be within initiation distance (1.8 cm)
  if (dist > PINCH_START_DISTANCE) return false;

  // If Three.js inputState is present and explicitly says false, respect it
  if (hand.inputState && hand.inputState.pinching === false) return false;

  return true;
}

/**
 * Checks whether an ongoing pinch is maintained.
 * Uses hysteresis release threshold PINCH_RELEASE_DISTANCE (2.6 cm).
 * If fingertips open beyond 2.6 cm or tracking is lost, returns false immediately.
 */
export function isHandPinchingActive(hand: THREE.XRHandSpace | undefined | null): boolean {
  if (!hand || !hand.joints) return false;
  const itip = hand.joints['index-finger-tip'];
  const ttip = hand.joints['thumb-tip'];
  if (!itip || !ttip) return false;

  itip.getWorldPosition(_scratchPosA);
  ttip.getWorldPosition(_scratchPosB);
  const dist = _scratchPosA.distanceTo(_scratchPosB);

  if (dist > PINCH_RELEASE_DISTANCE) return false;
  if (hand.inputState && hand.inputState.pinching === false) return false;

  return true;
}

/**
 * Computes the stable world-space midpoint between the index-finger-tip and thumb-tip.
 * This is the physical location where the user is holding the object.
 */
export function getPinchPos(hand: THREE.XRHandSpace, out: THREE.Vector3): boolean {
  if (!hand || !hand.joints) return false;
  const itip = hand.joints['index-finger-tip'];
  const ttip = hand.joints['thumb-tip'];
  if (!itip || !ttip) return false;
  itip.getWorldPosition(_scratchPosA);
  ttip.getWorldPosition(_scratchPosB);
  out.copy(_scratchPosA).add(_scratchPosB).multiplyScalar(0.5);
  return true;
}

/**
 * Updates hand re-arming status each frame.
 * If a hand opens to neutral (> PINCH_REARM_DISTANCE), it is re-armed for fresh grabs.
 */
export function updateHandReArmStatus(hand: THREE.XRHandSpace | undefined, handedness: 'left' | 'right' | 'default'): void {
  if (!hand || !hand.joints) return;
  const state = handStates[handedness];
  if (!state || state.isReArmed) return;

  const now = performance.now();
  if (now - state.lastReleaseTime < RE_GRAB_COOLDOWN_MS) return;

  const itip = hand.joints['index-finger-tip'];
  const ttip = hand.joints['thumb-tip'];
  if (!itip || !ttip) return;

  itip.getWorldPosition(_scratchPosA);
  ttip.getWorldPosition(_scratchPosB);
  const dist = _scratchPosA.distanceTo(_scratchPosB);

  // If hand has clearly opened to neutral or Three.js says not pinching, re-arm
  if (dist > PINCH_REARM_DISTANCE || (hand.inputState && !hand.inputState.pinching)) {
    state.isReArmed = true;
  }
}

/**
 * Resolves the XRGrabSource from an interaction event.
 * Enforces deliberate pickup:
 * 1. Requires active pinch within start threshold (<= 1.8 cm).
 * 2. Requires hand to be re-armed (must have unpinched since last release).
 * 3. Requires hand pinch midpoint to be in physical proximity to the target object.
 * Returns null if any condition is not met, preventing accidental or brushing pickups.
 */
export function resolveGrabSource(
  e: any,
  controllers: any[],
  target?: THREE.Object3D | THREE.Vector3 | [number, number, number] | null,
  maxDistance = DEFAULT_MAX_GRAB_DISTANCE
): XRGrabSource | null {
  let xrTarget: any = e?.controller || (e?.target?.controller ? e.target : null);

  // Match against registered XRControllers to obtain inputSource and hand space
  if (controllers && controllers.length > 0) {
    for (const c of controllers) {
      if (
        c === xrTarget ||
        c.controller === xrTarget ||
        c.grip === xrTarget ||
        c.hand === xrTarget ||
        c === e?.target ||
        c.controller === e?.target ||
        c.grip === e?.target ||
        c.hand === e?.target
      ) {
        xrTarget = c;
        break;
      }
    }
  }

  if (!xrTarget && e?.target?.inputSource) {
    xrTarget = e.target;
  }

  // Fallback: check controllers if one is actively pinching
  if ((!xrTarget || !xrTarget.inputSource) && controllers && controllers.length > 0) {
    for (const c of controllers) {
      if (c.inputSource?.hand && isHandPinching(c.hand)) {
        xrTarget = c;
        break;
      }
    }
  }

  const ctrlObj = xrTarget?.controller || xrTarget?.grip || (e?.target instanceof THREE.Object3D ? e.target : null);
  if (!ctrlObj) return null;

  const inputSource = xrTarget?.inputSource;
  const handedness = (inputSource?.handedness ?? 'right') as 'left' | 'right';
  const isHand = inputSource?.hand != null || xrTarget?.hand != null;
  const hand = (xrTarget?.hand as THREE.XRHandSpace | undefined) ||
    (isHand ? controllers.find((c) => c.inputSource?.handedness === handedness)?.hand : undefined);
  const key = isHand ? handedness : 'default';

  // Update re-arm state
  if (isHand && hand) {
    updateHandReArmStatus(hand, key);
  }

  const state = handStates[key];
  const now = performance.now();

  // 1. Re-arm check: after releasing, hand MUST open to neutral before picking up again
  if (!state.isReArmed) {
    return null;
  }

  // 2. Cooldown check
  if (now - state.lastReleaseTime < RE_GRAB_COOLDOWN_MS) {
    return null;
  }

  // 3. Hand pinch verification
  if (isHand && hand) {
    if (!isHandPinching(hand)) {
      return null; // Must have fingers <= 1.8 cm
    }

    // 4. Physical Proximity Check (prevents accidental ray pickups from across table)
    if (target) {
      let targetWorldPos: THREE.Vector3 | null = null;
      if (target instanceof THREE.Vector3) {
        targetWorldPos = target;
      } else if (Array.isArray(target) && target.length === 3) {
        _scratchTarget.set(target[0], target[1], target[2]);
        targetWorldPos = _scratchTarget;
      } else if (target instanceof THREE.Object3D) {
        target.updateWorldMatrix(true, false);
        target.getWorldPosition(_scratchTarget);
        targetWorldPos = _scratchTarget;
      }

      if (targetWorldPos && getPinchPos(hand, _scratchPosA)) {
        const distToTarget = _scratchPosA.distanceTo(targetWorldPos);
        if (distToTarget > maxDistance) {
          // Hand is too far from object (e.g. passing movement or air pinch)
          return null;
        }
      }
    }
  }

  // Commit deliberate grab
  state.heldCount++;

  return {
    controller: ctrlObj,
    hand,
    inputSource,
    handedness,
    isHand,
    controllerIndex: xrTarget?.index,
  };
}

/**
 * Checks whether the grab is still actively held by the player.
 * Checked every frame at 90Hz:
 * For hands: returns true only while the hand continues pinching (<= 2.6 cm).
 * If fingers open beyond 2.6 cm or joints are lost, returns false immediately (guaranteed release).
 * For controllers: returns true only while trigger or grip remains pressed.
 * Never falls through to true.
 */
export function isGrabActive(source: XRGrabSource | null): boolean {
  if (!source) return false;

  // 1. Hand tracking path
  if (source.isHand) {
    const hand = source.hand;
    if (!hand) return false;
    if (source.controller && !source.controller.visible) return false;
    return isHandPinchingActive(hand);
  }

  // 2. Physical controller path
  const gp = source.inputSource?.gamepad;
  if (gp && gp.buttons && gp.buttons.length > 0) {
    const trigger = gp.buttons[0];
    const grip = gp.buttons.length > 1 ? gp.buttons[1] : undefined;
    const isTriggerHeld = !!trigger && (trigger.pressed || trigger.value > 0.35);
    const isGripHeld = !!grip && (grip.pressed || grip.value > 0.35);
    if (!isTriggerHeld && !isGripHeld) return false;
    if (source.controller && !source.controller.visible) return false;
    return true;
  }

  if (source.controller && !source.controller.visible) {
    return false;
  }

  return false;
}

/**
 * Records that a grab was released by the specified source.
 * Activates re-grab lockout and requires hand to open to neutral before re-arming.
 */
export function recordGrabRelease(source: XRGrabSource | null): void {
  const key = source?.isHand ? (source.handedness ?? 'default') : 'default';
  const state = handStates[key];
  if (state) {
    state.isReArmed = false;
    state.lastReleaseTime = performance.now();
    state.heldCount = Math.max(0, state.heldCount - 1);
  }
}

/**
 * Returns true if the specified hand is currently holding an object.
 * Used by XRTabletopRig to avoid dragging the room/table while moving a piece.
 */
export function isHandHoldingObject(handedness?: 'left' | 'right' | string): boolean {
  if (!handedness) {
    return handStates.left.heldCount > 0 || handStates.right.heldCount > 0 || handStates.default.heldCount > 0;
  }
  const key = (handedness === 'left' || handedness === 'right') ? handedness : 'default';
  return handStates[key]?.heldCount > 0;
}

/**
 * Derives the world-space position and orientation of the grab.
 * For hands, places the object at the fingertip pinch point.
 */
export function getGrabWorldPose(
  source: XRGrabSource,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion
): void {
  if (source.isHand && source.hand) {
    if (!getPinchPos(source.hand, outPos)) {
      source.controller.updateWorldMatrix(true, false);
      source.controller.getWorldPosition(outPos);
    }
    source.controller.updateWorldMatrix(true, false);
    source.controller.getWorldQuaternion(outQuat);
  } else {
    source.controller.updateWorldMatrix(true, false);
    source.controller.getWorldPosition(outPos);
    source.controller.getWorldQuaternion(outQuat);
  }
}
