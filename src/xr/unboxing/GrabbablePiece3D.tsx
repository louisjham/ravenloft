import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Interactive, useXR } from '@react-three/xr';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import { playHapticProfile } from '../XRHaptics';

export interface GrabbablePiece3DProps {
  modelUrl: string;
  label: string;
  sublabel?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  baseRadius?: number;
  baseColor?: string;
  emissiveColor?: string;
  onSelect?: () => void;
}

const _ctrlPos = new THREE.Vector3();
const _ctrlRot = new THREE.Quaternion();
const _offset = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _localTargetQuat = new THREE.Quaternion();

export const GrabbablePiece3D: React.FC<GrabbablePiece3DProps> = ({
  modelUrl,
  label,
  sublabel,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  baseRadius = 0.038,
  baseColor = '#1d152b',
  emissiveColor = '#3a2550',
  onSelect,
}) => {
  const { controllers } = useXR();
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [scaleDisplay, setScaleDisplay] = useState<number>(1.0);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);

  // Dynamic in-hand / inspection scale multiplier (0.4x to 6.0x)
  const pieceScaleRef = useRef<number>(1.0);
  const lastHapticScaleRef = useRef<number>(1.0);

  // Load miniature 3D model
  const { scene } = useGLTF(modelUrl);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        const mat = child.material.clone();
        mat.emissive = new THREE.Color(emissiveColor);
        mat.emissiveIntensity = 0.4;
        mat.roughness = 0.65;
        mat.metalness = 0.15;
        child.material = mat;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, emissiveColor]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const speed = 1 - Math.pow(0.001, delta);

    if (grabbingControllerRef.current) {
      // 1. Check for Thumbstick Scale adjustments while holding the figure
      for (let idx = 0; idx < controllers.length; idx++) {
        const ctrl = controllers[idx];
        const gp = ctrl.inputSource?.gamepad;
        if (gp && gp.axes && gp.axes.length >= 2) {
          const stickY = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
          if (Math.abs(stickY) > 0.15) {
            // Stick UP (negative) expands/zooms figure, stick DOWN shrinks
            const zoomSpeed = 2.4 * delta;
            pieceScaleRef.current = THREE.MathUtils.clamp(
              pieceScaleRef.current - stickY * zoomSpeed,
              0.4,
              6.5
            );

            // Subtle haptic click on passing integer scale milestones
            const currentInt = Math.floor(pieceScaleRef.current);
            if (currentInt !== Math.floor(lastHapticScaleRef.current)) {
              playHapticProfile('hover');
              lastHapticScaleRef.current = pieceScaleRef.current;
            }
          }
        }
      }

      grabbingControllerRef.current.updateWorldMatrix(true, false);
      grabbingControllerRef.current.getWorldPosition(_ctrlPos);
      grabbingControllerRef.current.getWorldQuaternion(_ctrlRot);

      _offset.set(0, 0.04, -0.12).applyQuaternion(_ctrlRot);
      _targetPos.copy(_ctrlPos).add(_offset);

      if (groupRef.current.parent) {
        groupRef.current.parent.updateWorldMatrix(true, false);
        groupRef.current.parent.worldToLocal(_targetPos);
      }

      groupRef.current.position.lerp(_targetPos, speed);

      if (groupRef.current.parent) {
        groupRef.current.parent.getWorldQuaternion(_parentQuat);
        _localTargetQuat.copy(_parentQuat).invert().multiply(_ctrlRot);
        groupRef.current.quaternion.slerp(_localTargetQuat, speed);
      } else {
        groupRef.current.quaternion.slerp(_ctrlRot, speed);
      }

      const targetScale = scale * 1.35 * pieceScaleRef.current;
      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, speed)
      );
    } else if (isInspecting) {
      const inspectY = position[1] + 0.16;
      const inspectZ = position[2] + 0.16;

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, inspectY, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, inspectZ, speed);

      const targetScale = scale * 1.4 * pieceScaleRef.current;
      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, speed)
      );

      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotation[0], speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation[1], speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotation[2], speed);
    } else {
      const targetScale = hovered ? scale * 1.1 : scale;
      const targetY = hovered ? position[1] + 0.02 : position[1];

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, targetY, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, position[2], speed);

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, speed)
      );

      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotation[0], speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation[1], speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotation[2], speed);
    }
  });

  const handleGrabStart = (e: any) => {
    playHapticProfile('click');
    const xrCtrl = e?.controller || (e?.target?.controller ? e.target : null);
    const ctrlObj = xrCtrl?.controller || xrCtrl?.grip || (e?.target instanceof THREE.Object3D ? e.target : null);
    if (ctrlObj) {
      grabbingControllerRef.current = ctrlObj;
    } else {
      setIsInspecting(prev => !prev);
    }
  };

  const handleGrabEnd = () => {
    if (grabbingControllerRef.current) {
      playHapticProfile('click');
      grabbingControllerRef.current = null;
      if (onSelect) onSelect();
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    playHapticProfile('click');
    setIsInspecting(prev => !prev);
    if (onSelect) onSelect();
  };

  const handleWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    const deltaMultiplier = e.deltaY > 0 ? 0.9 : 1.1;
    pieceScaleRef.current = THREE.MathUtils.clamp(pieceScaleRef.current * deltaMultiplier, 0.4, 6.5);
    setScaleDisplay(Math.round(pieceScaleRef.current * 10) / 10);
  };

  return (
    <Interactive
      onSelect={handleGrabStart}
      onSqueeze={handleGrabStart}
      onSqueezeEnd={handleGrabEnd}
      onHover={() => {
        setHovered(true);
        playHapticProfile('hover');
      }}
      onBlur={() => setHovered(false)}
    >
      <group
        ref={groupRef}
        position={position}
        rotation={rotation}
        scale={scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          playHapticProfile('hover');
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={handleClick}
        onWheel={handleWheel}
      >
        {/* Sculpted Miniature Circular Base */}
        <mesh position={[0, 0.006, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[baseRadius, baseRadius * 1.08, 0.012, 32]} />
          <meshStandardMaterial color={baseColor} roughness={0.7} metalness={0.2} />
        </mesh>

        {/* Base Ornate Gold Bevel Trim */}
        <mesh position={[0, 0.0125, 0]}>
          <torusGeometry args={[baseRadius * 0.95, 0.0012, 8, 32]} />
          <meshBasicMaterial color="#a08040" />
        </mesh>

        {/* 3D Model Figure */}
        <primitive object={clonedScene} position={[0, 0.012, 0]} />

        {/* Hover Highlight Ring */}
        {hovered && (
          <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[baseRadius * 1.05, baseRadius * 1.25, 32]} />
            <meshBasicMaterial color="#f0d070" transparent opacity={0.75} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Floating Nameplate Banner */}
        {hovered && label && (
          <group position={[0, 0.16 * pieceScaleRef.current, 0]} rotation={[-Math.PI / 8, 0, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.26, sublabel ? 0.052 : 0.036]} />
              <meshBasicMaterial color="#110d18" transparent opacity={0.94} />
            </mesh>
            <Text
              position={[0, sublabel ? 0.009 : 0, 0.002]}
              fontSize={0.018}
              color="#f5dfa3"
              textAlign="center"
            >
              {pieceScaleRef.current !== 1.0 ? `${label} (${Math.round(pieceScaleRef.current * 10) / 10}x)` : label}
            </Text>
            {sublabel && (
              <Text
                position={[0, -0.012, 0.002]}
                fontSize={0.012}
                color="#a09080"
                textAlign="center"
              >
                {sublabel}
              </Text>
            )}
          </group>
        )}
      </group>
    </Interactive>
  );
};

export default GrabbablePiece3D;
