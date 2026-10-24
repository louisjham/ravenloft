import React, { useState, useEffect, Suspense } from 'react';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import { WallTorch } from './WallTorch';
import { HangingSkeleton } from './HangingSkeleton';
import { GothicBookshelf } from './GothicBookshelf';
import { WeaponRack } from './WeaponRack';
import { useGLTF } from '@react-three/drei';

const ROOM_SIZE = 50;
const WALL_HEIGHT = 12;
const HALF = ROOM_SIZE / 2;

/**
 * Single stone pillar with base and capital moulding.
 */
const StonePillar: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Plinth Base */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.8, 1.5]} />
        <meshStandardMaterial color="#1a1820" roughness={0.92} metalness={0.08} />
      </mesh>
      {/* Shaft */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, WALL_HEIGHT - 1.6, 1.1]} />
        <meshStandardMaterial color="#211e26" roughness={0.9} metalness={0.08} />
      </mesh>
      {/* Capital Crown */}
      <mesh position={[0, WALL_HEIGHT - 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.8, 1.5]} />
        <meshStandardMaterial color="#1a1820" roughness={0.92} metalness={0.08} />
      </mesh>
    </group>
  );
};

/**
 * Iron sewer/crypt floor drain grate with eerie light emanating from below.
 */
const CryptFloorGrate: React.FC<{
  position: [number, number, number];
  glowColor?: string;
}> = ({ position, glowColor = '#00ff77' }) => {
  return (
    <group position={position}>
      {/* Recessed pit */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[2.2, 0.3, 2.2]} />
        <meshBasicMaterial color="#050508" />
      </mesh>
      {/* Heavy iron rim */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[2.4, 0.04, 2.4]} />
        <meshStandardMaterial color="#18161b" roughness={0.7} metalness={0.85} />
      </mesh>
      {/* Iron bars */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((x, i) => (
        <mesh key={i} position={[x, 0.02, 0]}>
          <boxGeometry args={[0.08, 0.05, 2.2]} />
          <meshStandardMaterial color="#201e25" roughness={0.65} metalness={0.9} />
        </mesh>
      ))}
      {/* Eerie underlight */}
      <pointLight position={[0, -0.05, 0]} color={glowColor} intensity={0.8} distance={4} />
    </group>
  );
};

/**
 * Gothic Stone Wall with texture mapping and top cornice.
 */
const WallSection: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  texture: THREE.Texture | null;
}> = ({ position, rotation, texture }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Main Stone Wall Slab */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_SIZE, WALL_HEIGHT]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#908899' : '#1c1922'}
          roughness={0.92}
          metalness={0.08}
        />
      </mesh>

      {/* Heavy Stone Baseboard Trim */}
      <mesh position={[0, 0.3, 0.15]} receiveShadow>
        <boxGeometry args={[ROOM_SIZE, 0.6, 0.3]} />
        <meshStandardMaterial color="#16141a" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Top Cornice Trim */}
      <mesh position={[0, WALL_HEIGHT - 0.3, 0.2]} receiveShadow>
        <boxGeometry args={[ROOM_SIZE, 0.6, 0.4]} />
        <meshStandardMaterial color="#141217" roughness={0.95} metalness={0.05} />
      </mesh>
    </group>
  );
};

/**
 * Gothic Arch Top connecting ceiling rafters.
 */
const CeilingArchBeam: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
}> = ({ position, rotation }) => {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[ROOM_SIZE, 0.6, 0.6]} />
        <meshStandardMaterial color="#16141a" roughness={0.95} metalness={0.1} />
      </mesh>
    </group>
  );
};

/**
 * Prop wrapper for GLTF barrels.
 */
const TavernBarrelProp: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position, rotation = [0, 0, 0], scale = 1.0 }) => {
  const { scene } = useGLTF('/models/tavern_barrel.glb');
  const cloned = React.useMemo(() => scene.clone(), [scene]);
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
      castShadow
      receiveShadow
    />
  );
};

/**
 * Prop wrapper for gargoyle statues perched on stone wall corbels.
 */
const GargoyleCorbelProp: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => {
  const { scene } = useGLTF('/models/gargoyle.glb');
  const cloned = React.useMemo(() => scene.clone(), [scene]);
  return (
    <group position={position} rotation={rotation}>
      {/* Stone Wall Corbel Shelf */}
      <mesh position={[0, -0.2, 0.4]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.4, 0.9]} />
        <meshStandardMaterial color="#18161c" roughness={0.92} metalness={0.08} />
      </mesh>
      {/* Gargoyle Statue */}
      <primitive
        object={cloned}
        position={[0, 0, 0.4]}
        rotation={[0, 0, 0]}
        scale={[0.7, 0.7, 0.7]}
      />
    </group>
  );
};

