import React, { useMemo } from 'react';
import * as THREE from 'three';

interface GothicBookshelfProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

/**
 * Procedural single book with leather binding and page block.
 */
const Book: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  depth?: number;
  color?: string;
  tiltZ?: number;
}> = ({
  position,
  rotation = [0, 0, 0],
  width = 0.12,
  height = 0.55,
  depth = 0.42,
  color = '#4a1515',
  tiltZ = 0,
}) => {
  return (
    <group position={position} rotation={[rotation[0], rotation[1], rotation[2] + tiltZ]}>
      {/* Leather Cover / Spine */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Parchment Pages Block (recessed inside cover) */}
      <mesh position={[width * 0.1, height / 2, depth * 0.05]}>
        <boxGeometry args={[width * 0.75, height * 0.94, depth * 0.9]} />
        <meshStandardMaterial color="#dfd4b8" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Gold foil ribs on spine */}
      {[-0.14, 0, 0.14].map((offset, i) => (
        <mesh key={i} position={[-width * 0.49, height / 2 + offset, -depth * 0.4]}>
          <boxGeometry args={[0.015, 0.02, depth * 0.16]} />
          <meshStandardMaterial color="#c29b38" roughness={0.4} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * PotionBottle renders a luminous arcane potion bottle with a subtle glowing aura.
 */
const PotionBottle: React.FC<{
  position: [number, number, number];
  liquidColor: string;
  shape?: 'flask' | 'cylinder' | 'round';
}> = ({ position, liquidColor, shape = 'flask' }) => {
  return (
    <group position={position}>
      {/* Glass Body */}
      {shape === 'flask' ? (
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.07, 0.12, 0.26, 8]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.55}
            roughness={0.15}
            transmission={0.65}
            ior={1.45}
          />
        </mesh>
      ) : shape === 'round' ? (
        <mesh position={[0, 0.13, 0]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.55}
            roughness={0.15}
            transmission={0.65}
            ior={1.45}
          />
        </mesh>
      ) : (
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.55}
            roughness={0.15}
            transmission={0.65}
            ior={1.45}
          />
        </mesh>
      )}

      {/* Luminous Inner Liquid */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.065, 0.095, 0.2, 8]} />
        <meshBasicMaterial color={liquidColor} />
      </mesh>

      {/* Bottle Neck */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.08, 8]} />
        <meshStandardMaterial color="#888888" roughness={0.2} transparent opacity={0.6} />
      </mesh>

      {/* Cork Stopper */}
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.038, 0.032, 0.06, 8]} />
        <meshStandardMaterial color="#8a5f3d" roughness={0.9} />
      </mesh>

      {/* Subtle Arcane Glow Point Light */}
      <pointLight position={[0, 0.15, 0]} color={liquidColor} intensity={0.5} distance={1.8} />
    </group>
  );
};

/**
 * Bleached Human Skull decorative prop.
 */
const SkullProp: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation} scale={0.75}>
      {/* Cranium */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#d4ccba" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Eye Sockets */}
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.12, 0.13]}>
          <sphereGeometry args={[0.032, 6, 6]} />
          <meshBasicMaterial color="#0c0a0d" />
        </mesh>
      ))}
      {/* Maxilla / Teeth */}
      <mesh position={[0, 0.03, 0.08]}>
        <boxGeometry args={[0.12, 0.08, 0.1]} />
        <meshStandardMaterial color="#cec5b0" roughness={0.9} metalness={0.1} />
      </mesh>
    </group>
  );
};

/**
 * GothicBookshelf renders a massive dark-oak bookcase with pointed gothic arches,
 * loaded with antique spellbooks, glowing potion flasks, rolled scrolls, and skulls.
 */
