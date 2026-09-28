/**
 * WebXR Gamepad Haptic Feedback Utility.
 * Provides tactile pulse profiles for Meta Quest 2 / Touch controllers.
 */

export type HapticProfile = 'click' | 'hover' | 'heroMove' | 'attackHit' | 'damageTaken' | 'rollDice' | 'error';

/**
 * Triggers a vibration pulse on active XR gamepads (controllers).
 * @param handedness Optional 'left' | 'right' | 'all' filter. Default is 'all'.
 * @param intensity Pulse intensity from 0.0 to 1.0.
 * @param durationMs Pulse duration in milliseconds.
 */
export function triggerHaptic(
  intensity: number = 0.5,
  durationMs: number = 20,
  handedness: 'left' | 'right' | 'all' = 'all'
): void {
  if (typeof navigator === 'undefined' || !('xr' in navigator)) return;

  const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  for (const gp of gamepads) {
    if (!gp) continue;
    if (handedness !== 'all' && (gp as any).hand && (gp as any).hand !== handedness) {
      continue;
    }

    // WebXR standard hapticActuators API
    const actuators = (gp as any).hapticActuators;
    if (actuators && actuators.length > 0) {
      try {
        actuators[0].pulse(Math.min(Math.max(intensity, 0), 1), durationMs);
      } catch {
        // Silently ignore if haptics are unsupported or busy
      }
    }
  }
}

/**
 * Predefined tactile vibration feedback profiles for gameplay events.
 */
export function playHapticProfile(profile: HapticProfile, handedness: 'left' | 'right' | 'all' = 'all'): void {
  switch (profile) {
    case 'hover':
      triggerHaptic(0.15, 10, handedness);
      break;
    case 'click':
      triggerHaptic(0.4, 18, handedness);
      break;
    case 'heroMove':
      triggerHaptic(0.3, 35, handedness);
      break;
    case 'rollDice':
      triggerHaptic(0.6, 50, handedness);
      break;
    case 'attackHit':
      triggerHaptic(0.8, 80, handedness);
      break;
    case 'damageTaken':
      triggerHaptic(1.0, 120, handedness);
      break;
    case 'error':
      triggerHaptic(0.5, 30, handedness);
      setTimeout(() => triggerHaptic(0.5, 30, handedness), 60);
      break;
  }
}
