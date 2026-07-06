import React, { Suspense, useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Vignette, Outline, Selection } from '@react-three/postprocessing';
import { Color } from 'three';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import * as THREE from 'three';

/**
 * AtmosphericMist renders a set of slow-drifting, waving gothic mist motes.
 * Uses a single buffer geometry points drawing call for high performance.
 */
const AtmosphericMist: React.FC = () => {
  const count = 80; // modest count for performance
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      // Spread particles across board coordinates (from -12 to 24 units)
      pos[i * 3] = (Math.random() - 0.3) * 36;
      pos[i * 3 + 1] = Math.random() * 2.5 + 0.2; // height above the board (0.2 to 2.7 units)
      pos[i * 3 + 2] = (Math.random() - 0.3) * 36;

      // Slow ambient drift velocity
      vel.push({
        x: (Math.random() - 0.5) * 0.15,
        y: (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.15
      });
    }
    return [pos, vel];
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    if (!posAttr) return;

    const time = state.clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      let x = posAttr.getX(i) + velocities[i].x * delta;
      let y = posAttr.getY(i) + velocities[i].y * delta;
      let z = posAttr.getZ(i) + velocities[i].z * delta;

      // Vertical wave bobbing
      y += Math.sin(time * 0.5 + i) * 0.0015;

      // Boundary check & wrap-around
      if (Math.abs(x) > 18) x = -x;
      if (y < 0.1 || y > 3.0) velocities[i].y = -velocities[i].y;
      if (Math.abs(z) > 18) z = -z;

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#c8a2c8" // lilac / gothic purple tint
        size={0.12} // tiny dust motes
        transparent
        opacity={0.25} // extremely subtle to preserve tactical grid/arrows/highlights
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

/**
 * CameraTracker component to smoothly interpolate the camera controls focus target
 * toward the active hero's world coordinates.
 */
const CameraTracker: React.FC<{ controlsRef: React.RefObject<any> }> = ({ controlsRef }) => {
  const activeHeroPos = useGameStore((state) => {
    const gs = state.gameState;
    if (!gs) return null;
    const hero = gs.heroes.find(h => h.id === gs.currentHeroId);
    return hero ? hero.position : null;
  });

  useFrame((_, delta) => {
    if (!activeHeroPos || !controlsRef.current) return;
    const controls = controlsRef.current;
    
    // Entity world coordinates formula: worldX = tile.x * 4 + sqX + 0.5
    const targetX = activeHeroPos.x * 4 + activeHeroPos.sqX + 0.5;
    const targetZ = activeHeroPos.z * 4 + activeHeroPos.sqZ + 0.5;

    // Smooth lerp tracking
    const speed = Math.min(5 * delta, 1);
    controls.target.x += (targetX - controls.target.x) * speed;
    controls.target.z += (targetZ - controls.target.z) * speed;
    controls.update();
  });

  return null;
};

/**
 * Main 3D Scene component.
 * Handles lighting, camera, tracking, mist, and post-processing.
 */
export const Scene: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const isPaused = useGameStore((state) => state.isPaused);
  const interactionMode = useUIStore((state) => state.interactionMode);
  const graphicsQuality = useGameStore((state) => state.settings?.graphicsQuality ?? 'high');
  const resolutionScale = useGameStore((state) => state.settings?.resolutionScale ?? 1.0);

  const controlsRef = useRef<any>(null);

  let outlineColorStr = '#00aaff'; // default / move (BLUE)
  if (interactionMode === 'attack') outlineColorStr = '#ff3333'; // RED
  if (interactionMode === 'ability') outlineColorStr = '#ffbb00'; // GOLD

  const outlineThreeColor = useMemo(() => new Color(outlineColorStr), [outlineColorStr]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
      <Canvas
        frameloop={isPaused ? 'never' : 'always'}
        shadows={graphicsQuality === 'high'}
        camera={{ position: [5.5, 5.5, 5.5], fov: 38 }}
        dpr={resolutionScale}
        gl={{
          antialias: graphicsQuality !== 'low',
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false
        }}
        onCreated={({ gl }) => {
          console.log('Max texture units:', gl.capabilities.maxTextures);
          const onLost = (e: Event) => {
            e.preventDefault();
            console.warn('WebGL context lost. Attempting recovery...');
          };
          const onRestored = () => {
            console.log('WebGL context restored!');
          };
          gl.domElement.addEventListener('webglcontextlost', onLost);
          gl.domElement.addEventListener('webglcontextrestored', onRestored);
        }}
      >
        {/* Camera Setup — locked isometric view but closer */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableZoom={true}
          /* Vertical: ~35° to ~60° from top — never below the table */
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 3}
          /* Horizontal: narrow ±20° so the board feels locked */
          minAzimuthAngle={-Math.PI / 9}
          maxAzimuthAngle={Math.PI / 9}
          minDistance={5}
          maxDistance={13}
          enableDamping={true}
          dampingFactor={0.15}
          rotateSpeed={0.3}
        />

        {/* Smooth camera target tracking */}
        <CameraTracker controlsRef={controlsRef} />

        {/* Lighting - Gothic Atmosphere (Brighter & More Vivid) */}
        <ambientLight intensity={0.65} color="#8855aa" />
        
        {/* "Moonlight" (Brighter) */}
        <directionalLight
          position={[-10, 15, -5]}
          intensity={1.5}
          color="#cceeff"
          castShadow={graphicsQuality === 'high'}
          shadow-mapSize={graphicsQuality === 'high' ? [512, 512] : [256, 256]}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />

        {/* Fill light from opposite side (Brighter) */}
        <directionalLight
          position={[8, 5, 8]}
          intensity={0.4}
          color="#8866aa"
          castShadow={false}
        />

        {/* Atmosphere */}
        <fog attach="fog" args={['#1a0f2e', 20, 38]} />

        <Suspense fallback={null}>
          <Stars radius={100} depth={50} count={500} factor={4} saturation={0} fade speed={1} />
        </Suspense>

        {/* Gothic Atmospheric Mist Motes */}
        {graphicsQuality !== 'low' && (
          <Suspense fallback={null}>
            <AtmosphericMist />
          </Suspense>
        )}
          
        <Selection>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </Selection>

        {/* Post-processing */}
        {graphicsQuality !== 'low' ? (
          <EffectComposer multisampling={graphicsQuality === 'high' ? 4 : 0} autoClear={false}>
            {graphicsQuality === 'high' ? (
              <Outline 
                visibleEdgeColor={outlineThreeColor as any}
                hiddenEdgeColor={outlineThreeColor as any}
                blur
                edgeStrength={10} 
                width={1000} 
              />
            ) : <></>}
            <Vignette eskil={false} offset={0.1} darkness={0.9} />
          </EffectComposer>
        ) : null}
      </Canvas>
    </div>
  );
};
