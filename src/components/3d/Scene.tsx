import React, { Suspense, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Vignette, Outline, Selection } from '@react-three/postprocessing';
import { Color } from 'three';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

/**
 * Main 3D Scene component.
 * Handles lighting, camera, and post-processing.
 */
export const Scene: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const isPaused = useGameStore((state) => state.isPaused);
  const interactionMode = useUIStore((state) => state.interactionMode);

  let outlineColorStr = '#00aaff'; // default / move (BLUE)
  if (interactionMode === 'attack') outlineColorStr = '#ff3333'; // RED
  if (interactionMode === 'ability') outlineColorStr = '#ffbb00'; // GOLD

  const outlineThreeColor = useMemo(() => new Color(outlineColorStr), [outlineColorStr]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
      <Canvas
        frameloop={isPaused ? 'never' : 'always'}
        shadows
        camera={{ position: [10, 10, 10], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
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
        {/* Camera Setup — locked isometric view */}
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={true}
          /* Vertical: ~35° to ~60° from top — never below the table */
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 3}
          /* Horizontal: narrow ±20° so the board feels locked */
          minAzimuthAngle={-Math.PI / 9}
          maxAzimuthAngle={Math.PI / 9}
          minDistance={12}
          maxDistance={22}
          enableDamping={true}
          dampingFactor={0.15}
          rotateSpeed={0.3}
        />

        {/* Lighting - Gothic Atmosphere */}
        <ambientLight intensity={0.35} color="#442266" />
        
        {/* "Moonlight" */}
        <directionalLight
          position={[-10, 15, -5]}
          intensity={0.8}
          color="#aaccff"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />

        {/* Fill light from opposite side */}
        <directionalLight
          position={[8, 5, 8]}
          intensity={0.2}
          color="#664488"
          castShadow={false}
        />

        {/* Atmosphere */}
        <fog attach="fog" args={['#1a0f2e', 25, 45]} />

        <Suspense fallback={null}>
          <Stars radius={100} depth={50} count={1500} factor={4} saturation={0} fade speed={1} />
        </Suspense>
          
        <Selection>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </Selection>

        {/* Post-processing */}
        <EffectComposer multisampling={4} autoClear={false}>
          <Outline 
            visibleEdgeColor={outlineThreeColor as any}
            hiddenEdgeColor={outlineThreeColor as any}
            blur
            edgeStrength={10} 
            width={1000} 
          />
          <Vignette eskil={false} offset={0.1} darkness={0.9} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
