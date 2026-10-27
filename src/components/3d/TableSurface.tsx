import React, { useState, useEffect, useMemo } from 'react';
import { useXR } from '@react-three/xr';
import * as THREE from 'three';
import {
  TABLE_SIZE,
  TABLE_THICKNESS,
  FLOOR_PLANE_SIZE,
} from '../../game/engine/tabletopDimensions';

const HALF = TABLE_SIZE / 2;
const TRIM_WIDTH = 0.8;
const TRIM_HEIGHT = 0.04;

/**
 * Creates an in-memory procedural wood grain texture with natural plank seams,
 * fibers, and growth-ring curvature. Completely self-contained with no network
 * downloads required.
 */
function createProceduralWoodTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base background warm honey-chestnut tone
    ctx.fillStyle = '#5c3822';
    ctx.fillRect(0, 0, 1024, 1024);

    // Draw 8 wooden planks running vertically
    const numPlanks = 8;
    const plankWidth = 1024 / numPlanks;
    const plankHues = [
      '#633d23', '#6c4327', '#5f3a21', '#694126',
      '#5c3720', '#684025', '#6e4428', '#613c22'
    ];

    for (let p = 0; p < numPlanks; p++) {
      const x0 = p * plankWidth;

      // Fill plank with individual wood tone variation
      ctx.fillStyle = plankHues[p % plankHues.length];
      ctx.fillRect(x0, 0, plankWidth, 1024);

      // Fine grain fibers running longitudinally
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const gx = x0 + Math.random() * plankWidth;
        const alpha = 0.035 + Math.random() * 0.07;
        ctx.strokeStyle = i % 2 === 0
          ? `rgba(38, 18, 9, ${alpha})`
          : `rgba(145, 95, 55, ${alpha * 0.75})`;

        ctx.beginPath();
        ctx.moveTo(gx, 0);
        const wave = (Math.random() - 0.5) * 6;
        ctx.bezierCurveTo(
          gx + wave, 256,
          gx - wave, 768,
          gx + (Math.random() - 0.5) * 4, 1024
        );
        ctx.stroke();
      }

      // Occasional growth ring / grain knot
      if (p % 3 === 1) {
        const knotY = (p * 270) % 750 + 120;
        const knotX = x0 + plankWidth * 0.5;
        for (let r = 6; r < 48; r += 7) {
          ctx.strokeStyle = `rgba(32, 15, 6, ${0.11 - r * 0.0017})`;
          ctx.beginPath();
          ctx.ellipse(knotX, knotY, r * 0.45, r, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Dark plank seam on right edge
      ctx.fillStyle = 'rgba(20, 10, 5, 0.45)';
      ctx.fillRect(x0 + plankWidth - 2, 0, 2, 1024);
      // Subtle highlight bevel on left edge of adjacent plank
      ctx.fillStyle = 'rgba(175, 125, 80, 0.15)';
      ctx.fillRect(x0, 0, 1.5, 1024);
    }

    // Cross-table sheen gradient (subtle varnish layer)
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, 'rgba(255, 230, 200, 0.03)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.04)');
    grad.addColorStop(1, 'rgba(255, 220, 180, 0.02)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('Procedural wood texture generation failed; falling back to color material.', e);
    }
    return null;
  }
}

/**
 * TableSurface renders:
 * 1. An expansive warm wood tabletop sized from scenario game data (48x48 units, 12x12 tiles)
 *    with warm wood-toned surface, finished dark walnut edge trim, and sturdy wooden legs.
 * 2. A vast floor plane (240x240 units) positioned beneath the table that extends far beyond
 *    the camera view and seamlessly fades into the scene fog (args: ['#0e0a17', 22, 52]),
 *    preventing any visible hard edge or dark void drop in desktop orbit, VR, or future AR.
 */
