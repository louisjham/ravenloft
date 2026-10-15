import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useXR, Interactive, XRInteractionEvent } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { playHapticProfile } from '../XRHaptics';

// Static scratch variables for 90Hz 6DoF HUD grabbing and matrix manipulation
const _grabCtrlStartPos = new THREE.Vector3();
const _grabCtrlStartRot = new THREE.Quaternion();
const _grabHudStartPos  = new THREE.Vector3();
const _grabHudStartRot  = new THREE.Quaternion();
const _invCtrlRot       = new THREE.Quaternion();
const _grabPosOffset    = new THREE.Vector3();
const _grabRotOffset    = new THREE.Quaternion();

const _curCtrlPos    = new THREE.Vector3();
const _curCtrlRot    = new THREE.Quaternion();
const _curWorldPos   = new THREE.Vector3();
const _curWorldRot   = new THREE.Quaternion();
const _curLocalPos   = new THREE.Vector3();
const _curLocalRot   = new THREE.Quaternion();
const _parentQuat    = new THREE.Quaternion();
const _invParentQuat = new THREE.Quaternion();

const DEFAULT_HUD_POS: [number, number, number] = [0, 0.10, 0.35];
const DEFAULT_HUD_ROT: [number, number, number] = [-Math.PI / 6, 0, 0];

interface HUDButtonProps {
  label: string;
  subtext?: string;
  position: [number, number, number];
  width?: number;
  active?: boolean;
  color?: string;
  onClick: () => void;
}

const HUDButton3D: React.FC<HUDButtonProps> = ({
  label,
  subtext,
  position,
  width = 0.16,
  active = false,
  color = '#2d1c3a',
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e?: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    playHapticProfile('click');
    onClick();
  };

  const bgColor = active ? '#1e5e3a' : hovered ? '#4a2574' : color;
  const borderColor = active ? '#55ff88' : hovered ? '#f5dfa3' : '#c5a059';

  return (
    <Interactive
      onSelect={handleClick}
      onHover={() => {
        setHovered(true);
        playHapticProfile('hover');
      }}
      onBlur={() => setHovered(false)}
    >
      <group
        position={position}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          playHapticProfile('hover');
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleClick(e);
        }}
        scale={hovered ? 1.08 : 1.0}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, 0.05, 0.012]} />
          <meshStandardMaterial color={bgColor} roughness={0.6} metalness={0.1} />
        </mesh>

        <mesh position={[0, 0, 0.007]}>
          <boxGeometry args={[width - 0.008, 0.042, 0.002]} />
          <meshBasicMaterial color={borderColor} wireframe />
        </mesh>

        <Text
          position={[0, subtext ? 0.006 : 0, 0.01]}
          fontSize={0.016}
          color={hovered || active ? '#ffffff' : '#f5dfa3'}
          textAlign="center"
        >
          {label}
        </Text>

        {subtext && (
          <Text position={[0, -0.012, 0.01]} fontSize={0.01} color="#a09080" textAlign="center">
            {subtext}
          </Text>
        )}
      </group>
    </Interactive>
  );
};

/**
 * XRTabletopHUD3D renders the in-world action bar, active hero status,
 * tile placement dial, and game-over altar in WebXR.
 *
 * The Action Bar is a grabbable and moveable 6DoF object in player space.
 * Players can grab the top brass rail handle or backing plate using VR grip/squeeze,
 * hand pinch, or pointer drag to position it anywhere in their room/tabletop.
 */
