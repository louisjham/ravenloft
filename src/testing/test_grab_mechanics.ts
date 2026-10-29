import * as THREE from 'three';
import {
  isHandPinching,
  isHandPinchingActive,
  resolveGrabSource,
  isGrabActive,
  recordGrabRelease,
  isHandHoldingObject,
  updateHandReArmStatus,
  PINCH_START_DISTANCE,
  PINCH_RELEASE_DISTANCE,
  PINCH_REARM_DISTANCE,
  RE_GRAB_COOLDOWN_MS,
  XRGrabSource,
} from '../xr/XRGrabManager';

/**
 * Creates a mock THREE.XRHandSpace with mock joints for testing.
 */
function createMockHand(jointDistance: number, isPinchingState = true): any {
  const indexTip = new THREE.Object3D();
  const thumbTip = new THREE.Object3D();

  // Position indexTip at (0, 0, 0) and thumbTip at (jointDistance, 0, 0)
  indexTip.position.set(0, 0, 0);
  thumbTip.position.set(jointDistance, 0, 0);

  const handObj: any = new THREE.Object3D();
  handObj.joints = {
    'index-finger-tip': indexTip,
    'thumb-tip': thumbTip,
  };
  handObj.inputState = { pinching: isPinchingState };
  handObj.add(indexTip);
  handObj.add(thumbTip);
  handObj.updateMatrixWorld(true);

  return handObj;
}

