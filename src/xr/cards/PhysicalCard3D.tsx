import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Interactive } from '@react-three/xr';
import * as THREE from 'three';
import { Card } from '../../game/types';
import { getCardTextures } from './CardTextureGenerator';
import { playHapticProfile } from '../XRHaptics';

export interface PhysicalCard3DProps {
  card: Card;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  isFlipped?: boolean;
  isUsed?: boolean;
  onSelect?: (card: Card) => void;
  onFlipToggle?: (card: Card) => void;
}

const CARD_W = 0.16;
const CARD_H = 0.23;
const CARD_D = 0.002;

// Static scratch objects
const _ctrlPos = new THREE.Vector3();
const _ctrlRot = new THREE.Quaternion();
const _offset = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _localTargetQuat = new THREE.Quaternion();

/**
 * PhysicalCard3D is an authentic, double-sided 3D card object that players
 * can pick up in 6DoF, flip over, and inspect in WebXR and desktop.
 */
export const PhysicalCard3D: React.FC<PhysicalCard3DProps> = ({
  card,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  isFlipped = false,
  isUsed = false,
  onSelect,
  onFlipToggle,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [localFlipped, setLocalFlipped] = useState(isFlipped);
  const [isInspecting, setIsInspecting] = useState(false);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);

  // Textures for front and back
  const { front, back } = useMemo(() => getCardTextures(card), [card]);

  // Materials: [Right, Left, Top, Bottom, Front (+Z), Back (-Z)]
  const materials = useMemo(() => {
    const edgeMat = new THREE.MeshStandardMaterial({
      color: '#1a1816',
      roughness: 0.9,
      metalness: 0.05,
    });

    const frontMat = new THREE.MeshStandardMaterial({
      map: front,
      roughness: 0.35,
      metalness: 0.05,
    });

    const backMat = new THREE.MeshStandardMaterial({
      map: back,
      roughness: 0.35,
      metalness: 0.05,
    });

    return [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];
  }, [front, back]);

  const geometry = useMemo(() => new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const speed = 1 - Math.pow(0.001, delta);

    if (grabbingControllerRef.current) {
      // 6DoF Grabbed by controller
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
        if (isFlipped || localFlipped) {
          _localTargetQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
        }
        groupRef.current.quaternion.slerp(_localTargetQuat, speed);
      } else {
        groupRef.current.quaternion.slerp(_ctrlRot, speed);
      }

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.35, speed)
      );
    } else if (isInspecting) {
      // Clicked desktop inspection (lifts card up and enlarges)
      const inspectY = position[1] + 0.15;
      const inspectZ = position[2] + 0.15;

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, inspectY, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, inspectZ, speed);

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.4, speed)
      );

      const targetRotY = (isFlipped || localFlipped) ? Math.PI : 0;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -Math.PI / 8, speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, speed);
    } else {
      // Normal resting state
      const targetScale = hovered ? scale * 1.08 : scale;
      const targetYOffset = hovered ? 0.025 : 0;
      const targetZOffset = hovered ? 0.03 : 0;

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, position[1] + targetYOffset, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, position[2] + targetZOffset, speed);

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, speed)
      );

      const targetRotY = (isFlipped || localFlipped) ? Math.PI : rotation[1];
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rotation[0], speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, rotation[2], speed);
    }
  });

  const handleFlipAction = () => {
    playHapticProfile('hover');
    setLocalFlipped(prev => !prev);
    if (onFlipToggle) {
      onFlipToggle(card);
    }
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
      if (onSelect) {
        onSelect(card);
      }
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setIsInspecting(prev => !prev);
    if (onSelect) {
      onSelect(card);
    }
  };

  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    handleFlipAction();
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
        onContextMenu={handleContextMenu}
      >
        <mesh
          geometry={geometry}
          material={materials}
          castShadow
          receiveShadow
        />

        {/* Used / Exhausted card dark shroud */}
        {isUsed && (
          <mesh position={[0, 0, CARD_D / 2 + 0.001]}>
            <planeGeometry args={[CARD_W, CARD_H]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.65} depthWrite={false} />
          </mesh>
        )}

        {/* Clean Golden Hover Aura (No diagonal wireframe lines) */}
        {hovered && (
          <mesh position={[0, 0, CARD_D / 2 + 0.0005]}>
            <planeGeometry args={[CARD_W + 0.006, CARD_H + 0.006]} />
            <meshBasicMaterial color="#f0d070" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        )}
      </group>
    </Interactive>
  );
};

export default PhysicalCard3D;
