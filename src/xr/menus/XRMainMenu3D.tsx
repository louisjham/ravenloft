import React, { useState, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useXR, Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { playHapticProfile } from '../XRHaptics';
import { DataLoader } from '../../game/dataLoader';

interface MenuButtonProps {
  text: string;
  subtext?: string;
  position: [number, number, number];
  primary?: boolean;
  highlight?: boolean;
  onClick: () => void;
}

const MenuButton3D: React.FC<MenuButtonProps> = ({
  text,
  subtext,
  position,
  primary = false,
  highlight = false,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    playHapticProfile('click');
    onClick();
  };

  const bgColor = hovered
    ? primary
      ? '#7a1c1c'
      : highlight
      ? '#2f5235'
      : '#3d2552'
    : primary
    ? '#481212'
    : highlight
    ? '#1c3620'
    : '#1c1424';

  const borderColor = hovered ? (highlight ? '#88e090' : '#f5dfa3') : highlight ? '#50a060' : '#a08040';

  return (
    <Interactive
      onSelect={handleClick}
      onHover={() => {
        setHovered(true);
        playHapticProfile('hover');
      }}
      onBlur={() => setHovered(false)}
    >
      <group
        position={position}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          playHapticProfile('hover');
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        scale={hovered ? 1.04 : 1.0}
      >
        {/* Button Slate */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.44, 0.075, 0.015]} />
          <meshStandardMaterial color={bgColor} roughness={0.6} metalness={0.2} />
        </mesh>

        {/* Ornate Border Frame */}
        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[0.425, 0.062, 0.002]} />
          <meshBasicMaterial color={borderColor} wireframe />
        </mesh>

        {/* Button Text */}
        <Text
          position={[0, subtext ? 0.012 : 0, 0.012]}
          fontSize={0.024}
          color={hovered ? '#ffffff' : highlight ? '#d4f8d8' : '#f0d890'}
          textAlign="center"
        >
          {text}
        </Text>

        {subtext && (
          <Text
            position={[0, -0.018, 0.012]}
            fontSize={0.013}
            color={highlight ? '#90c8a0' : '#a09080'}
            textAlign="center"
          >
            {subtext}
          </Text>
        )}
      </group>
    </Interactive>
  );
};

const textureLoader = new THREE.TextureLoader();

