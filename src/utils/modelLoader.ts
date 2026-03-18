import { useGLTF } from '@react-three/drei';
import { Group } from 'three';

/**
 * Registry for model paths used in the game.
 * In a real production environment, these would point to public/models/*.glb files.
 * For now, we'll use placehoders or return null if not found.
 */
export const MODELS = {
  HERO_PALADIN: '/models/heroes/paladin.glb',
  HERO_WIZARD: '/models/heroes/wizard.glb',
  HERO_ROGUE: '/models/heroes/rogue.glb',
  HERO_CLERIC: '/models/heroes/cleric.glb',
  HERO_RANGER: '/models/heroes/ranger.glb',
  MONSTER_GARGOYLE: '/models/monsters/gargoyle.glb',
  MONSTER_GOBLIN: '/models/monsters/goblin.glb',
  MONSTER_ZOMBIE: '/models/monsters/zombie.glb',
  MONSTER_SKELETON: '/models/monsters/skeleton.glb',
  MONSTER_WOLF: '/models/monsters/wolf.glb',
  TILE_CORRIDOR: '/models/tiles/corridor.glb',
  D20: '/models/dice/d20.glb',
};

// Set to true to use procedural placeholders instead of failing to load missing GLB files
export const DUMMY_MODE = true;

/**
 * Hook to load a model with pre-caching via useGLTF.
 * This hook will suspend while the model is loading.
 */
export function useModel(path: string): Group {
  if (DUMMY_MODE) {
    // Return an empty group in dummy mode to let components use their fallbacks or render nothing
    return new Group();
  }
  const { scene } = useGLTF(path);
  return scene as Group;
}

/**
 * Preloads major game models.
 */
export function preloadModels() {
  if (DUMMY_MODE) return;
  Object.values(MODELS).forEach((path) => {
    useGLTF.preload(path);
  });
}