export async function runGrabMechanicsTests(): Promise<void> {
  console.log('--- RUNNING DELIBERATE PICKUP & GUARANTEED RELEASE TESTS ---');

  // Test 1: Pinch Start Intent Threshold (Deliberate Pickup)
  console.log('Test 1: Deliberate pinch start threshold (1.8 cm)...');
  const relaxedHand = createMockHand(0.024); // 2.4 cm (relaxed/brushing fingers)
  const intentionalHand = createMockHand(0.012); // 1.2 cm (firm deliberate pinch)

  if (isHandPinching(relaxedHand)) {
    throw new Error('Casual/brushing fingers (2.4 cm) should NOT trigger pinch start');
  }
  if (!isHandPinching(intentionalHand)) {
    throw new Error('Deliberate pinch (1.2 cm) should trigger pinch start');
  }
  console.log('  ✓ Fingers must be <= 1.8 cm to initiate grab; casual 2.4 cm brushing rejected');

  // Test 2: Physical Proximity Check (Reject Accidental Across-the-Room Ray Grabs)
  console.log('Test 2: Target proximity validation on pickup...');
  const mockControllerObj = new THREE.Object3D();
  const mockHand = intentionalHand;
  const mockXRController = {
    controller: mockControllerObj,
    grip: mockControllerObj,
    hand: mockHand,
    inputSource: { handedness: 'right', hand: {} },
    index: 0,
  };
  const controllers = [mockXRController];

  // Target 1: Far away (0.80 m away) - should be REJECTED
  const farTarget = new THREE.Object3D();
  farTarget.position.set(0.80, 0, 0);
  farTarget.updateMatrixWorld(true);

  const farGrab = resolveGrabSource(
    { controller: mockControllerObj, target: mockControllerObj },
    controllers,
    farTarget,
    0.24
  );
  if (farGrab !== null) {
    throw new Error('Pinch on object 80 cm away should be REJECTED to prevent accidental grabs');
  }
  console.log('  ✓ Accidental grab on distant object (80 cm) rejected');

  // Target 2: In reach (0.08 m away) - should be ACCEPTED
  const closeTarget = new THREE.Object3D();
  closeTarget.position.set(0.08, 0, 0);
  closeTarget.updateMatrixWorld(true);

  const closeGrab = resolveGrabSource(
    { controller: mockControllerObj, target: mockControllerObj },
    controllers,
    closeTarget,
    0.24
  );
  if (closeGrab === null) {
    throw new Error('Direct pinch within 8 cm should be ACCEPTED');
  }
  console.log('  ✓ Direct grab on close target (8 cm) accepted');

  // Test 3: isHandHoldingObject state tracking
  console.log('Test 3: isHandHoldingObject tracks held piece state...');
  if (!isHandHoldingObject('right')) {
    throw new Error('isHandHoldingObject should be true while holding piece');
  }
  console.log('  ✓ Hand is correctly marked as holding object (rig will not drag room)');

  // Test 4: Guaranteed Release (Fingers Opening Past 2.6 cm)
  console.log('Test 4: Guaranteed release when fingers open (> 2.6 cm)...');
  if (!isGrabActive(closeGrab)) {
    throw new Error('Grab should be active while fingers remain pinched');
  }

  // User opens hand to 2.8 cm
  const itip = mockHand.joints['index-finger-tip'];
  const ttip = mockHand.joints['thumb-tip'];
  ttip.position.set(0.028, 0, 0);
  mockHand.updateMatrixWorld(true);

  if (isGrabActive(closeGrab)) {
    throw new Error('Grab MUST release immediately when fingers open to 2.8 cm (> 2.6 cm threshold)');
  }
  console.log('  ✓ Immediate drop confirmed on exact frame fingers open past 2.6 cm');

  // Test 5: Release on Three.js inputState.pinching === false or joint loss
  console.log('Test 5: Guaranteed release on tracking loss / joint occlusion...');
  const lostJointHand: any = new THREE.Object3D();
  lostJointHand.joints = {}; // No joints
  const lostJointSource: XRGrabSource = {
    controller: mockControllerObj,
    hand: lostJointHand,
    isHand: true,
    handedness: 'right',
  };
  if (isGrabActive(lostJointSource)) {
    throw new Error('Grab MUST release when joints are lost or occluded');
  }
  console.log('  ✓ Immediate drop confirmed when tracking joints are occluded/lost');

  // Test 6: Re-arm Cycle & Re-Grab Prevention
  console.log('Test 6: Re-grab lockout and re-arm cycle...');
  recordGrabRelease(closeGrab);

  if (isHandHoldingObject('right')) {
    throw new Error('isHandHoldingObject should be false after release');
  }

  // Attempting to immediately grab again while fingers are not opened to neutral
  ttip.position.set(0.015, 0, 0); // Pinching again without opening
  mockHand.updateMatrixWorld(true);

  const immediateReGrab = resolveGrabSource(
    { controller: mockControllerObj, target: mockControllerObj },
    controllers,
    closeTarget,
    0.24
  );
  if (immediateReGrab !== null) {
    throw new Error('Re-grab MUST be denied until hand opens to neutral (> 3.8 cm)');
  }
  console.log('  ✓ Immediate re-grab rejected (hand has not opened to neutral)');

  // Now simulate hand opening to neutral (> 3.8 cm) and cooldown expiry
  ttip.position.set(0.045, 0, 0); // Open to 4.5 cm
  mockHand.updateMatrixWorld(true);
  mockHand.inputState.pinching = false;

  // Advance time past cooldown
  await new Promise(r => setTimeout(r, RE_GRAB_COOLDOWN_MS + 20));
  updateHandReArmStatus(mockHand, 'right');

  // Now deliberate fresh pinch (1.2 cm)
  ttip.position.set(0.012, 0, 0);
  mockHand.updateMatrixWorld(true);
  mockHand.inputState.pinching = true;

  const freshGrab = resolveGrabSource(
    { controller: mockControllerObj, target: mockControllerObj },
    controllers,
    closeTarget,
    0.24
  );
  if (freshGrab === null) {
    throw new Error('Fresh deliberate grab after neutral re-arm MUST succeed');
  }
  console.log('  ✓ Fresh deliberate grab succeeded first try after neutral re-arm');
  recordGrabRelease(freshGrab);

  console.log('ALL DELIBERATE PICKUP & GUARANTEED RELEASE TESTS PASSED!');
}
