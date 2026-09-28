import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const HERO_MODELS = [
  '/models/arjhan.glb',
  '/models/kat.glb',
  '/models/thorgrim.glb',
  '/models/immeril.glb',
  '/models/alissa.glb',
];

const MONSTER_MODELS = [
  '/models/strahd.glb',
  '/models/dracolich.glb',
  '/models/flesh_golem.glb',
  '/models/werewolf.glb',
  '/models/gargoyle.glb',
  '/models/skeletonarcher.glb',
  '/models/zombie.glb',
  '/models/dire_wolf.glb',
  '/models/giantspider.glb',
  '/models/ghoul.glb',
  '/models/wraith.glb',
  '/models/kobold.glb',
];

const CORE_TEXTURES = [
  '/ui/box_art.webp',
  '/assets/tiles/StartTile.png',
  '/assets/tiles/Tile_Back.png',
  '/assets/tiles/Crypt_StrahdsCrypt.png',
  '/assets/tiles/Named_Chapel.png',
  '/assets/tokens/Token_Misc_HP1.png',
  '/assets/tokens/Token_Misc_HP1Back.png',
  '/assets/tokens/Token_Misc_HealingSurge.png',
  '/assets/tokens/Token_Misc_CoffinStrahd.png',
  '/assets/tokens/Token_Misc_CoffinBack.png',
];

/**
 * Preloads critical 3D GLTF assets and key textures into Three.js cache
 * during idle time to prevent frame drops during gameplay and WebXR transitions.
 */
export function preloadAssets(): void {
  if (typeof window === 'undefined') return;

  // Preload hero models
  HERO_MODELS.forEach((url) => {
    try {
      useGLTF.preload(url);
    } catch {
      // ignore
    }
  });

  // Preload monster models
  MONSTER_MODELS.forEach((url) => {
    try {
      useGLTF.preload(url);
    } catch {
      // ignore
    }
  });

  // Preload core textures via TextureLoader in background
  const loader = new THREE.TextureLoader();
  CORE_TEXTURES.forEach((url) => {
    try {
      loader.load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
      });
    } catch {
      // ignore
    }
  });
}
