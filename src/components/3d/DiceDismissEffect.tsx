import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDiceStore } from '../../store/diceStore';

export const DiceDismissEffect: React.FC = () => {
  const effectType = useDiceStore(s => s.dismissEffect);
  
  // Choose colors/shapes based on effectType
  const config = useMemo(() => {
    switch(effectType) {
      case 'fire': return { color: '#ff4400', count: 40, size: 0.15, speed: 2 };
      case 'lightning': return { color: '#00ffff', count: 30, size: 0.2, speed: 4, shape: 'spark' };
      case 'bones': return { color: '#eeeeee', count: 20, size: 0.25, speed: 1.5, shape: 'box' };
      case 'arcane': return { color: '#ff00ff', count: 50, size: 0.1, speed: 1, glow: true };
      case 'toxic': return { color: '#00ff00', count: 35, size: 0.2, speed: 1.2 };
      case 'shadow': return { color: '#220033', count: 45, size: 0.3, speed: 0.8 };
      case 'divine': return { color: '#ffffaa', count: 60, size: 0.08, speed: 3, glow: true };
      default: return { color: '#ffffff', count: 30, size: 0.1, speed: 2 };
    }
  }, [effectType]);

  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < config.count; i++) {
      arr.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 5 + 2, // mostly upwards scoop
          (Math.random() - 0.5) * 3
        ).multiplyScalar(config.speed),
        rotation: new THREE.Euler(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI),
        rotSpeed: new THREE.Euler(Math.random(), Math.random(), Math.random()),
        scale: Math.random() * 0.5 + 0.5
      });
    }
    return arr;
  }, [config]);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: config.color,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending
  }), [config.color]);

  const geometry = useMemo(() => {
    if ((config as any).shape === 'box') return new THREE.BoxGeometry(config.size, config.size, config.size);
    if ((config as any).shape === 'spark') return new THREE.ConeGeometry(config.size*0.3, config.size*2, 3);
    return new THREE.SphereGeometry(config.size, 8, 8);
  }, [config]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Fade out material
    if (material.opacity > 0) {
      material.opacity -= delta * 1.5;
    }

    // Animate children
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      if (!p) return;
      
      // Move
      child.position.addScaledVector(p.velocity, delta);
      // Gravity
      p.velocity.y -= delta * 5; 
      // Spin
      child.rotation.x += p.rotSpeed.x * delta;
      child.rotation.y += p.rotSpeed.y * delta;
      child.rotation.z += p.rotSpeed.z * delta;
      // Shrink
      if (child.scale.x > 0) {
        const shrink = Math.max(0, child.scale.x - delta * 2);
        child.scale.set(shrink, shrink, shrink);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh 
          key={i}
          geometry={geometry}
          material={material}
          position={p.position}
          rotation={p.rotation}
          scale={[p.scale, p.scale, p.scale]}
        />
      ))}
    </group>
  );
};
