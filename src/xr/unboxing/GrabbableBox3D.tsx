import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { playHapticProfile } from '../XRHaptics';

export interface GrabbableBox3DProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

const textureLoader = new THREE.TextureLoader();

function loadTex(path: string): THREE.Texture {
  const tex = textureLoader.load(path, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const _ctrlPos = new THREE.Vector3();
const _ctrlRot = new THREE.Quaternion();
const _offset = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _localTargetQuat = new THREE.Quaternion();

/**
 * GrabbableBox3D is the full 3D physical Castle Ravenloft game box that players can pick up,
 * inspect in 6DoF, flip over to read the back-of-box cover, and toggle open/closed.
 */
export const GrabbableBox3D: React.FC<GrabbableBox3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const lidHingeRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const grabbingControllerRef = useRef<THREE.Object3D | null>(null);

  const topTex = useMemo(() => loadTex('/ui/box_art.webp'), []);
  const bottomTex = useMemo(() => loadTex('/ui/box_bottom.webp'), []);
  const northTex = useMemo(() => loadTex('/ui/box_side_north.webp'), []);
  const southTex = useMemo(() => loadTex('/ui/box_side_south.webp'), []);
  const eastTex = useMemo(() => loadTex('/ui/box_side_east.webp'), []);
  const westTex = useMemo(() => loadTex('/ui/box_side_west.webp'), []);

  const BOX_W = 0.32;
  const BOX_D = 0.32;
  const BOX_H = 0.06;
  const LID_H = 0.016;

  const lidMaterials = useMemo(() => {
    const eastMat = new THREE.MeshStandardMaterial({ map: eastTex, roughness: 0.45 });
    const westMat = new THREE.MeshStandardMaterial({ map: westTex, roughness: 0.45 });
    const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35 });
    const innerLidMat = new THREE.MeshStandardMaterial({ color: '#140a18', roughness: 0.85 });
    const southMat = new THREE.MeshStandardMaterial({ map: southTex, roughness: 0.45 });
    const northMat = new THREE.MeshStandardMaterial({ map: northTex, roughness: 0.45 });

    return [eastMat, westMat, topMat, innerLidMat, southMat, northMat];
  }, [eastTex, westTex, topTex, southTex, northTex]);

  const trayMaterials = useMemo(() => {
    const eastMat = new THREE.MeshStandardMaterial({ map: eastTex, roughness: 0.45 });
    const westMat = new THREE.MeshStandardMaterial({ map: westTex, roughness: 0.45 });
    const innerTrayMat = new THREE.MeshStandardMaterial({ color: '#0e0814', roughness: 0.95 });
    const bottomMat = new THREE.MeshStandardMaterial({ map: bottomTex, roughness: 0.45 });
    const southMat = new THREE.MeshStandardMaterial({ map: southTex, roughness: 0.45 });
    const northMat = new THREE.MeshStandardMaterial({ map: northTex, roughness: 0.45 });

    return [eastMat, westMat, innerTrayMat, bottomMat, southMat, northMat];
  }, [eastTex, westTex, bottomTex, southTex, northTex]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const speed = 1 - Math.pow(0.001, delta);

    // Animate lid hinge
    if (lidHingeRef.current) {
      const targetAngle = isOpen ? -Math.PI * 0.65 : 0;
      lidHingeRef.current.rotation.x = THREE.MathUtils.lerp(
        lidHingeRef.current.rotation.x,
        targetAngle,
        speed
      );
    }

    if (grabbingControllerRef.current) {
      grabbingControllerRef.current.updateWorldMatrix(true, false);
      grabbingControllerRef.current.getWorldPosition(_ctrlPos);
      grabbingControllerRef.current.getWorldQuaternion(_ctrlRot);

      _offset.set(0, 0.04, -0.16).applyQuaternion(_ctrlRot);
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
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.25, speed)
      );
    } else if (isInspecting) {
      const inspectY = position[1] + 0.18;
      const inspectZ = position[2] + 0.18;

      const currentPos = groupRef.current.position;
      currentPos.x = THREE.MathUtils.lerp(currentPos.x, position[0], speed);
      currentPos.y = THREE.MathUtils.lerp(currentPos.y, inspectY, speed);
      currentPos.z = THREE.MathUtils.lerp(currentPos.z, inspectZ, speed);

      groupRef.current.scale.setScalar(
        THREE.MathUtils.lerp(groupRef.current.scale.x, scale * 1.3, speed)
      );

      const targetRotX = isFlipped ? Math.PI : -Math.PI / 8;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, speed);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, rotation[1], speed);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, speed);
    } else {
      const targetScale = hovered ? scale * 1.06 : scale;
      const targetY = hovered ? position[1] + 0.015 : position[1];

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

  const handleToggleOpen = () => {
    playHapticProfile('click');
    setIsOpen((prev) => !prev);
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
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setIsInspecting(prev => !prev);
  };

  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setIsFlipped(prev => !prev);
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
        {/* Box Bottom Tray */}
        <mesh position={[0, BOX_H / 2, 0]} material={trayMaterials} castShadow receiveShadow>
          <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
        </mesh>

        {/* Hinged Lid */}
        <group ref={lidHingeRef} position={[0, BOX_H, -BOX_D / 2]}>
          <mesh position={[0, LID_H / 2, BOX_D / 2]} material={lidMaterials} castShadow receiveShadow>
            <boxGeometry args={[BOX_W + 0.006, LID_H, BOX_D + 0.006]} />
          </mesh>
        </group>

        {/* Clean Hover Highlight Halo (No diagonal lines) */}
        {hovered && (
          <mesh position={[0, BOX_H + LID_H + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[BOX_W + 0.012, BOX_D + 0.012]} />
            <meshBasicMaterial color="#f0d070" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        )}

        {/* Hover Nameplate */}
        {hovered && (
          <group position={[0, BOX_H + LID_H + 0.08, 0]} rotation={[-Math.PI / 6, 0, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.32, 0.05]} />
              <meshBasicMaterial color="#110d18" transparent opacity={0.92} />
            </mesh>
            <Text position={[0, 0.008, 0.002]} fontSize={0.018} color="#f5dfa3" textAlign="center">
              Physical Game Box (6DoF)
            </Text>
            <Text position={[0, -0.012, 0.002]} fontSize={0.012} color="#a09080" textAlign="center">
              Grip to Pick Up & Flip | Click to Inspect
            </Text>
          </group>
        )}
      </group>
    </Interactive>
  );
};

export default GrabbableBox3D;