function loadTex(path: string): THREE.Texture {
  const tex = textureLoader.load(path, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * XRMainMenu3D renders the authentic 3D Castle Ravenloft physical game box.
 * Fully textured with the scanned top cover, 4 sliced side panels, and scanned bottom back-cover.
 * When clicked or triggered, the lid swings open to reveal the options menu inside the tray.
 */
export const XRMainMenu3D: React.FC = () => {
  const { isPresenting } = useXR();
  const gameState = useGameStore((state) => state.gameState);
  const isUnboxingMode = useUIStore((state) => state.isUnboxingMode);
  const setIsUnboxingMode = useUIStore((state) => state.setIsUnboxingMode);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const autoSelectPowers = useGameStore((state) => state.autoSelectPowers);
  const beginAdventure = useGameStore((state) => state.beginAdventure);

  const [isOpen, setIsOpen] = useState(false);
  const [boxHovered, setBoxHovered] = useState(false);
  const lidHingeRef = useRef<THREE.Group>(null);

  // Load authentic scanned box textures
  const topTex = useMemo(() => loadTex('/ui/box_art.webp'), []);
  const bottomTex = useMemo(() => loadTex('/ui/box_bottom.webp'), []);
  const northTex = useMemo(() => loadTex('/ui/box_side_north.webp'), []);
  const southTex = useMemo(() => loadTex('/ui/box_side_south.webp'), []);
  const eastTex = useMemo(() => loadTex('/ui/box_side_east.webp'), []);
  const westTex = useMemo(() => loadTex('/ui/box_side_west.webp'), []);

  // Dimensions of the 3D game box
  const BOX_W = 0.52;
  const BOX_D = 0.52;
  const BOX_H = 0.10;
  const LID_H = 0.025;

  // Materials for the 6 faces of the Lid Box: [+X, -X, +Y, -Y, +Z, -Z]
  const lidMaterials = useMemo(() => {
    const eastMat = new THREE.MeshStandardMaterial({ map: eastTex, roughness: 0.45 });
    const westMat = new THREE.MeshStandardMaterial({ map: westTex, roughness: 0.45 });
    const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.35 });
    const innerLidMat = new THREE.MeshStandardMaterial({ color: '#140a18', roughness: 0.85 });
    const southMat = new THREE.MeshStandardMaterial({ map: southTex, roughness: 0.45 });
    const northMat = new THREE.MeshStandardMaterial({ map: northTex, roughness: 0.45 });

    return [eastMat, westMat, topMat, innerLidMat, southMat, northMat];
  }, [eastTex, westTex, topTex, southTex, northTex]);

  // Materials for the 6 faces of the Bottom Tray: [+X, -X, +Y, -Y, +Z, -Z]
  const trayMaterials = useMemo(() => {
    const eastMat = new THREE.MeshStandardMaterial({ map: eastTex, roughness: 0.45 });
    const westMat = new THREE.MeshStandardMaterial({ map: westTex, roughness: 0.45 });
    const innerTrayMat = new THREE.MeshStandardMaterial({ color: '#0e0814', roughness: 0.95 });
    const bottomMat = new THREE.MeshStandardMaterial({ map: bottomTex, roughness: 0.45 });
    const southMat = new THREE.MeshStandardMaterial({ map: southTex, roughness: 0.45 });
    const northMat = new THREE.MeshStandardMaterial({ map: northTex, roughness: 0.45 });

    return [eastMat, westMat, innerTrayMat, bottomMat, southMat, northMat];
  }, [eastTex, westTex, bottomTex, southTex, northTex]);

  // Animate lid opening / closing
  useFrame((_, delta) => {
    if (!lidHingeRef.current) return;
    const targetAngle = isOpen ? -Math.PI * 0.62 : 0; // opens backwards ~112 degrees
    const speed = 1 - Math.pow(0.005, delta);
    lidHingeRef.current.rotation.x = THREE.MathUtils.lerp(
      lidHingeRef.current.rotation.x,
      targetAngle,
      speed
    );
  });

  if (gameState !== null || isUnboxingMode) {
    return null;
  }

  const handleToggleOpen = () => {
    playHapticProfile('click');
    setIsOpen((prev) => !prev);
  };

  const handleBeginAdventure = (scenarioId: string = 'adventure_01') => {
    const dataLoader = DataLoader.getInstance();
    const heroes = dataLoader.getHeroes().map((h) => h.id);
    startNewGame(scenarioId, heroes);
  };

  const handleQuickStart = () => {
    const dataLoader = DataLoader.getInstance();
    const heroes = dataLoader.getHeroes().map((h) => h.id);
    startNewGame('adventure_01', heroes);
    setTimeout(() => {
      const gs = useGameStore.getState().gameState;
      if (gs && gs.heroes) {
        gs.heroes.forEach((h) => autoSelectPowers(h.id));
        beginAdventure();
      }
    }, 150);
  };

  const handleOpenUnboxing = () => {
    playHapticProfile('click');
    setIsUnboxingMode(true);
  };

  return (
    <group position={[0, 0.82, -0.88]} rotation={[-Math.PI / 16, 0, 0]}>
      {/* ================= BOX BOTTOM TRAY ================= */}
      <group position={[0, 0, 0]}>
        {/* Tray Outer Walls with scanned bottom and side textures */}
        <mesh position={[0, 0, 0]} material={trayMaterials} receiveShadow castShadow>
          <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
        </mesh>

        {/* Tray Gold Rim */}
        <mesh position={[0, BOX_H / 2 + 0.001, 0]}>
          <boxGeometry args={[BOX_W + 0.002, 0.002, BOX_D + 0.002]} />
          <meshBasicMaterial color="#a08040" wireframe />
        </mesh>
      </group>

      {/* ================= HINGED BOX LID ================= */}
      {/* Pivot point positioned at the back top edge of the box */}
      <group ref={lidHingeRef} position={[0, BOX_H / 2, -BOX_D / 2]}>
        <Interactive
          onSelect={handleToggleOpen}
          onHover={() => {
            setBoxHovered(true);
            playHapticProfile('hover');
          }}
          onBlur={() => setBoxHovered(false)}
        >
          <group
            position={[0, LID_H / 2, BOX_D / 2]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setBoxHovered(true);
              playHapticProfile('hover');
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setBoxHovered(false);
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleOpen();
            }}
          >
            {/* Lid Mesh with 6 scanned face materials */}
            <mesh material={lidMaterials} castShadow receiveShadow>
              <boxGeometry args={[BOX_W + 0.008, LID_H, BOX_D + 0.008]} />
            </mesh>

            {/* Lid Lip Trim */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[BOX_W + 0.012, LID_H + 0.002, BOX_D + 0.012]} />
              <meshBasicMaterial color={boxHovered && !isOpen ? '#f5dfa3' : '#a08040'} wireframe />
            </mesh>

            {/* "CLICK TO OPEN" Hint Banner when closed */}
            {!isOpen && (
              <group position={[0, LID_H / 2 + 0.04, 0]} rotation={[-Math.PI / 8, 0, 0]}>
                <mesh position={[0, 0, -0.002]}>
                  <planeGeometry args={[0.36, 0.05]} />
                  <meshBasicMaterial color="#0c0714" transparent opacity={0.85} />
                </mesh>
                <mesh position={[0, 0, -0.001]}>
                  <planeGeometry args={[0.355, 0.045]} />
                  <meshBasicMaterial color="#f0d070" wireframe />
                </mesh>
                <Text fontSize={0.022} color="#f5dfa3" textAlign="center">
                  TAP / CLICK TO OPEN BOX
                </Text>
              </group>
            )}
          </group>
        </Interactive>
      </group>

      {/* ================= INTERIOR TRAY OPTIONS MENU ================= */}
      {/* Visible and interactive when the box lid is opened */}
      {isOpen && (
        <group position={[0, BOX_H / 2 + 0.015, 0]} rotation={[-Math.PI / 4.5, 0, 0]}>
          {/* Header Title Crest inside the box */}
          <group position={[0, 0.16, 0]}>
            <Text fontSize={0.042} color="#f5dfa3" textAlign="center" position={[0, 0.01, 0]}>
              CASTLE RAVENLOFT
            </Text>
            <Text fontSize={0.016} color="#a89070" textAlign="center" letterSpacing={0.08} position={[0, -0.022, 0]}>
              DUNGEONS & DRAGONS ADVENTURE SYSTEM
            </Text>
            <mesh position={[0, -0.038, 0]}>
              <planeGeometry args={[0.38, 0.002]} />
              <meshBasicMaterial color="#a08040" />
            </mesh>
          </group>

          {/* Action Menu Buttons */}
          <group position={[0, 0.02, 0]}>
            <MenuButton3D
              text="BEGIN ADVENTURE"
              subtext="Scenario I: Escape the Tomb"
              position={[0, 0.065, 0]}
              primary={true}
              onClick={() => handleBeginAdventure('adventure_01')}
            />

            <MenuButton3D
              text="UNBOXING SHOWCASE"
              subtext="Examine 3D Figures, Cards & Tokens"
              position={[0, -0.025, 0]}
              highlight={true}
              onClick={handleOpenUnboxing}
            />

            <MenuButton3D
              text="QUICK START (AUTO-PARTY)"
              subtext="Standard Rulebook Decks & Embark"
              position={[0, -0.115, 0]}
              onClick={handleQuickStart}
            />

            <MenuButton3D
              text="SCENARIO II: SEARCH FOR CLUES"
              subtext="Advanced Crypt Exploration"
              position={[0, -0.205, 0]}
              onClick={() => handleBeginAdventure('adventure_02')}
            />
          </group>

          {/* Close Lid Button */}
          <Interactive onSelect={handleToggleOpen}>
            <group
              position={[0, -0.27, 0]}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleOpen();
              }}
            >
              <Text fontSize={0.015} color="#807090" textAlign="center">
                [CLOSE BOX LID]
              </Text>
            </group>
          </Interactive>
        </group>
      )}
    </group>
  );
};

export default XRMainMenu3D;
