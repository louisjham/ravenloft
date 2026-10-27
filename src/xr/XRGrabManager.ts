import * as THREE from 'three';

// Scratch vectors allocated once for 90Hz performance without GC overhead
const _scratchPosA = new THREE.Vector3();
const _scratchPosB = new THREE.Vector3();

export interface XRGrabSource {
  controller: THREE.Object3D;
  hand?: THREE.XRHandSpace;
  inputSource?: XRInputSource;
  handedness?: 'left' | 'right';
  isHand: boolean;
  controllerIndex?: number;
}

// Global release timestamps to prevent immediate noisy re-grabs
// Keyed by handedness ('left' | 'right') or controller identifier
const lastReleaseTimes: Record<string, number> = {
  left: 0,
  right: 0,
  controller_0: 0,
  controller_1: 0,
  default: 0,
};

/**
 * Re-grab debounce threshold: 180ms.
 * When an object is dropped, that hand/controller cannot grab ANY object for 180ms.
 * This prevents hand tracking jitter or slight finger twitch at release from instantly
 * snatching the object back.
 * Crucially, this adds ZERO delay to the release itself (drop is immediate on the exact
 * frame pinch opens).
 */
export const RE_GRAB_COOLDOWN_MS = 180;

/**
 * Checks if a hand is actively pinching.
 * Three.js sets `hand.inputState.pinching` to false when distance > 0.025m.
 * We also verify that the index-tip and thumb-tip joints exist and are within pinch distance.
 */
export function isHandPinching(hand: THREE.XRHandSpace | undefined | null): boolean {
  if (!hand || !hand.inputState) return false;
  if (!hand.inputState.pinching) return false;
  const itip = hand.joints['index-finger-tip'];
  const ttip = hand.joints['thumb-tip'];
  if (!itip || !ttip) return false;

  itip.getWorldPosition(_scratchPosA);
  ttip.getWorldPosition(_scratchPosB);
  const dist = _scratchPosA.distanceTo(_scratchPosB);

  // If tips are separated by more than 3.0 cm, pinch is definitely open
  if (dist > 0.030) return false;

  return true;
}

/**
 * Computes the stable world-space midpoint between the index-finger-tip and thumb-tip.
 * This is the physical location where the user is holding the object.
 */
export function getPinchPos(hand: THREE.XRHandSpace, out: THREE.Vector3): boolean {
  const itip = hand.joints['index-finger-tip'];
  const ttip = hand.joints['thumb-tip'];
  if (!itip || !ttip) return false;
  itip.getWorldPosition(_scratchPosA);
  ttip.getWorldPosition(_scratchPosB);
  out.copy(_scratchPosA).add(_scratchPosB).multiplyScalar(0.5);
  return true;
}

/**
 * Resolves the XRGrabSource from an interaction event (e.g. onSelect, onSqueeze).
 * Returns null if the source is in re-grab cooldown or not actively pinching.
 */
export function resolveGrabSource(e: any, controllers: any[]): XRGrabSource | null {
  let xrTarget: any = e?.controller || (e?.target?.controller ? e.target : null);

  if (!xrTarget && e?.target instanceof THREE.Object3D) {
    for (const c of controllers) {
      if (c.controller === e.target || c.grip === e.target || c.hand === e.target || c === e.target) {
        xrTarget = c;
        break;
      }
    }
  }

  if (!xrTarget && e?.target?.inputSource) {
    xrTarget = e.target;
  }

  // Fallback: check controllers if one is pinching
  if (!xrTarget && controllers && controllers.length > 0) {
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
  const key = isHand ? handedness : (xrTarget?.index != null ? `controller_${xrTarget.index}` : handedness);

  const now = performance.now();
  const lastRelease = lastReleaseTimes[key] || lastReleaseTimes.default || 0;
  if (now - lastRelease < RE_GRAB_COOLDOWN_MS) {
    return null; // Deny grab during post-release debounce
  }

  if (isHand && hand) {
    if (!isHandPinching(hand)) {
      return null; // Must be actively pinching to start grab
    }
  }

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
 * For hands: returns true only while the hand continues pinching.
 * For controllers: returns true only while trigger or grip remains pressed.
 * Returns false immediately if released or disconnected.
 */
export function isGrabActive(source: XRGrabSource | null): boolean {
  if (!source) return false;

  // 1. Hand tracking path
  if (source.isHand) {
    if (!source.hand) return false;
    return isHandPinching(source.hand);
  }

  // 2. Physical controller path
  const gp = source.inputSource?.gamepad;
  if (gp && gp.buttons && gp.buttons.length > 0) {
    const trigger = gp.buttons[0];
    const grip = gp.buttons.length > 1 ? gp.buttons[1] : undefined;
    const isTriggerHeld = !!trigger && (trigger.pressed || trigger.value > 0.4);
    const isGripHeld = !!grip && (grip.pressed || grip.value > 0.4);
    return isTriggerHeld || isGripHeld;
  }

  if (source.controller && !source.controller.visible) {
    return false;
  }

  return true;
}

/**
 * Records that a grab was released by the specified source, activating the re-grab debounce.
 */
export function recordGrabRelease(source: XRGrabSource | null): void {
  const key = source?.isHand
    ? (source.handedness ?? 'default')
    : (source?.controllerIndex != null ? `controller_${source.controllerIndex}` : (source?.handedness ?? 'default'));

  const now = performance.now();
  lastReleaseTimes[key] = now;
  lastReleaseTimes.default = now;
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
