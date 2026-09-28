import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { playHapticProfile } from '../XRHaptics';

export interface PhysicalTile3DProps {
  textureUrl: string;
  backTextureUrl?: string;
  label?: string;
  sublabel?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  size?: number;
  onSelect?: () => void;
}

const textureLoader = new THREE.TextureLoader();
const tileTextureCache = new Map<string, THREE.Texture>();

function loadTileTexture(url: string): THREE.Texture {
  if (tileTextureCache.has(url)) {
    return tileTextureCache.get(url)!;
  }
  const tex = textureLoader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tileTextureCache.set(url, tex);
  return tex;
}

const _ctrlPos = new THREE.Vector3();
const _ctrlRot = new THREE.Quaternion();
const _offset = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _localTargetQuat = new THREE.Quaternion();

/**
 * PhysicalTile3D is an authentic 3D dungeon tile mesh that can be inspected,
 * rotated, and picked up in 6DoF with VR controllers or desktop mouse.
 */
export const PhysicalTile3D: React.FC<PhysicalTile3DProps> = ({
  textureUrl,
  backTextureUrl = '/assets/tiles/Tile_Back.png',
  label,
  sublabel,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  size = 0.22,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);

  const tileThickness = 0.006;

  const topTex = useMemo(() => loadTileTexture(textureUrl), [textureUrl]);
  const backTex = useMemo(() => loadTileTexture(backTextureUrl), [backTextureUrl]);

  const materials = useMemo(() => {
    const stoneEdgeMat = new THREE.MeshStandardMaterial({
      color: '#2a2725',
      roughness: 0.95,
      metalness: 0.05,
    });
    const topMat = new THREE.MeshStandardMaterial({
      map: topTex,
      roughness: 0.7,
      metalness: 0.05,
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: backTex,
      roughness: 0.8,
      metalness: 0.05,
    });

    return [stoneEdgeMat, stoneEdgeMat, topMat, backMat, stoneEdgeMat, stoneEdgeMat];
  }, [topTex, backTex]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const speed = 1 - Math.pow(0.001, delta);

    if (grabbingControllerRef.current) {
      grabbingControllerRef.current.updateWorldMatrix(true, false);
      grabbingControllerRef.current.getWorldPosition(_ctrlPos);
      grabbingControllerRef.current.getWorldQuaternion(_ctrlRot);

      _offset.set(0, 0.03, -0.12).applyQuaternion(_ctrlRot);
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

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.35, speed)
      );
    } else if (isInspecting) {
      const inspectY = position[1] + 0.15;
      const inspectZ = position[2] + 0.15;

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, inspectY, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, inspectZ, speed);

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.3, speed)
      );

      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -Math.PI / 4, speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation[1], speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, speed);
    } else {
      const targetScale = hovered ? scale * 1.08 : scale;
      const targetY = hovered ? position[1] + 0.018 : position[1];

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
        <mesh material={materials} castShadow receiveShadow>
          <boxGeometry args={[size, tileThickness, size]} />
        </mesh>

        {/* Clean Golden Hover Halo (No diagonal wireframe lines) */}
        {hovered && (
          <mesh position={[0, tileThickness / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[size + 0.008, size + 0.008]} />
            <meshBasicMaterial color="#f0d070" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        )}

        {/* Hover Title Tag */}
        {hovered && label && (
          <group position={[0, tileThickness + 0.04, 0]} rotation={[-Math.PI / 6, 0, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.26, sublabel ? 0.05 : 0.035]} />
              <meshBasicMaterial color="#110d18" transparent opacity={0.92} />
            </mesh>
            <Text position={[0, sublabel ? 0.008 : 0, 0.002]} fontSize={0.019} color="#f5dfa3" textAlign="center">
              {label}
            </Text>
            {sublabel && (
              <Text position={[0, -0.012, 0.002]} fontSize={0.012} color="#a09080" textAlign="center">
                {sublabel}
              </Text>
            )}
          </group>
        )}
      </group>
    </Interactive>
  );
};

export default PhysicalTile3D;
