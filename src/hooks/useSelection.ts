import { useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { useGameActions } from './useGameActions'
import { Entity, Tile } from '../game/types'

export const useSelection = () => {
  const { raycaster, camera, mouse, scene } = useThree()
  const { 
    selectEntity, 
    hoverTile, 
    selectCard, 
    selectedEntity, 
    selectedCard,
    gameState 
  } = useGameStore()
  const { handleMoveHero, handleAttackMonster } = useGameActions()

  const performRaycast = useCallback(() => {
    raycaster.setFromCamera(mouse, camera)
    
    // We need to find objects within our nested groups
    const intersects = raycaster.intersectObjects(scene.children, true)
    
    for (const intersect of intersects) {
      let current: THREE.Object3D | null = intersect.object
      
      // Traverse up to find a selectable object
      while (current) {
        if (current.userData.entity) {
          return { type: 'entity', data: current.userData.entity as Entity }
        }
        if (current.userData.tile) {
          return { type: 'tile', data: current.userData.tile as Tile }
        }
        current = current.parent
      }
    }
    
    return null;
  }, [raycaster, camera, mouse, scene])

  const handleClick = useCallback(() => {
    const result = performRaycast()
    const isHeroPhase = gameState?.phase === 'hero'
    
    if (result) {
      if (result.type === 'entity') {
        const entity = result.data as Entity
        
        // If a hero is selected and we click a monster, attack it
        if (isHeroPhase && selectedEntity?.type === 'hero' && entity.type === 'monster') {
          handleAttackMonster(entity.id)
        } else {
          selectEntity(entity)
          selectCard(null)
        }
      } else if (result.type === 'tile') {
        const tile = result.data as Tile
        
        // If a hero is selected, move to tile center
        if (isHeroPhase && selectedEntity?.type === 'hero') {
          handleMoveHero({ x: tile.x, z: tile.z, sqX: 1, sqZ: 1 })
        }
      }
    } else {
      selectEntity(null)
    }
  }, [performRaycast, selectEntity, selectCard, selectedEntity, gameState, handleMoveHero, handleAttackMonster])

  const handlePointerMove = useCallback(() => {
    const result = performRaycast()
    
    if (result?.type === 'tile') {
      hoverTile(result.data as Tile)
    } else {
      hoverTile(null)
    }
  }, [performRaycast, hoverTile])

  return {
    handleClick,
    handlePointerMove
  }
}
