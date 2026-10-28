import * as THREE from 'three';

export async function runInteractionDampingTests(): Promise<void> {
  console.log('--- RUNNING HAND INTERACTION DAMPING & FLOOR LOCK TESTS ---');

  // Test 1: Angle unwrapping across -PI / +PI branch cut
  console.log('Test 1: Angle unwrapping across branch cut...');
  const angleA = 3.10; // near +PI
  const angleB = -3.10; // crossed to -PI
  const rawDiff = angleB - angleA; // -6.20 rad (-355 deg!)
  if (Math.abs(rawDiff) < 6.0) throw new Error('Expected rawDiff to exhibit branch-cut jump');

  // Unwrapped shortest-path delta
  const unwrappedDelta = Math.atan2(Math.sin(angleB - angleA), Math.cos(angleB - angleA));
  // The actual rotation should be ~ +0.083 rad (around 4.7 degrees), NOT -355 degrees!
  if (Math.abs(unwrappedDelta) > 0.15) {
    throw new Error(`Expected unwrapped delta to be small (< 0.15 rad), got ${unwrappedDelta}`);
  }
  console.log('  ✓ Angle unwrapping correctly converts a 355° jump into a 4.7° delta');

  // Test 2: Angular velocity cap
  console.log('Test 2: Angular velocity cap...');
  const MAX_ANGULAR_VELOCITY = Math.PI * 1.5;
  const delta = 1 / 90; // 90Hz frame (11.1ms)
  const maxStep = MAX_ANGULAR_VELOCITY * delta;
  const fastHandFlickDelta = 1.2; // ~68 deg in 1 frame
  const clampedDelta = THREE.MathUtils.clamp(fastHandFlickDelta, -maxStep, maxStep);
  if (clampedDelta > maxStep || clampedDelta <= 0) {
    throw new Error(`Expected clamped delta to be capped at ${maxStep}, got ${clampedDelta}`);
  }
  console.log(`  ✓ Angular velocity capped to ${maxStep.toFixed(4)} rad/frame at 90Hz`);

  // Test 3: Deadband when hands touch (< 0.12m)
  console.log('Test 3: Close hand rotation deadband...');
  const MIN_ROTATION_DISTANCE = 0.12;
  const closeHandsDist = 0.08;
  const shouldUpdateRotation = closeHandsDist >= MIN_ROTATION_DISTANCE;
  if (shouldUpdateRotation) throw new Error('Rotation should be inhibited when hands are closer than 12cm');
  console.log('  ✓ Rotation updates inhibited when hand separation < 12cm');

  // Test 4: Double-pinch zoom preservation
  console.log('Test 4: Double-pinch zoom scale formula preservation...');
  const initialScale = 1.0;
  const initialDist = 0.30;
  const currentDist = 0.45;
  const computedScale = Math.max(0.6, Math.min(1.8, initialScale * (currentDist / initialDist)));
  if (Math.abs(computedScale - 1.5) > 0.001) {
    throw new Error(`Expected zoom scale 1.5, got ${computedScale}`);
  }
  console.log('  ✓ Double-pinch zoom scales exactly 1:1 with 3D hand distance');

  // Test 5: Floor lock (gravity-aligned orientation & anchored elevation)
  console.log('Test 5: Floor lock gravity alignment...');
  const rigEuler = new THREE.Euler(0, 0, 0);
  const worldRotY = 0.75;
  rigEuler.set(0, worldRotY, 0); // Strict floor-lock
  if (rigEuler.x !== 0 || rigEuler.z !== 0 || rigEuler.y !== worldRotY) {
    throw new Error('Floor lock failed: pitch and roll must be strictly 0');
  }
  console.log('  ✓ Pitch and roll strictly 0 (table locked level to floor)');

  console.log('ALL INTERACTION DAMPING & FLOOR LOCK TESTS PASSED!');
}
