/**
 * Token3D component renders game tokens on tiles (coffins, treasure, traps, etc.)
 */

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { GameToken } from '../../game/types'
import { useGameStore } from '../../store/gameStore'
import { getTokenAsset } from '../../data/tokenMap'

interface Token3DProps {
  token: GameToken
  onSearch?: (tokenId: string) => void
}

export function Token3D({ token, onSearch }: Token3DProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const gameState = useGameStore(state => state.gameState)

  if (!gameState) return null

  // Get token visual asset info from metadata or type
  const tokenAssetId = token.metadata?.tokenId as string || token.type
  const tokenAsset = getTokenAsset(tokenAssetId)

  // Check if this is Strahd's coffin (from metadata)
  const isStrahdsCoffin = token.metadata?.isStrahdsCoffin ?? false

  // Calculate world position from tile coordinates
  const worldX = token.position.x * 4 + token.position.sqX + 0.5
  const worldZ = token.position.z * 4 + token.position.sqZ + 0.5

  // Check if current hero can interact with this token
  const hero = gameState.heroes.find(h => h.id === gameState.currentHeroId)
  const heroOnSameTile = hero &&
    hero.position.x === token.position.x &&
    hero.position.z === token.position.z

  const isInteractable = heroOnSameTile && !token.isSearched && token.isRevealed

  // Animate token hover
  useFrame((state) => {
    if (meshRef.current) {
      if (hovered && isInteractable) {
        meshRef.current.position.y = 0.4 + Math.sin(state.clock.elapsedTime * 3) * 0.05
      } else {
        meshRef.current.position.y = 0.3
      }
    }
  })

  // Handle click to search
  const handleClick = () => {
    if (isInteractable && onSearch) {
      onSearch(token.id)
    }
  }

  // Get color based on token type and state
  const getTokenColor = () => {
    if (!token.isRevealed) return '#4a4a4a' // Hidden
    if (token.isSearched) return '#2a2a2a' // Already searched
    if (isStrahdsCoffin) return '#8b0000' // Strahd's coffin (dark red)
    
    // Color by token type
    switch (token.type) {
      case 'coffin': return '#8b4513' // Brown
      case 'treasure': return '#ffd700' // Gold
      case 'trap': return '#dc143c' // Crimson
      case 'item': return '#4169e1' // Royal blue
      case 'encounter': return '#ff4500' // Orange red
      case 'condition': return '#9370db' // Medium purple
      case 'hp': return '#ff0000' // Red
      case 'healing_surge': return '#00ff00' // Green
      case 'monster': return '#8b0000' // Dark red
      case 'reaction': return '#ffa500' // Orange
      case 'marker': return '#00ffff' // Cyan
      case 'adventure': return '#ff1493' // Deep pink
      case 'misc': return '#808080' // Gray
      default: return '#c9a227' // Default gold
    }
  }

  // Get token geometry based on type
  const getTokenGeometry = () => {
    switch (token.type) {
      case 'coffin':
        return <boxGeometry args={[0.4, 0.15, 0.6]} />
      case 'condition':
      case 'hp':
      case 'healing_surge':
        return <cylinderGeometry args={[0.25, 0.25, 0.05, 16]} />
      case 'marker':
      case 'reaction':
        return <cylinderGeometry args={[0.3, 0.3, 0.08, 8]} />
      default:
        return <boxGeometry args={[0.35, 0.1, 0.35]} />
    }
  }

  // Don't render searched tokens prominently
  if (token.isSearched) {
    return (
      <mesh
        ref={meshRef}
        position={[worldX, 0.1, worldZ]}
      >
        <cylinderGeometry args={[0.2, 0.2, 0.05, 8]} />
        <meshStandardMaterial color="#333" transparent opacity={0.5} />
      </mesh>
    )
  }

  return (
    <group position={[worldX, 0, worldZ]}>
      <mesh
        ref={meshRef}
        position={[0, 0.3, 0]}
        onClick={handleClick}
        onPointerOver={() => {
          setHovered(true)
          document.body.style.cursor = isInteractable ? 'pointer' : 'default'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
      >
        {/* Token geometry based on type */}
        {getTokenGeometry()}
        <meshStandardMaterial
          color={getTokenColor()}
          emissive={hovered && isInteractable ? '#ffffff' : '#000000'}
          emissiveIntensity={hovered && isInteractable ? 0.3 : 0}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Token type indicator on top */}
      {token.isRevealed && (
        <Html position={[0, 0.5, 0]} center distanceFactor={10}>
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontFamily: 'Cinzel, serif'
          }}>
            {isStrahdsCoffin ? '☠️ Strahd' : tokenAsset?.name || token.name || token.type}
          </div>
        </Html>
      )}

      {/* Interaction prompt */}
      {hovered && isInteractable && (
        <Html position={[0, 0.7, 0]} center distanceFactor={10}>
          <div style={{
            background: 'rgba(139, 0, 0, 0.9)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontFamily: 'MedievalSharp, cursive',
            border: '1px solid #gold'
          }}>
            Click to Search
          </div>
        </Html>
      )}
    </group>
  )
}
