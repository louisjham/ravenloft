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
  const graphicsQuality = useGameStore((state) => state.settings?.graphicsQuality ?? 'high');
  const resolutionScale = useGameStore((state) => state.settings?.resolutionScale ?? 1.0);

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
