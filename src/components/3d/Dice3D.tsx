import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { Interactive, useXR } from '@react-three/xr';
import { useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import { createD20Geometry, createD20Material, getQuaternionForNumber, getUpFaceNumber } from './D20Geometry';
import { useDiceStore } from '../../store/diceStore';
import { useGameStore } from '../../store/gameStore';
import { DiceDismissEffect } from './DiceDismissEffect';

const DIE_RADIUS = 0.35;
const GRAVITY = 9.8;
/** A real throw tumbles longer than the old 600ms forced-settle window. */
const PHYSICAL_SETTLE_TIMEOUT_MS = 4500;
const MAX_THROW_SPEED = 14;

export const Dice3D: React.FC = () => {
  const phase = useDiceStore(s => s.phase);
  const result = useDiceStore(s => s.result);
  const isHit = useDiceStore(s => s.isHit);
  const isCritical = useDiceStore(s => s.isCritical);
  const diceColor = useDiceStore(s => s.diceColor);
  const physicsProfile = useDiceStore(s => s.physicsProfile);
  const storeSettleResult = useDiceStore(s => s.settleResult);
  const beginPhysicalRoll = useDiceStore(s => s.beginPhysicalRoll);
  const setHeldByPlayer = useDiceStore(s => s.setHeldByPlayer);
  const isAutoRoll = useDiceStore(s => s.isAutoRoll);
  const announcementText = useDiceStore(s => s.announcementText);

  // Thrown-die params from a grab release (null = auto-toss / auto-roll).
  const [thrown, setThrown] = useState<{
    position: [number, number, number];
    velocity: [number, number, number];
    spin: [number, number, number];
  } | null>(null);
  // Where the thrown die came to rest (for the in-world result billboard).
  const [settlePos, setSettlePos] = useState<[number, number, number] | null>(null);
  // Live position of the held die, reported by HeldDie every frame.
  const heldPosRef = useRef<[number, number, number] | null>(null);

  // Fresh roll: clear the previous throw's params.
  useEffect(() => {
    if (phase === 'announcing') {
      setThrown(null);
      setSettlePos(null);
    }
  }, [phase]);

  const handleThrow = (
    velocity: [number, number, number],
    position: [number, number, number],
    spin: [number, number, number],
  ) => {
    setThrown({ position, velocity, spin });
    beginPhysicalRoll();
  };

  const handleSettled = (faceValue?: number, pos?: [number, number, number]) => {
    if (faceValue !== undefined) {
      if (pos) setSettlePos(pos);
      storeSettleResult(faceValue);
    } else {
      storeSettleResult();
    }
  };

  // Select hero world position as two stable primitives so the useMemo below only
  // recomputes when the hero actually moves, not on every state change.
  const heroWorldX = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs) return null;
    const hero = gs.heroes.find(h => h.id === gs.currentHeroId);
    return hero ? hero.position.x * 4 + hero.position.sqX + 0.5 : null;
  });
  const heroWorldZ = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs) return null;
    const hero = gs.heroes.find(h => h.id === gs.currentHeroId);
    return hero ? hero.position.z * 4 + hero.position.sqZ + 0.5 : null;
  });

  const arenaPosition = useMemo((): [number, number, number] => {
    if (heroWorldX === null || heroWorldZ === null) return [0, 0, -6];
    // Offset the dice drop slightly towards the camera/side (+1.0 in X and Z)
    // so it is visible and does not drop directly on top of the hero miniature.
    return [heroWorldX + 1.0, 0.1, heroWorldZ + 1.0];
  }, [heroWorldX, heroWorldZ]);

  // We only render the physical die when rolling, settling, or showing result
  const shouldRenderPhysical = phase === 'rolling' || phase === 'settling' || phase === 'showing_result';
  const shouldRenderDismiss = phase === 'dismissing';
  // The held die floats while a hero roll waits for the player's throw.
  const shouldRenderHeld = phase === 'waiting_for_roll' && !isAutoRoll;
  // Where a physical die starts: a grabbed throw starts at the release point,
  // an auto-toss starts where the held die floats, an auto-roll drops by the hero.
  const physicalSpawn: [number, number, number] | undefined = thrown
    ? thrown.position
    : heldPosRef.current ?? [arenaPosition[0], arenaPosition[1] + 1.2, arenaPosition[2]];

  return (
    <group renderOrder={10}>
      {shouldRenderHeld && (
        <HeldDie
          color={diceColor}
          arenaPosition={arenaPosition}
          heldPosRef={heldPosRef}
          setHeldByPlayer={setHeldByPlayer}
          onThrow={handleThrow}
        />
      )}
      {shouldRenderPhysical && (
        <PhysicalDie
          color={diceColor}
          physics={physicsProfile}
          targetResult={result}
          onSettled={handleSettled}
          arenaPosition={arenaPosition}
          physical={!isAutoRoll}
          spawnPosition={!isAutoRoll ? physicalSpawn : undefined}
          initialVelocity={thrown?.velocity}
          initialSpin={thrown?.spin}
        />
      )}
      {shouldRenderDismiss && (
        <group position={arenaPosition}>
          <DiceDismissEffect />
        </group>
      )}
      {/* In-world announcement: the DOM overlay does not render in-headset. */}
      {phase === 'announcing' && !isAutoRoll && (
        <Billboard position={[arenaPosition[0], arenaPosition[1] + 1.3, arenaPosition[2]]}>
          <Text fontSize={0.22} color="#ffe9a8" anchorX="center" anchorY="middle">
            {announcementText}
          </Text>
        </Billboard>
      )}
      {/* In-world result: the die may have landed far from where the player looks. */}
      {phase === 'showing_result' && result !== null && (
        <Billboard
          position={[
            (settlePos ?? thrown?.position ?? arenaPosition)[0],
            (settlePos ?? thrown?.position ?? arenaPosition)[1] + 1.3,
            (settlePos ?? thrown?.position ?? arenaPosition)[2],
          ]}
        >
          <Text fontSize={0.5} color={isCritical ? '#ffd700' : '#ffffff'} anchorX="center" anchorY="middle">
            {result}
          </Text>
          <Text fontSize={0.2} color="#ffe9a8" anchorX="center" anchorY="middle" position={[0, -0.45, 0]}>
            {isCritical ? 'NATURAL 20!' : isHit ? 'HIT' : isHit === false ? 'MISS' : ''}
          </Text>
        </Billboard>
      )}
    </group>
  );
};

