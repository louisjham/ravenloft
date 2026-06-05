import React from 'react';
import { usePlane } from '@react-three/cannon';
import * as THREE from 'three';

export const PhysicsGroundPlane: React.FC = () => {
  usePlane(() => ({
    position: [0, 0, 0],
    rotation: [-Math.PI / 2, 0, 0],
    material: { friction: 0.8, restitution: 0.2 },
  }));

  return null;
};
