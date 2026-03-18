import React, { useEffect } from 'react'
import { useSelection } from '../../hooks/useSelection'
import { useKeyboard } from '../../hooks/useKeyboard'
import { useThree } from '@react-three/fiber'

/**
 * GameController is a non-rendering component that manages 
 * user input and dispatches to the game engine/store.
 * It should be placed inside the Canvas to have access to Three.js context.
 */
export const GameController: React.FC = () => {
  // Initialize keyboard listeners
  useKeyboard();

  // Get selection helpers
  const { handleClick, handlePointerMove } = useSelection();
  const { gl } = useThree();

  useEffect(() => {
    const handleDown = () => handleClick();
    const handleMove = () => handlePointerMove();

    gl.domElement.addEventListener('pointerdown', handleDown);
    gl.domElement.addEventListener('pointermove', handleMove);

    return () => {
      gl.domElement.removeEventListener('pointerdown', handleDown);
      gl.domElement.removeEventListener('pointermove', handleMove);
    };
  }, [gl, handleClick, handlePointerMove]);

  return null;
}