// Scratch objects for grab tracking (no per-frame allocation).
const _ctrlPos = new THREE.Vector3();
const _ctrlQuat = new THREE.Quaternion();
const _offset = new THREE.Vector3();
const _forward = new THREE.Vector3();

interface HeldDieProps {
  color: string;
  arenaPosition: [number, number, number];
  heldPosRef: React.MutableRefObject<[number, number, number] | null>;
  setHeldByPlayer: (b: boolean) => void;
  onThrow: (
    velocity: [number, number, number],
    position: [number, number, number],
    spin: [number, number, number],
  ) => void;
}

/**
 * The die while it waits for the player's throw: floating in the air, grabbable.
 * Grip (or trigger) grabs it; releasing it throws it. If the player never grabs,
 * trigger / space tosses it with a random impulse instead (see the bridge and
 * GameController). Desktop players, who have no controller, only ever see the toss.
 */
const HeldDie: React.FC<HeldDieProps> = ({ color, arenaPosition, heldPosRef, setHeldByPlayer, onThrow }) => {
  const { geometry } = useMemo(() => createD20Geometry(), []);
  const material = useMemo(() => createD20Material(color), [color]);
  const { camera } = useThree();
  const { isPresenting } = useXR();

  // Spawn in front of the player in XR; above the hero area on desktop.
  const spawnPosition = useMemo((): [number, number, number] => {
    if (isPresenting) {
      camera.getWorldDirection(_forward);
      const p = camera.position;
      return [p.x + _forward.x * 0.7, p.y - 0.2, p.z + _forward.z * 0.7];
    }
    return [arenaPosition[0], arenaPosition[1] + 1.2, arenaPosition[2]];
  }, [camera, isPresenting, arenaPosition]);

  const groupRef = useRef<THREE.Group>(null);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);
  const posHistory = useRef<Array<{ x: number; y: number; z: number; t: number }>>([]);
  const [isGrabbed, setIsGrabbed] = useState(false);

  useEffect(() => {
    heldPosRef.current = spawnPosition;
  }, [spawnPosition, heldPosRef]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (grabbingControllerRef.current) {
      const ctrl = grabbingControllerRef.current;
      ctrl.updateWorldMatrix(true, false);
      ctrl.getWorldPosition(_ctrlPos);
      ctrl.getWorldQuaternion(_ctrlQuat);
      _offset.set(0, 0.02, -0.06).applyQuaternion(_ctrlQuat);
      _ctrlPos.add(_offset);
      group.position.lerp(_ctrlPos, 1 - Math.pow(0.001, delta));
      group.quaternion.slerp(_ctrlQuat, 1 - Math.pow(0.001, delta));
      posHistory.current.push({ x: group.position.x, y: group.position.y, z: group.position.z, t: state.clock.elapsedTime });
      if (posHistory.current.length > 12) posHistory.current.shift();
    } else {
      // Idle float: gentle bob and slow spin so it reads as "in the air".
      group.position.set(
        spawnPosition[0],
        spawnPosition[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.05,
        spawnPosition[2],
      );
      group.rotation.y += delta * 0.5;
    }

    heldPosRef.current = [group.position.x, group.position.y, group.position.z];
  });

  const handleGrabStart = (e: any) => {
    if (grabbingControllerRef.current) return;
    const xrCtrl = e?.controller || (e?.target?.controller ? e.target : null);
    const ctrlObj = xrCtrl?.controller || xrCtrl?.grip || (e?.target instanceof THREE.Object3D ? e.target : null);
    if (ctrlObj) {
      grabbingControllerRef.current = ctrlObj;
      posHistory.current = [];
      setIsGrabbed(true);
      setHeldByPlayer(true);
    }
  };

  const handleGrabEnd = () => {
    const ctrl = grabbingControllerRef.current;
    if (!ctrl || !groupRef.current) return;
    grabbingControllerRef.current = null;
    setIsGrabbed(false);
    setHeldByPlayer(false);

    // Throw velocity from the controller's recent motion (last ~100ms+).
    let velocity: [number, number, number] = [0, 0, 0];
    const hist = posHistory.current;
    if (hist.length >= 2) {
      const newest = hist[hist.length - 1];
      let oldest = hist[0];
      for (let i = hist.length - 1; i >= 0; i--) {
        if (newest.t - hist[i].t >= 0.08) { oldest = hist[i]; break; }
      }
      const dt = Math.max(newest.t - oldest.t, 0.01);
      const vx = (newest.x - oldest.x) / dt;
      const vy = (newest.y - oldest.y) / dt;
      const vz = (newest.z - oldest.z) / dt;
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const scale = speed > MAX_THROW_SPEED ? MAX_THROW_SPEED / speed : 1;
      velocity = [vx * scale, vy * scale, vz * scale];
    }
    // Tumble scales with throw speed so a hard throw actually tumbles.
    const speed = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2);
    const spinScale = 4 + Math.min(speed, 10) * 0.8;
    const spin: [number, number, number] = [
      (Math.random() - 0.5) * spinScale,
      (Math.random() - 0.5) * spinScale,
      (Math.random() - 0.5) * spinScale,
    ];
    const p = groupRef.current.position;
    onThrow(velocity, [p.x, p.y, p.z], spin);
  };

  return (
    <Interactive
      onSelect={handleGrabStart}
      onSelectEnd={handleGrabEnd}
      onSqueeze={handleGrabStart}
      onSqueezeEnd={handleGrabEnd}
    >
      <group ref={groupRef} position={spawnPosition}>
        <mesh geometry={geometry} material={material} castShadow />
        <Billboard position={[0, 0.9, 0]}>
          <Text fontSize={0.22} color="#ffe9a8" anchorX="center" anchorY="middle">
            {isGrabbed ? 'THROW IT!' : 'GRAB THE DIE AND THROW IT'}
          </Text>
          {!isGrabbed && (
            <Text fontSize={0.14} color="#ffffff" anchorX="center" anchorY="middle" position={[0, -0.3, 0]}>
              or pull trigger to toss
            </Text>
          )}
        </Billboard>
      </group>
    </Interactive>
  );
};