export const XRTabletopHUD3D: React.FC = () => {
  const { isPresenting } = useXR();
  const phase = useGameStore((state) => state.gameState?.phase);
  const activeHero = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs || !gs.currentHeroId) return null;
    return gs.heroes.find((h) => h.id === gs.currentHeroId) ?? null;
  });
  const healingSurges = useGameStore((state) => state.gameState?.healingSurges ?? 2);

  const endTurn = useGameStore((state) => state.endTurn);
  const setGameState = useGameStore((state) => state.setGameState);

  const interactionMode = useUIStore((state) => state.interactionMode);
  const setInteractionMode = useUIStore((state) => state.setInteractionMode);
  const requestXRTableReset = useUIStore((state) => state.requestXRTableReset);
  const xrTableResetRequested = useUIStore((state) => state.xrTableResetRequested);

  // Group reference for mutable 6DoF HUD positioning
  const groupRef = useRef<THREE.Group>(null);
  const hudPosRef = useRef(new THREE.Vector3(...DEFAULT_HUD_POS));
  const hudRotRef = useRef(new THREE.Euler(...DEFAULT_HUD_ROT));

  // Grabbing & dragging states
  const [isGrabbed, setIsGrabbed] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);

  // Desktop pointer drag fallback
  const isPointerDraggingRef = useRef(false);
  const pointerDragPlaneRef = useRef(new THREE.Plane());
  const dragPlaneOffsetRef = useRef(new THREE.Vector3());

  // Reset HUD to default tabletop dock position when table reset is requested
  useEffect(() => {
    if (xrTableResetRequested && groupRef.current) {
      hudPosRef.current.set(...DEFAULT_HUD_POS);
      hudRotRef.current.set(...DEFAULT_HUD_ROT);
      groupRef.current.position.copy(hudPosRef.current);
      groupRef.current.rotation.copy(hudRotRef.current);
    }
  }, [xrTableResetRequested]);

  // Window pointerup listener for desktop drag release
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isPointerDraggingRef.current) {
        isPointerDraggingRef.current = false;
        setIsGrabbed(false);
        if (groupRef.current) {
          hudPosRef.current.copy(groupRef.current.position);
          hudRotRef.current.copy(groupRef.current.rotation);
        }
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  // ---------------------------------------------------------------------------
  // Grab Start & End Handlers
  // ---------------------------------------------------------------------------
  const handleGrabStart = useCallback((e?: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    playHapticProfile('click');
    setIsGrabbed(true);

    // Extract VR controller object
    const xrTarget = e?.target;
    const ctrlObj =
      xrTarget?.controller ||
      xrTarget?.grip ||
      (xrTarget instanceof THREE.Object3D ? xrTarget : null);

    if (ctrlObj && groupRef.current) {
      grabbingControllerRef.current = ctrlObj;

      // Compute initial world poses and relative offset
      ctrlObj.updateWorldMatrix(true, false);
      ctrlObj.getWorldPosition(_grabCtrlStartPos);
      ctrlObj.getWorldQuaternion(_grabCtrlStartRot);

      groupRef.current.updateWorldMatrix(true, false);
      groupRef.current.getWorldPosition(_grabHudStartPos);
      groupRef.current.getWorldQuaternion(_grabHudStartRot);

      _invCtrlRot.copy(_grabCtrlStartRot).invert();
      _grabPosOffset
        .copy(_grabHudStartPos)
        .sub(_grabCtrlStartPos)
        .applyQuaternion(_invCtrlRot);
      _grabRotOffset.copy(_invCtrlRot).multiply(_grabHudStartRot);
    }
  }, []);

  const handleGrabEnd = useCallback((e?: any) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (grabbingControllerRef.current || isPointerDraggingRef.current) {
      playHapticProfile('click');
      grabbingControllerRef.current = null;
      isPointerDraggingRef.current = false;
      setIsGrabbed(false);

      if (groupRef.current) {
        hudPosRef.current.copy(groupRef.current.position);
        hudRotRef.current.copy(groupRef.current.rotation);
      }
    }
  }, []);

  // Desktop mouse drag initiation
  const handleDesktopPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.nativeEvent && 'button' in e.nativeEvent && e.nativeEvent.button !== 0) return;

    playHapticProfile('click');
    isPointerDraggingRef.current = true;
    setIsGrabbed(true);

    if (groupRef.current) {
      const hudWorld = new THREE.Vector3();
      groupRef.current.getWorldPosition(hudWorld);

      // Construct plane perpendicular to camera view vector passing through HUD
      const camDir = new THREE.Vector3();
      e.camera.getWorldDirection(camDir).negate();
      pointerDragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, hudWorld);

      const intersect = new THREE.Vector3();
      if (e.ray.intersectPlane(pointerDragPlaneRef.current, intersect)) {
        dragPlaneOffsetRef.current.copy(hudWorld).sub(intersect);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 90Hz Frame Loop for 6DoF Grabbing & Motion Smoothing
  // ---------------------------------------------------------------------------
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (grabbingControllerRef.current) {
      const ctrl = grabbingControllerRef.current;
      ctrl.updateWorldMatrix(true, false);
      ctrl.getWorldPosition(_curCtrlPos);
      ctrl.getWorldQuaternion(_curCtrlRot);

      // Compute target world position & rotation from relative grab offsets
      _curWorldPos
        .copy(_grabPosOffset)
        .applyQuaternion(_curCtrlRot)
        .add(_curCtrlPos);
      _curWorldRot.copy(_curCtrlRot).multiply(_grabRotOffset);

      // Convert target world transform into parent local coordinates
      if (groupRef.current.parent) {
        groupRef.current.parent.updateWorldMatrix(true, false);

        _curLocalPos.copy(_curWorldPos);
        groupRef.current.parent.worldToLocal(_curLocalPos);

        groupRef.current.parent.getWorldQuaternion(_parentQuat);
        _invParentQuat.copy(_parentQuat).invert();
        _curLocalRot.copy(_invParentQuat).multiply(_curWorldRot);
      } else {
        _curLocalPos.copy(_curWorldPos);
        _curLocalRot.copy(_curWorldRot);
      }

      // Smooth lerp & slerp to eliminate controller tracking jitter
      const speed = 1 - Math.pow(0.0001, delta);
      groupRef.current.position.lerp(_curLocalPos, speed);
      groupRef.current.quaternion.slerp(_curLocalRot, speed);

      hudPosRef.current.copy(groupRef.current.position);
      hudRotRef.current.copy(groupRef.current.rotation);
    } else if (isPointerDraggingRef.current) {
      const ray = state.raycaster.ray;
      const intersect = new THREE.Vector3();
      if (ray.intersectPlane(pointerDragPlaneRef.current, intersect)) {
        intersect.add(dragPlaneOffsetRef.current);
        if (groupRef.current.parent) {
          groupRef.current.parent.updateWorldMatrix(true, false);
          groupRef.current.parent.worldToLocal(intersect);
        }
        const speed = 1 - Math.pow(0.0001, delta);
        groupRef.current.position.lerp(intersect, speed);
        hudPosRef.current.copy(groupRef.current.position);
      }
    }
  });

  if (!isPresenting || !phase || phase === 'setup') {
    return null;
  }

  const isHeroPhase = phase === 'hero';
  const isVictory = phase === 'victory';
  const isDefeat = phase === 'defeat';

  // Victory / Defeat Altar
  if (isVictory || isDefeat) {
    return (
      <group position={[0, 0.25, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[1.0, 0.55, 0.03]} />
          <meshStandardMaterial color={isVictory ? '#10301a' : '#301010'} roughness={0.7} />
        </mesh>

        <mesh position={[0, 0, 0.016]}>
          <boxGeometry args={[0.96, 0.51, 0.002]} />
          <meshBasicMaterial color={isVictory ? '#55ff88' : '#ff4444'} wireframe />
        </mesh>

        <Text
          fontSize={0.075}
          color={isVictory ? '#f5dfa3' : '#ff6666'}
          position={[0, 0.14, 0.02]}
          textAlign="center"
        >
          {isVictory ? 'VICTORY' : 'DEFEAT'}
        </Text>

        <Text
          fontSize={0.024}
          color="#d0c0b0"
          position={[0, 0.04, 0.02]}
          textAlign="center"
        >
          {isVictory ? 'The darkness recedes and Castle Ravenloft is cleansed!' : 'Your party has fallen into the darkness...'}
        </Text>

        <HUDButton3D
          label="RETURN TO MAIN MENU"
          position={[0, -0.14, 0.02]}
          width={0.36}
          color="#451820"
          onClick={() => {
            playHapticProfile('rollDice');
            setGameState(null as any);
          }}
        />
      </group>
    );
  }

  const grabHandleGlow = isGrabbed
    ? '#00ffff'
    : handleHovered
    ? '#f5dfa3'
    : '#8c7040';

  return (
    <group
      ref={groupRef}
      position={DEFAULT_HUD_POS}
      rotation={DEFAULT_HUD_ROT}
    >
      {/* ── 6DoF Diegetic Grab Rail Handle ──────────────────────────────── */}
      <Interactive
        onSelectStart={handleGrabStart}
        onSelectEnd={handleGrabEnd}
        onSqueezeStart={handleGrabStart}
        onSqueezeEnd={handleGrabEnd}
        onHover={() => {
          setHandleHovered(true);
          playHapticProfile('hover');
        }}
        onBlur={() => setHandleHovered(false)}
      >
        <group
          position={[0, 0.068, 0]}
          onPointerDown={handleDesktopPointerDown}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHandleHovered(true);
            playHapticProfile('hover');
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHandleHovered(false);
          }}
        >
          {/* Main Grip Bar */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.54, 0.022, 0.02]} />
            <meshStandardMaterial
              color={isGrabbed ? '#12484c' : handleHovered ? '#3a2e1d' : '#221915'}
              roughness={0.4}
              metalness={0.8}
              emissive={grabHandleGlow}
              emissiveIntensity={isGrabbed ? 0.75 : handleHovered ? 0.45 : 0.15}
            />
          </mesh>

          {/* Left / Right Ornate Brass End-Brackets */}
          <mesh position={[-0.27, 0, 0]}>
            <boxGeometry args={[0.025, 0.03, 0.025]} />
            <meshStandardMaterial color="#c5a059" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0.27, 0, 0]}>
            <boxGeometry args={[0.025, 0.03, 0.025]} />
            <meshStandardMaterial color="#c5a059" metalness={0.85} roughness={0.3} />
          </mesh>

          {/* Grab Label */}
          <Text
            fontSize={0.0105}
            color={isGrabbed ? '#ffffff' : handleHovered ? '#ffffff' : '#f5dfa3'}
            position={[0, 0, 0.012]}
            textAlign="center"
            letterSpacing={0.12}
          >
            {isGrabbed ? ':: REPOSITIONING ACTION BAR ::' : ':: ✥ GRAB TO MOVE ✥ ::'}
          </Text>
        </group>
      </Interactive>

      {/* ── HUD Backdrop Rail ─────────────────────────────────────────── */}
      <Interactive
        onSqueezeStart={handleGrabStart}
        onSqueezeEnd={handleGrabEnd}
      >
        <mesh position={[0, 0, -0.01]} receiveShadow>
          <boxGeometry args={[0.96, 0.10, 0.015]} />
          <meshStandardMaterial color="#0e0a14" roughness={0.8} metalness={0.2} />
        </mesh>
      </Interactive>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.94, 0.085, 0.002]} />
        <meshBasicMaterial color="#a08040" wireframe />
      </mesh>

      {/* ── Hero Stats & Palm-Up Hint (Left side) ──────────────────────── */}
      {activeHero && (
        <group position={[-0.32, 0, 0.01]}>
          <Text fontSize={0.018} color="#ffffff" position={[0, 0.022, 0]} textAlign="center">
            {activeHero.name}
          </Text>
          <Text fontSize={0.013} color="#f5dfa3" position={[0, 0.002, 0]} textAlign="center">
            {`HP: ${activeHero.hp}/${activeHero.maxHp}  |  Surges: ${healingSurges}`}
          </Text>
          <Text fontSize={0.0095} color="#55ffaa" position={[0, -0.016, 0]} textAlign="center">
            Grab hero piece to Move
          </Text>
          <Text fontSize={0.0085} color="#88aacc" position={[0, -0.032, 0]} textAlign="center">
            Right palm up: Cards
          </Text>
        </group>
      )}

      {/* ── Action Buttons (Center & Right side) ───────────────────────── */}
      {isHeroPhase && (
        <group position={[0.02, 0, 0.01]}>
          {/* Attack Button */}
          <HUDButton3D
            label="ATTACK"
            subtext={interactionMode === 'attack' ? 'TARGET' : undefined}
            position={[-0.15, 0, 0]}
            width={0.12}
            active={interactionMode === 'attack'}
            color="#451818"
            onClick={() => setInteractionMode(interactionMode === 'attack' ? 'none' : 'attack')}
          />

          {/* End Turn Button */}
          <HUDButton3D
            label="END TURN"
            position={[0.01, 0, 0]}
            width={0.14}
            color="#3d1e5a"
            onClick={() => {
              playHapticProfile('click');
              endTurn();
            }}
          />

          {/* Reset Table & HUD Button */}
          <HUDButton3D
            label="⟳ TABLE"
            subtext="reset"
            position={[0.17, 0, 0]}
            width={0.12}
            color="#1a1a2e"
            onClick={() => {
              playHapticProfile('click');
              requestXRTableReset();
            }}
          />

          {/* Menu Button */}
          <HUDButton3D
            label="MENU"
            position={[0.31, 0, 0]}
            width={0.11}
            color="#2d1520"
            onClick={() => {
              playHapticProfile('click');
              setGameState(null as any);
            }}
          />
        </group>
      )}

      {!isHeroPhase && (
        <group position={[0.14, 0, 0.01]}>
          <Text fontSize={0.020} color="#f5dfa3" textAlign="center">
            {`${phase.toUpperCase()} PHASE`}
          </Text>
        </group>
      )}
    </group>
  );
};

export default XRTabletopHUD3D;
