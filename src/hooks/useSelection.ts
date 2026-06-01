import { useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { useUIStore } from '../store/uiStore'
import { useGameActions } from './useGameActions'
import { Entity, Tile } from '../game/types'

export const useSelection = () => {
  const { raycaster, camera, mouse, scene } = useThree()
  const { 
    selectEntity, 
    selectCard, 
    hoverTile,
    gameState,
    isPaused
  } = useGameStore()
  const { interactionMode, setInteractionMode } = useUIStore()
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
          return { type: 'entity', data: current.userData.entity as any, point: intersect.point }
        }
        if (current.userData.tile) {
          return { type: 'tile', data: current.userData.tile as Tile, point: intersect.point }
        }
        current = current.parent
      }
    }

    return null
  }, [camera, mouse, scene, raycaster])

  const handleClick = useCallback(() => {
    if (isPaused) return

    const result = performRaycast()
    const isHeroPhase = gameState?.phase === 'hero'

    if (result) {
      if (result.type === 'entity') {
        const entity = result.data as any

        // Mode-based interactions
        if (isHeroPhase) {
          if (interactionMode === 'attack' && entity.type === 'monster') {
            handleAttackMonster(entity.id)
            setInteractionMode('none')
            return
          }
        }
        // Selection fallback
        selectEntity(entity)
        selectCard(null)
      } else if (result.type === 'tile') {
        const tile = result.data as Tile
        const point = result.point

        // Calculate the specific square (0-3) within the 4x4 tile
        const sqX = Math.floor(point.x - tile.x * 4)
        const sqZ = Math.floor(point.z - tile.z * 4)

        // Ensure within bounds 0-3
        const targetSqX = Math.max(0, Math.min(3, sqX))
        const targetSqZ = Math.max(0, Math.min(3, sqZ))

        console.log(`[useSelection] Clicked Tile: ${tile.id} at (${tile.x}, ${tile.z}), local sq: (${targetSqX}, ${targetSqZ})`)

        if (isHeroPhase && interactionMode === 'move') {
          handleMoveHero({ x: tile.x, z: tile.z, sqX: targetSqX, sqZ: targetSqZ })
          setInteractionMode('none')
        }
      }
    } else {
      selectEntity(null)
    }
  }, [performRaycast, isPaused, selectEntity, selectCard, gameState, interactionMode, handleMoveHero, handleAttackMonster, setInteractionMode])

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