export const TableSurface: React.FC = () => {
  const { isPresenting, session } = useXR();
  const isAR = session?.environmentBlendMode === 'additive' || session?.environmentBlendMode === 'alpha-blend';

  const [floorTexture, setFloorTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/ui/stone-wall.png',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(24, 24);
        tex.colorSpace = THREE.SRGBColorSpace;
        setFloorTexture(tex);
      },
      undefined,
      () => {
        // Fall back to pure procedural dark slate material
      }
    );
  }, []);

  const woodTexture = useMemo(() => createProceduralWoodTexture(), []);

  // Floor plane beneath the tabletop extending into scene fog (fog near 22, far 52)
  const floorPlane = (
    <mesh
      receiveShadow
      position={[0, -TABLE_THICKNESS - 0.01, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[FLOOR_PLANE_SIZE, FLOOR_PLANE_SIZE]} />
      {isAR ? (
        <shadowMaterial opacity={0.3} />
      ) : (
        <meshStandardMaterial
          map={floorTexture ?? undefined}
          color={floorTexture ? '#3c3546' : '#110e18'}
          roughness={0.92}
          metalness={0.05}
        />
      )}
    </mesh>
  );

  // In WebXR presentation mode, artificial table slabs are disabled to allow passthrough
  // and tabletop alignment with real physical surfaces (see AGENTS.md), while the floor plane
  // remains active to prevent any bottomless void drops.
  if (isPresenting) {
    return floorPlane;
  }

  const innerPlayingFieldSize = TABLE_SIZE - 2 * TRIM_WIDTH;

  return (
    <group position={[0, -TABLE_THICKNESS / 2, 0]}>
      {/* ========================================================
          1. EXTENDED GROUND FLOOR PLANE (fades seamlessly into fog)
          ======================================================== */}
      {floorPlane}

      {/* ========================================================
          2. MAIN TABLETOP WOOD SLAB (Solid Hardwood Apron)
          ======================================================== */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[TABLE_SIZE, TABLE_THICKNESS, TABLE_SIZE]} />
        <meshStandardMaterial
          color="#3e2314"
          roughness={0.62}
          metalness={0.04}
        />
      </mesh>

      {/* ========================================================
          3. WARM WOOD-TONED TOP PLAYING SURFACE
          ======================================================== */}
      <mesh receiveShadow position={[0, TABLE_THICKNESS / 2 + 0.005, 0]}>
        <planeGeometry args={[innerPlayingFieldSize, innerPlayingFieldSize]} />
        <meshStandardMaterial
          map={woodTexture ?? undefined}
          color={woodTexture ? '#8c5a3a' : '#684026'}
          roughness={0.56}
          metalness={0.04}
        />
      </mesh>

      {/* ========================================================
          4. FINISHED HARDWOOD EDGE TRIM & MOULDING
          ======================================================== */}
      {/* North & South border rails */}
      {[-HALF + TRIM_WIDTH / 2, HALF - TRIM_WIDTH / 2].map((z, idx) => (
        <mesh
          key={`trim-ns-${idx}`}
          position={[0, TABLE_THICKNESS / 2 + TRIM_HEIGHT / 2, z]}
          receiveShadow
        >
          <boxGeometry args={[TABLE_SIZE, TRIM_HEIGHT, TRIM_WIDTH]} />
          <meshStandardMaterial
            color="#361a0d"
            roughness={0.42}
            metalness={0.06}
          />
        </mesh>
      ))}

      {/* East & West border rails */}
      {[-HALF + TRIM_WIDTH / 2, HALF - TRIM_WIDTH / 2].map((x, idx) => (
        <mesh
          key={`trim-ew-${idx}`}
          position={[x, TABLE_THICKNESS / 2 + TRIM_HEIGHT / 2, 0]}
          receiveShadow
        >
          <boxGeometry args={[TRIM_WIDTH, TRIM_HEIGHT, TABLE_SIZE - 2 * TRIM_WIDTH]} />
          <meshStandardMaterial
            color="#361a0d"
            roughness={0.42}
            metalness={0.06}
          />
        </mesh>
      ))}

      {/* Finished corner blocks */}
      {[-1, 1].map((dirX) =>
        [-1, 1].map((dirZ) => {
          const cornerX = dirX * (HALF - TRIM_WIDTH / 2);
          const cornerZ = dirZ * (HALF - TRIM_WIDTH / 2);
          return (
            <mesh
              key={`corner-block-${dirX}-${dirZ}`}
              position={[cornerX, TABLE_THICKNESS / 2 + TRIM_HEIGHT / 2 + 0.002, cornerZ]}
              receiveShadow
            >
              <boxGeometry args={[TRIM_WIDTH + 0.02, TRIM_HEIGHT + 0.004, TRIM_WIDTH + 0.02]} />
              <meshStandardMaterial
                color="#2a1308"
                roughness={0.38}
                metalness={0.08}
              />
            </mesh>
          );
        })
      )}

      {/* ========================================================
          5. STURDY HARDWOOD PEDESTAL LEGS
          ======================================================== */}
      {[-1, 1].map((dirX) =>
        [-1, 1].map((dirZ) => {
          const legX = dirX * (HALF - 2.5);
          const legZ = dirZ * (HALF - 2.5);
          return (
            <group
              key={`leg-${dirX}-${dirZ}`}
              position={[legX, -TABLE_THICKNESS / 2 - 0.2, legZ]}
            >
              <mesh castShadow receiveShadow>
                <boxGeometry args={[2.2, 0.45, 2.2]} />
                <meshStandardMaterial
                  color="#2d1508"
                  roughness={0.68}
                  metalness={0.04}
                />
              </mesh>
            </group>
          );
        })
      )}
    </group>
  );
};