/**
 * Master DungeonChamber component.
 * Renders an expansive, sinister gothic dungeon hall surrounding the play area:
 * - Massive stone walls, arched pillars, and carved cornices
 * - Skeletons chained in iron manacles against the wall
 * - Flickering wall torches casting organic dancing firelight
 * - Heavy gothic bookshelves with ancient grimoires, skulls, and glowing potion flasks
 * - Sturdy weapon racks loaded with medieval broadswords, halberds, and battle shields
 * - Subterranean sewer grates with eerie green and crimson underlighting
 */
export const DungeonChamber: React.FC = () => {
  const { isPresenting } = useXR();
  const [wallTexture, setWallTexture] = useState<THREE.Texture | null>(null);
  const [floorTexture, setFloorTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/ui/stone-wall.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(8, 2);
        tex.colorSpace = THREE.SRGBColorSpace;
        setWallTexture(tex);
      },
      undefined,
      () => {
        console.warn('Could not load stone-wall texture; using procedural gothic stone material.');
      }
    );

    loader.load(
      '/ui/stone-wall.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(12, 12);
        tex.colorSpace = THREE.SRGBColorSpace;
        setFloorTexture(tex);
      },
      undefined,
      () => {
        console.warn('Could not load floor texture; using procedural gothic floor material.');
      }
    );
  }, []);

  // In WebXR presentation mode, hide the room enclosure so passthrough stays clean
  if (isPresenting) {
    return null;
  }

  return (
    <group name="gothic-dungeon-chamber">
      {/* ========================================================
          1. DUNGEON STONE FLOOR
          ======================================================== */}
      <mesh
        receiveShadow
        position={[0, -0.45, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[ROOM_SIZE + 4, ROOM_SIZE + 4]} />
        <meshStandardMaterial
          map={floorTexture ?? undefined}
          color={floorTexture ? '#6a6473' : '#141219'}
          roughness={0.92}
          metalness={0.08}
        />
      </mesh>

      {/* Recessed Crypt Floor Grates with eerie underlighting */}
      <CryptFloorGrate position={[-16, -0.44, -16]} glowColor="#00ff66" />
      <CryptFloorGrate position={[16, -0.44, -16]} glowColor="#ff2244" />
      <CryptFloorGrate position={[-16, -0.44, 16]} glowColor="#7733ff" />
      <CryptFloorGrate position={[16, -0.44, 16]} glowColor="#00ddff" />

      {/* ========================================================
          2. PERIMETER GOTHIC STONE WALLS
          ======================================================== */}
      {/* North Wall (directly facing player) */}
      <WallSection position={[0, -0.4, -HALF]} rotation={[0, 0, 0]} texture={wallTexture} />
      {/* South Wall (behind camera) */}
      <WallSection position={[0, -0.4, HALF]} rotation={[0, Math.PI, 0]} texture={wallTexture} />
      {/* East Wall (right) */}
      <WallSection position={[HALF, -0.4, 0]} rotation={[0, -Math.PI / 2, 0]} texture={wallTexture} />
      {/* West Wall (left) */}
      <WallSection position={[-HALF, -0.4, 0]} rotation={[0, Math.PI / 2, 0]} texture={wallTexture} />

      {/* Ceiling Arch Crossbeams */}
      <CeilingArchBeam position={[0, WALL_HEIGHT - 0.7, 0]} rotation={[0, 0, 0]} />
      <CeilingArchBeam position={[0, WALL_HEIGHT - 0.7, 0]} rotation={[0, Math.PI / 2, 0]} />

      {/* ========================================================
          3. ARCHITECTURAL STONE PILLARS
          ======================================================== */}
      {/* North Wall Pillars */}
      {[-18, -10, -2, 2, 10, 18].map((x) => (
        <StonePillar key={`np-${x}`} position={[x, -0.4, -HALF + 0.55]} />
      ))}
      {/* South Wall Pillars */}
      {[-18, -10, -2, 2, 10, 18].map((x) => (
        <StonePillar key={`sp-${x}`} position={[x, -0.4, HALF - 0.55]} />
      ))}
      {/* East Wall Pillars */}
      {[-18, -10, 0, 10, 18].map((z) => (
        <StonePillar key={`ep-${z}`} position={[HALF - 0.55, -0.4, z]} />
      ))}
      {/* West Wall Pillars */}
      {[-18, -10, 0, 10, 18].map((z) => (
        <StonePillar key={`wp-${z}`} position={[-HALF + 0.55, -0.4, z]} />
      ))}

      {/* Corner Buttress Pillars */}
      <StonePillar position={[-HALF + 0.7, -0.4, -HALF + 0.7]} />
      <StonePillar position={[HALF - 0.7, -0.4, -HALF + 0.7]} />
      <StonePillar position={[-HALF + 0.7, -0.4, HALF - 0.7]} />
      <StonePillar position={[HALF - 0.7, -0.4, HALF - 0.7]} />

      {/* ========================================================
          4. FLICKERING WALL TORCHES & SCONCES
          ======================================================== */}
      {/* North Wall Torches */}
      <WallTorch position={[-10, 3.2, -HALF + 1.15]} rotation={[0, 0, 0]} intensity={1.8} />
      <WallTorch position={[-2, 3.2, -HALF + 1.15]} rotation={[0, 0, 0]} intensity={1.8} />
      <WallTorch position={[2, 3.2, -HALF + 1.15]} rotation={[0, 0, 0]} intensity={1.8} />
      <WallTorch position={[10, 3.2, -HALF + 1.15]} rotation={[0, 0, 0]} intensity={1.8} />

      {/* East Wall Torches */}
      <WallTorch position={[HALF - 1.15, 3.2, -10]} rotation={[0, -Math.PI / 2, 0]} intensity={1.7} />
      <WallTorch position={[HALF - 1.15, 3.2, 10]} rotation={[0, -Math.PI / 2, 0]} intensity={1.7} />

      {/* West Wall Torches */}
      <WallTorch position={[-HALF + 1.15, 3.2, -10]} rotation={[0, Math.PI / 2, 0]} intensity={1.7} />
      <WallTorch position={[-HALF + 1.15, 3.2, 10]} rotation={[0, Math.PI / 2, 0]} intensity={1.7} />

      {/* South Wall Torches (providing ambient rim firelight) */}
      <WallTorch position={[-10, 3.2, HALF - 1.15]} rotation={[0, Math.PI, 0]} intensity={1.6} />
      <WallTorch position={[10, 3.2, HALF - 1.15]} rotation={[0, Math.PI, 0]} intensity={1.6} />

      {/* ========================================================
          5. SKELETONS HANGING FROM MANACLES
          ======================================================== */}
      {/* North Wall: Suspended chained skeleton on left pillar */}
      <HangingSkeleton position={[-14, 2.6, -HALF + 0.4]} rotation={[0, 0, 0]} scale={1.15} />
      {/* North Wall: Suspended chained skeleton on right pillar */}
      <HangingSkeleton position={[14, 2.6, -HALF + 0.4]} rotation={[0, 0, 0]} scale={1.15} />

      {/* East Wall: Suspended chained skeleton in dark alcove */}
      <HangingSkeleton position={[HALF - 0.4, 2.6, 5]} rotation={[0, -Math.PI / 2, 0]} scale={1.1} />
      {/* West Wall: Suspended chained skeleton */}
      <HangingSkeleton position={[-HALF + 0.4, 2.6, -5]} rotation={[0, Math.PI / 2, 0]} scale={1.1} />

      {/* ========================================================
          6. GOTHIC BOOKSHELVES (TOMES, GLOWING POTIONS, SKULLS)
          ======================================================== */}
      {/* North Wall: Left Gothic Bookshelf */}
      <GothicBookshelf position={[-6, -0.4, -HALF + 0.8]} rotation={[0, 0, 0]} scale={1.05} />
      {/* North Wall: Right Gothic Bookshelf */}
      <GothicBookshelf position={[6, -0.4, -HALF + 0.8]} rotation={[0, 0, 0]} scale={1.05} />

      {/* ========================================================
          7. WEAPON RACKS (SHIELDS, BROADSWORDS, HALBERDS, AXES)
          ======================================================== */}
      {/* East Wall: Sturdy Weapon Rack */}
      <WeaponRack position={[HALF - 0.9, -0.4, -4]} rotation={[0, -Math.PI / 2, 0]} scale={1.05} />
      {/* West Wall: Sturdy Weapon Rack */}
      <WeaponRack position={[-HALF + 0.9, -0.4, 4]} rotation={[0, Math.PI / 2, 0]} scale={1.05} />

      {/* ========================================================
          8. GOTHIC DUNGEON PROPS (BARRELS, GARGOYLES)
          ======================================================== */}
      <Suspense fallback={null}>
        {/* Northwest Corner: Heavy Tavern Barrels */}
        <TavernBarrelProp position={[-19, -0.4, -20]} scale={1.25} rotation={[0, 0.4, 0]} />
        <TavernBarrelProp position={[-20.5, -0.4, -18.5]} scale={1.0} rotation={[0, -0.3, 0]} />

        {/* Northeast Corner: Barrels */}
        <TavernBarrelProp position={[19.5, -0.4, -20]} scale={1.2} rotation={[0, -0.6, 0]} />

        {/* Perched Stone Gargoyles overlooking the chamber */}
        <GargoyleCorbelProp position={[-18, 5.0, -HALF + 0.4]} rotation={[0, 0.3, 0]} />
        <GargoyleCorbelProp position={[18, 5.0, -HALF + 0.4]} rotation={[0, -0.3, 0]} />
      </Suspense>
    </group>
  );
};