export const GothicBookshelf: React.FC<GothicBookshelfProps> = ({
  position,
  rotation = [0, 0, 0],
  scale = 1.0,
}) => {
  const width = 3.6;
  const height = 5.6;
  const depth = 0.85;

  const bookPalette = useMemo(
    () => [
      '#4a1515', // Oxblood
      '#1a2a40', // Midnight Navy
      '#183a24', // Dark Emerald
      '#351b42', // Necromantic Purple
      '#262428', // Charcoal Leather
      '#59281a', // Terracotta
      '#1b1c20', // Obsidian
    ],
    []
  );

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Back Panel */}
      <mesh position={[0, height / 2, -depth / 2 + 0.04]} receiveShadow>
        <boxGeometry args={[width, height, 0.08]} />
        <meshStandardMaterial color="#1a1412" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Side Uprights (Carved Dark Wood Pillars) */}
      {[-width / 2 + 0.1, width / 2 - 0.1].map((x, i) => (
        <mesh key={i} position={[x, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, height, depth]} />
          <meshStandardMaterial color="#241a15" roughness={0.8} metalness={0.12} />
        </mesh>
      ))}

      {/* Top Gothic Crown Trim */}
      <mesh position={[0, height + 0.12, 0]} castShadow>
        <boxGeometry args={[width + 0.25, 0.24, depth + 0.1]} />
        <meshStandardMaterial color="#2d201a" roughness={0.75} metalness={0.15} />
      </mesh>

      {/* Pointed Gothic Arch Crest */}
      <mesh position={[0, height + 0.45, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.12]} />
        <meshStandardMaterial color="#241a15" roughness={0.8} metalness={0.12} />
      </mesh>

      {/* Plinth Base */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.2, 0.28, depth + 0.08]} />
        <meshStandardMaterial color="#1f1612" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Shelves */}
      {[1.2, 2.5, 3.8, 5.1].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.2, 0.1, depth - 0.08]} />
          <meshStandardMaterial color="#241a15" roughness={0.8} metalness={0.12} />
        </mesh>
      ))}

      {/* ========================================================
          SHELF 1 (Bottom, y ~ 0.28 to 1.2): Heavy Grimoires & Mortar
          ======================================================== */}
      {/* Stacks of horizontal tomes */}
      <group position={[-1.1, 0.28, 0]}>
        <Book position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} width={0.16} height={0.7} depth={0.5} color="#351b42" />
        <Book position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, 0.1]} width={0.14} height={0.65} depth={0.46} color="#4a1515" />
      </group>

      {/* Row of thick upright tomes */}
      {Array.from({ length: 9 }).map((_, i) => (
        <Book
          key={`s1-${i}`}
          position={[-0.4 + i * 0.17, 0.28, 0]}
          width={0.12 + (i % 3) * 0.02}
          height={0.65 + (i % 2) * 0.1}
          depth={0.46}
          color={bookPalette[i % bookPalette.length]}
          tiltZ={i === 8 ? 0.2 : 0}
        />
      ))}

      {/* ========================================================
          SHELF 2 (y ~ 1.25 to 2.5): Ancient Books & Bleached Skull
          ======================================================== */}
      {Array.from({ length: 7 }).map((_, i) => (
        <Book
          key={`s2-${i}`}
          position={[-1.3 + i * 0.18, 1.25, 0]}
          width={0.13}
          height={0.58 + (i % 3) * 0.08}
          depth={0.44}
          color={bookPalette[(i + 2) % bookPalette.length]}
          tiltZ={i === 6 ? 0.24 : 0}
        />
      ))}

      {/* Skull resting next to books */}
      <SkullProp position={[0.4, 1.25, 0.05]} rotation={[0, -0.4, 0]} />

      {/* Rolled parchment scrolls */}
      {[-0.08, 0.04].map((z, idx) => (
        <mesh key={idx} position={[1.0, 1.32 + idx * 0.09, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.44, 8]} />
          <meshStandardMaterial color="#dfd0b2" roughness={0.9} />
        </mesh>
      ))}

      {/* ========================================================
          SHELF 3 (y ~ 2.55 to 3.8): Mystic Glowing Potions & Books
          ======================================================== */}
      {/* Glowing emerald poison flask */}
      <PotionBottle position={[-1.1, 2.55, 0.05]} liquidColor="#00ff88" shape="flask" />
      {/* Glowing blood-red elixir */}
      <PotionBottle position={[-0.75, 2.55, -0.02]} liquidColor="#ff2244" shape="round" />
      {/* Glowing violet arcane draft */}
      <PotionBottle position={[-0.45, 2.55, 0.08]} liquidColor="#bb33ff" shape="cylinder" />

      {/* Row of dark tomes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <Book
          key={`s3-${i}`}
          position={[0.1 + i * 0.16, 2.55, 0]}
          width={0.12}
          height={0.55 + (i % 2) * 0.08}
          depth={0.42}
          color={bookPalette[(i + 4) % bookPalette.length]}
          tiltZ={i === 6 ? 0.18 : 0}
        />
      ))}

      {/* ========================================================
          SHELF 4 (Top, y ~ 3.85 to 5.1): Scrying Orb & Ancient Tomes
          ======================================================== */}
      {/* Scrying Crystal Orb on Pedestal */}
      <group position={[-0.8, 3.85, 0]}>
        {/* Bronze claw pedestal */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.1, 0.14, 0.16, 8]} />
          <meshStandardMaterial color="#6a4c28" roughness={0.5} metalness={0.8} />
        </mesh>
        {/* Glowing glass orb */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshPhysicalMaterial
            color="#aaddff"
            transparent
            opacity={0.85}
            roughness={0.1}
            transmission={0.8}
            ior={1.5}
          />
        </mesh>
        {/* Inner mystic core */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#55ccff" />
        </mesh>
        <pointLight position={[0, 0.3, 0]} color="#55ccff" intensity={0.6} distance={2.5} />
      </group>

      {/* High-shelf antique books */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Book
          key={`s4-${i}`}
          position={[-0.1 + i * 0.16, 3.85, 0]}
          width={0.11}
          height={0.52}
          depth={0.4}
          color={bookPalette[(i + 1) % bookPalette.length]}
        />
      ))}
    </group>
  );
};
