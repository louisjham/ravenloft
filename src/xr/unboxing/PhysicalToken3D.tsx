import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { playHapticProfile } from '../XRHaptics';

export interface PhysicalToken3DProps {
  frontTextureUrl: string;
  backTextureUrl?: string;
  label?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  radius?: number;
  isRound?: boolean;
  width?: number;
  height?: number;
  onSelect?: () => void;
}

const textureLoader = new THREE.TextureLoader();
const tokenTextureCache = new Map<string, THREE.Texture>();

function loadTokenTexture(url: string): THREE.Texture {
  if (tokenTextureCache.has(url)) {
    return tokenTextureCache.get(url)!;
  }
  const tex = textureLoader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tokenTextureCache.set(url, tex);
  return tex;
}

const _ctrlPos = new THREE.Vector3();
const _ctrlRot = new THREE.Quaternion();
const _offset = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _localTargetQuat = new THREE.Quaternion();

/**
 * PhysicalToken3D is an authentic 3D cardboard token with front and back textures,
 * edge rim thickness, robust 6DoF VR controller grabbing in parent space, and flipping.
 */
export const PhysicalToken3D: React.FC<PhysicalToken3DProps> = ({
  frontTextureUrl,
  backTextureUrl,
  label,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  radius = 0.032,
  isRound = true,
  width = 0.065,
  height = 0.065,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);

  const frontTex = useMemo(() => loadTokenTexture(frontTextureUrl), [frontTextureUrl]);
  const backTex = useMemo(
    () => (backTextureUrl ? loadTokenTexture(backTextureUrl) : frontTex),
    [backTextureUrl, frontTex]
  );

  const tokenThickness = 0.005;

  const materials = useMemo(() => {
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#423326',
      roughness: 0.9,
      metalness: 0.05,
    });
    const frontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      roughness: 0.45,
      metalness: 0.05,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.45,
      metalness: 0.05,
    });

    if (isRound) {
      return [rimMat, frontMat, backMat];
    } else {
      return [rimMat, rimMat, rimMat, rimMat, frontMat, backMat];
    }
  }, [frontTex, backTex, isRound]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const speed = 1 - Math.pow(0.001, delta);

    if (grabbingControllerRef.current) {
      grabbingControllerRef.current.updateWorldMatrix(true, false);
      grabbingControllerRef.current.getWorldPosition(_ctrlPos);
      grabbingControllerRef.current.getWorldQuaternion(_ctrlRot);

      _offset.set(0, 0.02, -0.10).applyQuaternion(_ctrlRot);
      _targetPos.copy(_ctrlPos).add(_offset);

      if (groupRef.current.parent) {
        groupRef.current.parent.updateWorldMatrix(true, false);
        groupRef.current.parent.worldToLocal(_targetPos);
      }

      groupRef.current.position.lerp(_targetPos, speed);

      if (groupRef.current.parent) {
        groupRef.current.parent.getWorldQuaternion(_parentQuat);
        _localTargetQuat.copy(_parentQuat).invert().multiply(_ctrlRot);
        if (isFlipped) {
          _localTargetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
        }
        groupRef.current.quaternion.slerp(_localTargetQuat, speed);
      } else {
        groupRef.current.quaternion.slerp(_ctrlRot, speed);
      }

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.35, speed)
      );
    } else if (isInspecting) {
      const inspectY = position[1] + 0.12;
      const inspectZ = position[2] + 0.12;

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, inspectY, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, inspectZ, speed);

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.4, speed)
      );

      const targetRotX = isRound ? (isFlipped ? Math.PI : 0) : 0;
      const targetRotY = isRound ? 0 : (isFlipped ? Math.PI : 0);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX - Math.PI / 8, speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, speed);
    } else {
      const targetScale = hovered ? scale * 1.12 : scale;
      const targetY = hovered ? position[1] + 0.015 : position[1];

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, targetY, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, position[2], speed);

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, speed)
      );

      const targetRotX = isRound ? (isFlipped ? rotation[0] + Math.PI : rotation[0]) : rotation[0];
      const targetRotY = isRound ? rotation[1] : (isFlipped ? rotation[1] + Math.PI : rotation[1]);

      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotation[2], speed);
    }
  });

  const handleFlipAction = () => {
    playHapticProfile('hover');
    setIsFlipped((prev) => !prev);
  };

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
    handleFlipAction();
    if (onSelect) onSelect();
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
      >
        {isRound ? (
          <mesh material={materials} castShadow receiveShadow>
            <cylinderGeometry args={[radius, radius, tokenThickness, 32]} />
          </mesh>
        ) : (
          <mesh material={materials} castShadow receiveShadow>
            <boxGeometry args={[width, height, tokenThickness]} />
          </mesh>
        )}

        {/* Clean Hover Highlight Ring */}
        {hovered && (
          <mesh position={[0, tokenThickness / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius * 0.95, radius * 1.15, 32]} />
            <meshBasicMaterial color="#f0d070" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Label on Hover */}
        {hovered && label && (
          <group position={[0, radius + 0.03, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.22, 0.035]} />
              <meshBasicMaterial color="#140e1a" transparent opacity={0.9} />
            </mesh>
            <Text fontSize={0.018} color="#f5dfa3" textAlign="center">
              {label}
            </Text>
          </group>
        )}
      </group>
    </Interactive>
  );
};

export default PhysicalToken3D;
