/**
 * Performance optimization utilities for Castle Ravenloft 3D.
 * Implements FPS counting, entity pooling, and LOD management.
 */

import { useState, useEffect } from 'react';

// FPS Counter Hook
export const useFPSCounter = (enabled: boolean) => {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let requestId: number;

    const loop = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      requestId = requestAnimationFrame(loop);
    };

    requestId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestId);
  }, [enabled]);

  return fps;
};

// Entity Pool Manager
class EntityPool<T> {
  private pool: T[] = [];
  private factory: () => T;

  constructor(factory: () => T, initialSize: number = 0) {
    this.factory = factory;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire(): T {
    return this.pool.pop() || this.factory();
  }

  release(entity: T): void {
    this.pool.push(entity);
  }
}

// Global monster pool to prevent GC spikes
export const monsterPool = new EntityPool<any>(() => ({
  id: '',
  type: '',
  hp: 0,
  position: { x: 0, z: 0, sqX: 0, sqZ: 0 }
}), 10);

// LOD Switching Logic
export const calculateLOD = (distance: number): number => {
  if (distance < 5) return 0; // High detail
  if (distance < 15) return 1; // Medium detail
  return 2; // Low detail
};

// Texture Streaming helper
export const getTexturePath = (basePath: string, quality: 'low' | 'med' | 'high') => {
  const suffix = quality === 'high' ? '' : `_${quality}`;
  return `${basePath}${suffix}.webp`;
};
