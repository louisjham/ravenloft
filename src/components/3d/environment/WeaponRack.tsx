import React from 'react';
import * as THREE from 'three';

interface WeaponRackProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

/**
 * Gothic Heater Shield mounted to the weapon rack.
 */
const HeaterShield: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  crestColor?: string;
}> = ({ position, rotation = [0, 0, 0], crestColor = '#7a1c1c' }) => {
  return (
    <group position={position} rotation={rotation} scale={0.85}>
      {/* Shield Main Body (layered curved plate) */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.95, 0.05]} />
        <meshStandardMaterial color={crestColor} roughness={0.65} metalness={0.2} />
      </mesh>

      {/* Rusted Iron Rim Frame */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.74, 0.99, 0.03]} />
        <meshStandardMaterial color="#222026" roughness={0.6} metalness={0.85} />
      </mesh>

      {/* Central Iron Boss Stud */}
      <mesh position={[0, 0.1, 0.05]}>
        <coneGeometry args={[0.1, 0.08, 8]} />
        <meshStandardMaterial color="#2a282f" roughness={0.5} metalness={0.9} />
      </mesh>

      {/* Heraldic Black Iron Cross */}
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.12, 0.85, 0.02]} />
        <meshStandardMaterial color="#111113" roughness={0.8} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.15, 0.03]}>
        <boxGeometry args={[0.6, 0.12, 0.02]} />
        <meshStandardMaterial color="#111113" roughness={0.8} metalness={0.3} />
      </mesh>
    </group>
  );
};

/**
 * Medieval Broadsword resting in the rack.
 */
const Broadsword: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Blade (double-edged steel) */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.07, 1.4, 0.018]} />
        <meshStandardMaterial color="#b8c0cc" roughness={0.25} metalness={0.92} />
      </mesh>

      {/* Central Fuller Groove */}
      <mesh position={[0, 0.7, 0.009]}>
        <boxGeometry args={[0.018, 1.1, 0.005]} />
        <meshStandardMaterial color="#78808a" roughness={0.4} metalness={0.85} />
      </mesh>

      {/* Crossguard */}
      <mesh position={[0, 1.42, 0]}>
        <boxGeometry args={[0.34, 0.04, 0.04]} />
        <meshStandardMaterial color="#3a3840" roughness={0.5} metalness={0.85} />
      </mesh>

      {/* Leather Wrapped Grip */}
      <mesh position={[0, 1.58, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.28, 8]} />
        <meshStandardMaterial color="#2d1a10" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Iron Pommel */}
      <mesh position={[0, 1.74, 0]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#3a3840" roughness={0.5} metalness={0.88} />
      </mesh>
    </group>
  );
};

/**
 * Halberd / Polearm with axe blade and thrusting spearhead.
 */
const Halberd: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Ash Wood Shaft */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.03, 2.6, 8]} />
        <meshStandardMaterial color="#3b271a" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Halberd Axe Blade Head */}
      <mesh position={[0.14, 2.35, 0]}>
        <boxGeometry args={[0.26, 0.32, 0.02]} />
        <meshStandardMaterial color="#aab2bf" roughness={0.25} metalness={0.92} />
      </mesh>

      {/* Top Spear Thrusting Spike */}
      <mesh position={[0, 2.65, 0]}>
        <coneGeometry args={[0.04, 0.35, 6]} />
        <meshStandardMaterial color="#b0b8c6" roughness={0.25} metalness={0.92} />
      </mesh>

      {/* Back Armor-Piercing Beak / Hook */}
      <mesh position={[-0.1, 2.35, 0]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.035, 0.2, 5]} />
        <meshStandardMaterial color="#707682" roughness={0.4} metalness={0.85} />
      </mesh>
    </group>
  );
};

/**
 * Battleaxe with curved iron head.
 */
const Battleaxe: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Wood Haft */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.03, 1.5, 8]} />
        <meshStandardMaterial color="#2d1b10" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Crescent Axe Blade */}
      <mesh position={[0.15, 1.35, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.025, 8, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#b2bac8" roughness={0.28} metalness={0.9} />
      </mesh>

      {/* Iron Reinforcing Sockets & Straps */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.22, 8]} />
        <meshStandardMaterial color="#2a2830" roughness={0.6} metalness={0.85} />
      </mesh>
    </group>
  );
};

/**
 * WeaponRack renders a sturdy heavy-timber rack filled with shields, broadswords,
 * battleaxes, and polearms.
 */
export const WeaponRack: React.FC<WeaponRackProps> = ({
  position,
  rotation = [0, 0, 0],
  scale = 1.0,
}) => {
  const width = 3.2;
  const depth = 0.85;

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Side A-Frame Timber Uprights */}
      {[-width / 2 + 0.15, width / 2 - 0.15].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {/* Base Foot */}
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.18, 0.2, depth]} />
            <meshStandardMaterial color="#241a15" roughness={0.85} metalness={0.1} />
          </mesh>
          {/* Front Slanted Timber */}
          <mesh position={[0, 1.1, 0.18]} rotation={[-0.18, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 2.0, 0.14]} />
            <meshStandardMaterial color="#241a15" roughness={0.85} metalness={0.1} />
          </mesh>
          {/* Back Slanted Timber */}
          <mesh position={[0, 1.1, -0.18]} rotation={[0.18, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 2.0, 0.14]} />
            <meshStandardMaterial color="#241a15" roughness={0.85} metalness={0.1} />
          </mesh>
        </group>
      ))}

      {/* Bottom Crossbeam with Rest Troughs */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.14, depth * 0.7]} />
        <meshStandardMaterial color="#1f1612" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Middle Weapon Slotted Crossbeam */}
      <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, 0.2]} />
        <meshStandardMaterial color="#241a15" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Top Crossbeam Bar */}
      <mesh position={[0, 2.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.12, 0.16]} />
        <meshStandardMaterial color="#241a15" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Iron Reinforcing Angle Brackets */}
      {[-width / 2 + 0.15, width / 2 - 0.15].map((x, i) => (
        <mesh key={i} position={[x, 1.3, 0.11]}>
          <boxGeometry args={[0.17, 0.16, 0.03]} />
          <meshStandardMaterial color="#1a181b" roughness={0.6} metalness={0.85} />
        </mesh>
      ))}

      {/* ========================================================
          WEAPONS RESTING IN RACK
          ======================================================== */}
      {/* Broadswords */}
      <Broadsword position={[-0.9, 0.25, 0.02]} rotation={[0.08, 0, 0]} />
      <Broadsword position={[-0.55, 0.25, 0.02]} rotation={[0.08, 0, 0]} />

      {/* Battleaxes */}
      <Battleaxe position={[-0.15, 0.25, 0.02]} rotation={[0.08, 0, 0]} />
      <Battleaxe position={[0.25, 0.25, 0.02]} rotation={[0.08, Math.PI, 0]} />

      {/* Halberds / Polearms */}
      <Halberd position={[0.65, 0.25, 0.02]} rotation={[0.08, 0, 0]} />
      <Halberd position={[1.0, 0.25, 0.02]} rotation={[0.08, 0, 0]} />

      {/* ========================================================
          HEATER SHIELDS MOUNTED ON FRONT
          ======================================================== */}
      <HeaterShield position={[-0.75, 0.75, 0.32]} rotation={[-0.1, 0, 0]} crestColor="#7a1c1c" />
      <HeaterShield position={[0.75, 0.75, 0.32]} rotation={[-0.1, 0, 0]} crestColor="#1c3a6b" />
    </group>
  );
};
