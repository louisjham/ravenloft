import React, { useMemo } from 'react';
import { useXR, Interactive } from '@react-three/xr';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { DataLoader } from '../../game/dataLoader';
import { PhysicalCard3D } from '../cards/PhysicalCard3D';
import { PhysicalToken3D } from './PhysicalToken3D';
import { PhysicalTile3D } from './PhysicalTile3D';
import { GrabbablePiece3D } from './GrabbablePiece3D';
import { GrabbableBox3D } from './GrabbableBox3D';
import { playHapticProfile } from '../XRHaptics';

export const XRUnboxingStage3D: React.FC = () => {
  const isUnboxingMode = useUIStore((state) => state.isUnboxingMode);
  const setIsUnboxingMode = useUIStore((state) => state.setIsUnboxingMode);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const { isPresenting } = useXR();

  const dataLoader = useMemo(() => DataLoader.getInstance(), []);
  const allCards = useMemo(() => dataLoader.getAllCards(), [dataLoader]);

  // Sample cards of various types to display
  const sampleCards = useMemo(() => {
    const powerCards = allCards.filter((c) => c.powerType).slice(0, 8);
    const encounterCards = allCards.filter((c) => c.type === 'encounter' || c.encounterType).slice(0, 6);
    const treasureCards = allCards.filter((c) => c.type === 'treasure' || c.treasureType).slice(0, 6);
    return { powerCards, encounterCards, treasureCards };
  }, [allCards]);

  if (!isUnboxingMode) {
    return null;
  }

  const handleReturnToMenu = () => {
    playHapticProfile('click');
    setIsUnboxingMode(false);
  };

  const handleStartGame = () => {
    playHapticProfile('click');
    setIsUnboxingMode(false);
    const heroes = dataLoader.getHeroes().map((h) => h.id);
    startNewGame('adventure_01', heroes);
  };

  return (
    <group position={[0, 0, -0.95]}>
      {/* ================= GRAND SHOWCASE TABLE ================= */}
      <group position={[0, 0.70, 0]}>
        {/* Table Top Surface (Dark Mahogany Wood with Velvet Inlay) */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[2.5, 0.05, 1.4]} />
          <meshStandardMaterial color="#1a120e" roughness={0.7} metalness={0.1} />
        </mesh>

        {/* Velvet Inlay Pad */}
        <mesh position={[0, 0.026, 0]} receiveShadow>
          <boxGeometry args={[2.42, 0.002, 1.32]} />
          <meshStandardMaterial color="#140a18" roughness={0.9} metalness={0.05} />
        </mesh>

        {/* Gold Border Trim */}
        <mesh position={[0, 0.027, 0]}>
          <boxGeometry args={[2.43, 0.001, 1.33]} />
          <meshBasicMaterial color="#a08040" wireframe />
        </mesh>
      </group>

      {/* ================= TITLE & BANNER ================= */}
      <group position={[0, 1.55, -0.65]} rotation={[-Math.PI / 16, 0, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.6, 0.22]} />
          <meshBasicMaterial color="#0c0812" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[1.58, 0.20]} />
          <meshBasicMaterial color="#c5a059" wireframe />
        </mesh>
        <Text position={[0, 0.04, 0]} fontSize={0.065} color="#f5dfa3" textAlign="center">
          CASTLE RAVENLOFT UNBOXING
        </Text>
        <Text position={[0, -0.04, 0]} fontSize={0.022} color="#a89070" textAlign="center" letterSpacing={0.05}>
          Squeeze controller Grip to pick up & inspect cards, tokens, tiles and figures in 6DoF
        </Text>
      </group>

      {/* ================= HEROES DISPLAY (Back-Left) ================= */}
      <group position={[-0.82, 0.73, -0.32]}>
        {/* Section Label */}
        <Text position={[0, 0.25, 0]} fontSize={0.026} color="#e0c080" textAlign="center">
          HEROES OF THE REALM
        </Text>

        {/* 5 Heroes Standing */}
        <GrabbablePiece3D
          modelUrl="/models/arjhan.glb"
          label="Arjhan"
          sublabel="Dragonborn Fighter"
          position={[-0.28, 0, 0]}
          scale={0.42}
          baseColor="#1c2538"
          emissiveColor="#203050"
        />
        <GrabbablePiece3D
          modelUrl="/models/kat.glb"
          label="Kat"
          sublabel="Human Rogue"
          position={[-0.14, 0, 0]}
          scale={0.42}
          baseColor="#2a1f18"
          emissiveColor="#403020"
        />
        <GrabbablePiece3D
          modelUrl="/models/thorgrim.glb"
          label="Thorgrim"
          sublabel="Dwarf Cleric"
          position={[0, 0, 0]}
          scale={0.42}
          baseColor="#222818"
          emissiveColor="#354020"
        />
        <GrabbablePiece3D
          modelUrl="/models/immeril.glb"
          label="Immeril"
          sublabel="Elf Wizard"
          position={[0.14, 0, 0]}
          scale={0.42}
          baseColor="#25182d"
          emissiveColor="#3d204a"
        />
        <GrabbablePiece3D
          modelUrl="/models/alissa.glb"
          label="Alissa"
          sublabel="Human Ranger"
          position={[0.28, 0, 0]}
          scale={0.42}
          baseColor="#1a2820"
          emissiveColor="#204030"
        />
      </group>

      {/* ================= PHYSICAL GAME BOX DISPLAY (Back-Center) ================= */}
      <group position={[0, 0.73, -0.32]}>
        <Text position={[0, 0.25, 0]} fontSize={0.024} color="#f5dfa3" textAlign="center">
          ORIGINAL GAME BOX
        </Text>
        <GrabbableBox3D position={[0, 0, 0]} scale={0.7} />
      </group>

      {/* ================= VILLAINS & MONSTERS (Back-Right) ================= */}
      <group position={[0.72, 0.73, -0.32]}>
        <Text position={[0, 0.25, 0]} fontSize={0.026} color="#e07070" textAlign="center">
          VILLAINS & MONSTERS
        </Text>

        <GrabbablePiece3D
          modelUrl="/models/strahd.glb"
          label="Count Strahd"
          sublabel="Master of Ravenloft"
          position={[-0.42, 0, 0]}
          scale={0.5}
          baseColor="#421218"
          emissiveColor="#581520"
        />
        <GrabbablePiece3D
          modelUrl="/models/dracolich.glb"
          label="Dracolich"
          sublabel="Gargantuan Undead Dragon"
          position={[-0.24, 0, 0]}
          scale={0.35}
          baseColor="#321235"
          emissiveColor="#451850"
        />
        <GrabbablePiece3D
          modelUrl="/models/flesh_golem.glb"
          label="Flesh Golem"
          sublabel="Construct Monstrosity"
          position={[-0.08, 0, 0]}
          scale={0.45}
          baseColor="#2b2015"
          emissiveColor="#38281a"
        />
        <GrabbablePiece3D
          modelUrl="/models/gargoyle.glb"
          label="Gargoyle"
          sublabel="Stone Predator"
          position={[0.08, 0, 0]}
          scale={0.42}
          baseColor="#202025"
          emissiveColor="#303038"
        />
        <GrabbablePiece3D
          modelUrl="/models/skeletonarcher.glb"
          label="Skeleton Archer"
          sublabel="Undead Marksman"
          position={[0.24, 0, 0]}
          scale={0.42}
          baseColor="#252018"
          emissiveColor="#353020"
        />
        <GrabbablePiece3D
          modelUrl="/models/zombie.glb"
          label="Zombie"
          sublabel="Ravenous Undead"
          position={[0.40, 0, 0]}
          scale={0.42}
          baseColor="#1d281a"
          emissiveColor="#243820"
        />
      </group>

      {/* ================= AUTHENTIC CARDS SHOWCASE (Front-Left) ================= */}
      <group position={[-0.65, 0.74, 0.08]}>
        <Text position={[0, 0.05, -0.18]} fontSize={0.022} color="#f5dfa3" textAlign="center">
          AUTHENTIC RULEBOOK CARDS (SCANS & POWERS)
        </Text>

        {/* Hero Power Cards Row */}
        {sampleCards.powerCards.slice(0, 4).map((card, i) => (
          <PhysicalCard3D
            key={`p-${card.id}-${i}`}
            card={card}
            position={[-0.30 + i * 0.20, 0.02, -0.06]}
            rotation={[-Math.PI / 2.3, 0, 0]}
            scale={0.85}
          />
        ))}

        {/* Encounter & Treasure Cards Row */}
        {sampleCards.encounterCards.slice(0, 2).map((card, i) => (
          <PhysicalCard3D
            key={`e-${card.id}-${i}`}
            card={card}
            position={[-0.30 + i * 0.20, 0.02, 0.16]}
            rotation={[-Math.PI / 2.3, 0, 0]}
            scale={0.85}
          />
        ))}
        {sampleCards.treasureCards.slice(0, 2).map((card, i) => (
          <PhysicalCard3D
            key={`t-${card.id}-${i}`}
            card={card}
            position={[0.10 + i * 0.20, 0.02, 0.16]}
            rotation={[-Math.PI / 2.3, 0, 0]}
            scale={0.85}
          />
        ))}
      </group>

      {/* ================= TOKEN COLLECTION TRAY (Front-Center) ================= */}
      <group position={[0.15, 0.74, 0.12]}>
        <Text position={[0, 0.04, -0.22]} fontSize={0.022} color="#f5dfa3" textAlign="center">
          DOUBLE-SIDED CARDBOARD TOKENS
        </Text>

        {/* HP & Healing Surge Tokens */}
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_HP1.png"
          backTextureUrl="/assets/tokens/Token_Misc_HP1Back.png"
          label="1 Hit Point"
          position={[-0.20, 0.01, -0.12]}
          radius={0.026}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_HP5.png"
          backTextureUrl="/assets/tokens/Token_Misc_HP5Back.png"
          label="5 Hit Points"
          position={[-0.12, 0.01, -0.12]}
          radius={0.032}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_HealingSurge.png"
          backTextureUrl="/assets/tokens/Token_Misc_HealingSurgeBack.png"
          label="Healing Surge"
          position={[-0.04, 0.01, -0.12]}
          radius={0.034}
        />

        {/* Coffin Mystery Tokens */}
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_CoffinStrahd.png"
          backTextureUrl="/assets/tokens/Token_Misc_CoffinBack.png"
          label="Strahd's Coffin"
          position={[0.06, 0.01, -0.12]}
          radius={0.032}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_CoffinTreasure.png"
          backTextureUrl="/assets/tokens/Token_Misc_CoffinBack.png"
          label="Treasure Coffin"
          position={[0.14, 0.01, -0.12]}
          radius={0.032}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_CoffinMonster.png"
          backTextureUrl="/assets/tokens/Token_Misc_CoffinBack.png"
          label="Monster Coffin"
          position={[0.22, 0.01, -0.12]}
          radius={0.032}
        />

        {/* Traps & Hazards */}
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Encounter_ConsecratedGround.png"
          backTextureUrl="/assets/tokens/Token_EncounterBack.png"
          label="Consecrated Ground"
          position={[-0.20, 0.01, 0.02]}
          radius={0.032}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Encounter_FireTrap.png"
          backTextureUrl="/assets/tokens/Token_EncounterBack.png"
          label="Fire Trap"
          position={[-0.12, 0.01, 0.02]}
          radius={0.030}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Encounter_DartTrap.png"
          backTextureUrl="/assets/tokens/Token_EncounterBack.png"
          label="Dart Trap"
          position={[-0.04, 0.01, 0.02]}
          radius={0.030}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Encounter_FreezingCloud.png"
          backTextureUrl="/assets/tokens/Token_EncounterBack.png"
          label="Freezing Cloud"
          position={[0.06, 0.01, 0.02]}
          radius={0.030}
        />

        {/* Quest Items & Relics */}
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_ItemIconOfRavenloft.png"
          backTextureUrl="/assets/tokens/Token_ItemBack.png"
          label="Icon of Ravenloft"
          position={[-0.16, 0.01, 0.14]}
          radius={0.034}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_ItemSilverDagger.png"
          backTextureUrl="/assets/tokens/Token_ItemBack.png"
          label="Silver Dagger"
          position={[-0.06, 0.01, 0.14]}
          radius={0.030}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_ItemWoodenStake.png"
          backTextureUrl="/assets/tokens/Token_ItemBack.png"
          label="Wooden Stake"
          position={[0.04, 0.01, 0.14]}
          radius={0.030}
        />
        <PhysicalToken3D
          frontTextureUrl="/assets/tokens/Token_Misc_ConditionImmobilized.png"
          backTextureUrl="/assets/tokens/Token_Misc_ConditionBack.png"
          label="Immobilized Condition"
          position={[0.14, 0.01, 0.14]}
          radius={0.028}
        />
      </group>

      {/* ================= DUNGEON TILES EXHIBIT (Front-Right) ================= */}
      <group position={[0.82, 0.74, 0.08]}>
        <Text position={[0, 0.05, -0.18]} fontSize={0.022} color="#f5dfa3" textAlign="center">
          DUNGEON TILES
        </Text>

        <PhysicalTile3D
          textureUrl="/assets/tiles/StartTile.png"
          backTextureUrl="/assets/tiles/StartTileBack.png"
          label="Starting Tile"
          sublabel="Hero Entrance Point"
          position={[-0.14, 0.01, -0.06]}
          scale={0.7}
        />
        <PhysicalTile3D
          textureUrl="/assets/tiles/Crypt_StrahdsCrypt.png"
          label="Strahd's Crypt"
          sublabel="Master's Sarcophagus"
          position={[0.14, 0.01, -0.06]}
          scale={0.7}
        />
        <PhysicalTile3D
          textureUrl="/assets/tiles/Named_Chapel.png"
          label="The Chapel"
          sublabel="Desecrated Sanctuary"
          position={[-0.14, 0.01, 0.16]}
          scale={0.7}
        />
        <PhysicalTile3D
          textureUrl="/assets/tiles/Named_ArcaneCircle.png"
          label="Arcane Circle"
          sublabel="Eldritch Summoning Node"
          position={[0.14, 0.01, 0.16]}
          scale={0.7}
        />
      </group>

      {/* ================= CONTROL BUTTONS ================= */}
      <group position={[0, 0.82, 0.46]} rotation={[-Math.PI / 4, 0, 0]}>
        {/* Return Button */}
        <Interactive onSelect={handleReturnToMenu}>
          <group
            position={[-0.22, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              handleReturnToMenu();
            }}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.38, 0.08, 0.02]} />
              <meshStandardMaterial color="#2d1c3a" roughness={0.6} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.011]}>
              <boxGeometry args={[0.36, 0.065, 0.002]} />
              <meshBasicMaterial color="#a08040" wireframe />
            </mesh>
            <Text position={[0, 0, 0.015]} fontSize={0.026} color="#f5dfa3" textAlign="center">
              ← MAIN MENU
            </Text>
          </group>
        </Interactive>

        {/* Start Game Button */}
        <Interactive onSelect={handleStartGame}>
          <group
            position={[0.22, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              handleStartGame();
            }}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.38, 0.08, 0.02]} />
              <meshStandardMaterial color="#4a1515" roughness={0.6} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.011]}>
              <boxGeometry args={[0.36, 0.065, 0.002]} />
              <meshBasicMaterial color="#e09060" wireframe />
            </mesh>
            <Text position={[0, 0, 0.015]} fontSize={0.026} color="#ffffff" textAlign="center">
              BEGIN ADVENTURE →
            </Text>
          </group>
        </Interactive>
      </group>
    </group>
  );
};

export default XRUnboxingStage3D;