interface PhysicalDieProps {
  color: string;
  physics: { mass: number; friction: number; restitution: number; impulseMultiplier: number; dropHeight: number };
  targetResult: number | null;
  onSettled: (faceValue?: number, settlePosition?: [number, number, number]) => void;
  arenaPosition: [number, number, number];
  /** True for hero rolls: the result is read from the die, never forced. */
  physical: boolean;
  /** Exact body spawn (a throw's release point). Defaults to the arena drop. */
  spawnPosition?: [number, number, number];
  /** Throw velocity (a grabbed throw). Defaults to a random impulse. */
  initialVelocity?: [number, number, number];
  /** Throw spin. Defaults to random spin. */
  initialSpin?: [number, number, number];
}

const PhysicalDie: React.FC<PhysicalDieProps> = ({
  color,
  physics,
  targetResult,
  onSettled,
  arenaPosition,
  physical,
  spawnPosition,
  initialVelocity,
  initialSpin,
}) => {
  const { geometry } = useMemo(() => createD20Geometry(), []);
  const material = useMemo(() => createD20Material(color), [color]);

  // Track state
  const [isSettled, setIsSettled] = useState(false);
  const settledRef = useRef(false);
  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const angularVelocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const settledFrames = useRef(0);
  const ageRef = useRef(0);

  // Physics body — uses sphere shape for simplicity but needs high damping
  // to compensate for the lack of rolling resistance on a flat plane
  const [ref, api] = useSphere(() => ({
    mass: physics.mass,
    args: [DIE_RADIUS],
    position: spawnPosition ?? [arenaPosition[0], physics.dropHeight + DIE_RADIUS, arenaPosition[2]],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    material: { friction: physics.friction, restitution: Math.min(physics.restitution, 0.2) },
    linearDamping: physics.friction, // Use Cannon's native linear damping
    angularDamping: Math.min(0.9, physics.friction * 1.5), // Use Cannon's native angular damping
    allowSleep: true,
  }));

  // Calculate initial drop velocity from dropHeight
  const initialDropVelocity = useMemo(() => Math.sqrt(2 * GRAVITY * physics.dropHeight), [physics.dropHeight]);

  // Setup initial impulse: a grabbed throw uses the player's velocity, anything
  // else gets the old random impulse — stronger for faster, more energetic rolls
  useEffect(() => {
    if (initialVelocity) {
      api.velocity.set(initialVelocity[0], initialVelocity[1], initialVelocity[2]);
      const s = initialSpin ?? [(Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15];
      api.angularVelocity.set(s[0], s[1], s[2]);
      return;
    }
    const angle = Math.random() * Math.PI * 2;
    const baseImpulse = 4 * physics.impulseMultiplier;
    const speed = baseImpulse;
    api.applyImpulse([Math.cos(angle) * speed, initialDropVelocity, Math.sin(angle) * speed], [0, 0, 0]);

    const spin = 15 * physics.impulseMultiplier;
    api.angularVelocity.set(
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin,
      (Math.random() - 0.5) * spin
    );
  }, [api, physics.impulseMultiplier, initialDropVelocity, initialVelocity, initialSpin]);

  // Safety timeout. Auto rolls keep the old fast forced settle (theater).
  // Physical rolls get a real throw's window and NEVER force a face: on timeout
  // the current top face is read as-is, so the result is always what the die shows.
  useEffect(() => {
    const settleMs = physical ? PHYSICAL_SETTLE_TIMEOUT_MS : 400 + physics.mass * 200;
    const timer = setTimeout(() => {
      if (!settledRef.current) {
        settledRef.current = true;
        setIsSettled(true);
        if (physical) {
          const face = ref.current ? getUpFaceNumber(ref.current.quaternion) : null;
          const p = ref.current ? ref.current.position : null;
          onSettled(face ?? undefined, p ? [p.x, p.y, p.z] : undefined);
        } else {
          if (targetResult !== null && ref.current) {
            const q = getQuaternionForNumber(targetResult);
            api.quaternion.set(q.x, q.y, q.z, q.w);
            api.velocity.set(0, 0, 0);
            api.angularVelocity.set(0, 0, 0);
          }
          onSettled();
        }
      }
    }, settleMs);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track velocity - subscribe returns [number, number, number] tuples from cannon-es
  useEffect(() => {
    const unsubV = api.velocity.subscribe((v: [number, number, number]) => (velocityRef.current = v));
    const unsubW = api.angularVelocity.subscribe((w: [number, number, number]) => (angularVelocityRef.current = w));
    return () => {
      unsubV();
      unsubW();
    };
  }, [api]);

  // Settlement detection
  useFrame((state, delta) => {
    if (isSettled) return;

    // Track elapsed time to prevent premature settlement in the first few frames
    ageRef.current += delta;
    if (ageRef.current < 0.2) return;

    const v = velocityRef.current;
    const w = angularVelocityRef.current;

    const speedSq = v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
    const spinSq = w[0]*w[0] + w[1]*w[1] + w[2]*w[2];

    // If moving very slowly
    if (speedSq < 0.01 && spinSq < 0.01) {
      settledFrames.current++;

      // Quick confirmation — 5 frames (~0.08s at 60fps)
      if (settledFrames.current > 5) {
        setIsSettled(true);
        settledRef.current = true;

        if (physical) {
          // True physical roll: the result is whatever face is up.
          const face = ref.current ? getUpFaceNumber(ref.current.quaternion) : null;
          const p = ref.current ? ref.current.position : null;
          onSettled(face ?? undefined, p ? [p.x, p.y, p.z] : undefined);
        } else {
          // Auto roll (theater): ensure it shows the target result by forcing rotation
          if (targetResult !== null && ref.current) {
            const q = getQuaternionForNumber(targetResult);
            api.quaternion.set(q.x, q.y, q.z, q.w);
            api.velocity.set(0, 0, 0);
            api.angularVelocity.set(0, 0, 0);

            // Little hop to emphasize the result
            api.applyImpulse([0, 0.5 * physics.mass, 0], [0, 0, 0]);
          }

          onSettled();
        }
      }
    } else {
      settledFrames.current = 0;
    }
  });

  return (
    <mesh ref={ref as any} geometry={geometry} material={material} castShadow receiveShadow />
  );
};
