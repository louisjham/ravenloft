import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Stars, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { useGameStore } from '../../store/gameStore';

/**
 * Main 3D Scene component.
 * Handles lighting, camera, and post-processing.
 */
export const Scene: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const isPaused = useGameStore((state) => state.isPaused);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
      <Canvas
        shadows
        camera={{ position: [10, 10, 10], fov: 45 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost. Attempting recovery...');
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored!');
          });
        }}
      >
        {/* Camera Setup - Slightly offset for isometric feel */}
        {/* PerspectiveCamera is now configured directly on Canvas */}
        <OrbitControls
          makeDefault
          enablePan={true}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={30}
        />

        {/* Lighting - Gothic Atmosphere */}
        <ambientLight intensity={0.2} color="#442266" /> {/* Dim purple ambient */}
        
        {/* "Moonlight" */}
        <directionalLight
          position={[-10, 15, -5]}
          intensity={0.8}
          color="#aaccff"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* Dynamic Scene Content */}
        <Suspense fallback={null}>
          <Environment preset="night" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          {children}

          {/* Post-processing */}
        {/* Post-processing - Restored with stable configuration */}
        <EffectComposer multisampling={0}>
          <Bloom 
            intensity={1.0} 
            luminanceThreshold={0.9} 
            luminanceSmoothing={0.025} 
          />
          <Noise opacity={0.05} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>

          <ContactShadows
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, -0.01, 0]}
            opacity={0.4}
            width={40}
            height={40}
            blur={2}
            far={10}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
