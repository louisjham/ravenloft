import { useGLTF } from '@react-three/drei';
import { Group } from 'three';

// Set to false to load actual GLB models from public/models
// Use Vite environment variable to avoid hardcoding
export const DUMMY_MODE = (import.meta as any).env.VITE_DUMMY_MODE === 'true';

/**
 * Model paths for game assets.
 * All models are located in public/models/ directory.
 */
export const MODELS = {
  // Heroes - mapped by hero class
  HERO_FIGHTER: '/models/arjhan.glb',      // Arjhan (Dragonborn Fighter)
  HERO_WIZARD: '/models/immeril.glb',      // Immeril (Eladrin Wizard)
  HERO_ROGUE: '/models/kat.glb',           // Kat (Human Rogue)
  HERO_CLERIC: '/models/thorgrim.glb',     // Thorgrim (Dwarf Cleric)
  HERO_RANGER: '/models/alissa.glb',       // Alanni/Alissa (Human Ranger)
  
  // Monsters - mapped by monster type
  MONSTER_SKELETON: '/models/burning_skeleton.glb',
  MONSTER_WOLF: '/models/dire_wolf.glb',
  MONSTER_DRACOLICH: '/models/dracolich.glb',
  MONSTER_FLESH_GOLEM: '/models/flesh_golem.glb',
  MONSTER_GARGOYLE: '/models/gargoyle.glb',
  MONSTER_SPIDER: '/models/giantspider.glb',
  MONSTER_HAG: '/models/hag.glb',
  MONSTER_KNIGHT: '/models/knight.glb',
  MONSTER_WRAITH: '/models/wraith.glb',
  MONSTER_ZOMBIE: '/models/zombie.glb',
  MONSTER_GOBLIN: '/models/goblin.glb',
  MONSTER_GHOUL: '/models/ghoul.glb',
  MONSTER_KOBOLD: '/models/kobold.glb',
  MONSTER_NECROMANCER: '/models/necromancer.glb',
  MONSTER_WEREWOLF: '/models/werewolf.glb',
  MONSTER_YOUNG_VAMPIRE: '/models/youngvampire.glb',
  MONSTER_VAMPIRE_LORD: '/models/vampirelord.glb',
  MONSTER_TROLL: '/models/troll.glb',
  MONSTER_ZOMBIE_DRAGON: '/models/zombiedragon.glb',
  
  // Newly added monster models
  MONSTER_DARK_ACOLYTE: '/models/darkacolyte.glb',
  MONSTER_GRAVEHOUND: '/models/gravehound.glb',
  MONSTER_MUMMY: '/models/mummy.glb',
  MONSTER_SKELETAL_ARCHER: '/models/skeletonarcher.glb',
  MONSTER_SKULL_LORD: '/models/skulllord.glb',
  MONSTER_VAMPIRE_BAT: '/models/vampirebat.glb',

  // Villains
  VILLAIN_STRAHD: '/models/strahd.glb',
  
  // Environment props
  ENV_BRICK_WALL: '/models/brick_wall.glb',
  ENV_TABLE: '/models/stylized_low-poly_wood_table.glb',
  ENV_TORCH: '/models/torch.glb',
  ENV_TORCH_ALT: '/models/torch (1).glb',

  // Objects (not yet created - will use placeholders)
  D20: null,  // No d20 model yet - component will use placeholder
  TILE: null,  // No tile model yet - using procedural geometry
  
  // Fallback for unmapped monsters (use knight as generic humanoid)
  MONSTER_GENERIC: '/models/knight.glb',
} as const;

/**
 * Maps hero class to model path
 */
export function getHeroModelPath(heroClass: string): string {
  const classMap: Record<string, string> = {
    'fighter': MODELS.HERO_FIGHTER,
    'wizard': MODELS.HERO_WIZARD,
    'rogue': MODELS.HERO_ROGUE,
    'cleric': MODELS.HERO_CLERIC,
    'ranger': MODELS.HERO_RANGER,
  };
  return classMap[heroClass.toLowerCase()] || MODELS.HERO_FIGHTER;
}

/**
 * Maps monster ID to model path
 */
export function getMonsterModelPath(monsterId: string): string {
  const monsterMap: Record<string, string> = {
    'monster_skeleton': MODELS.MONSTER_SKELETON,
    'monster_zombie': MODELS.MONSTER_ZOMBIE,
    'monster_wolf': MODELS.MONSTER_WOLF,
    'monster_gargoyle': MODELS.MONSTER_GARGOYLE,
    'monster_spider': MODELS.MONSTER_SPIDER,
    'monster_wraith': MODELS.MONSTER_WRAITH,
    'monster_ghost': MODELS.MONSTER_WRAITH, // Wraith can serve as ghost
    'monster_dracolich': MODELS.MONSTER_DRACOLICH,
    'monster_gravestorm': MODELS.MONSTER_DRACOLICH,
    'monster_flesh_golem': MODELS.MONSTER_FLESH_GOLEM,
    'monster_hag': MODELS.MONSTER_HAG,
    'monster_howling_hag': MODELS.MONSTER_HAG,
    'monster_strahd': MODELS.VILLAIN_STRAHD,
    'monster_vampire': MODELS.MONSTER_YOUNG_VAMPIRE,
    'monster_vampire_lord': MODELS.MONSTER_VAMPIRE_LORD,
    'monster_young_vampire': MODELS.MONSTER_YOUNG_VAMPIRE,
    'monster_goblin': MODELS.MONSTER_GOBLIN,
    'monster_ghoul': MODELS.MONSTER_GHOUL,
    'monster_ghast': MODELS.MONSTER_GHOUL,
    'monster_kobold': MODELS.MONSTER_KOBOLD,
    'monster_kobold_sorcerer': MODELS.MONSTER_KOBOLD,
    'monster_necromancer': MODELS.MONSTER_NECROMANCER,
    'monster_werewolf': MODELS.MONSTER_WEREWOLF,
    'monster_werewolf_lord': MODELS.MONSTER_WEREWOLF,
    'monster_troll': MODELS.MONSTER_TROLL,
    'monster_zombie_dragon': MODELS.MONSTER_ZOMBIE_DRAGON,
    'monster_dragon': MODELS.MONSTER_ZOMBIE_DRAGON, // Can use zombie dragon for regular dragon
    'monster_young_red_dragon': MODELS.MONSTER_ZOMBIE_DRAGON,
    'villain_dragon': MODELS.MONSTER_ZOMBIE_DRAGON,
    'villain_young_red_dragon': MODELS.MONSTER_ZOMBIE_DRAGON,
    'monster_gravestorms_phylactery': MODELS.MONSTER_GARGOYLE, // Fallback for phylactery until specific token
    'monster_klak': MODELS.MONSTER_KOBOLD, // Fallback for Klak
    'villain_klak': MODELS.MONSTER_KOBOLD,
    'monster_gravehound': MODELS.MONSTER_GRAVEHOUND,
    'monster_dark_acolyte': MODELS.MONSTER_DARK_ACOLYTE,
    'monster_skeletal_archer': MODELS.MONSTER_SKELETAL_ARCHER,
    'monster_mummy': MODELS.MONSTER_MUMMY,
    'monster_skull_lord': MODELS.MONSTER_SKULL_LORD,
    'monster_vampire_bat': MODELS.MONSTER_VAMPIRE_BAT,
    'monster_dire_bat': MODELS.MONSTER_VAMPIRE_BAT,
    'monster_klaks_artifact': MODELS.MONSTER_GARGOYLE, // Fallback for artifact
    'monster_gargoyle_lord': MODELS.MONSTER_GARGOYLE,
    'monster_vampire_dire_wolf': MODELS.MONSTER_WOLF,
    'monster_spectre': MODELS.MONSTER_WRAITH,
    'monster_specter': MODELS.MONSTER_WRAITH,
    'monster_banshee': MODELS.MONSTER_WRAITH,
    'monster_trap_haunt': MODELS.MONSTER_WRAITH,
    'monster_blazing_skeleton': MODELS.MONSTER_SKELETON,
    'monster_zombie_hulk': MODELS.MONSTER_ZOMBIE,
    'spider': MODELS.MONSTER_SPIDER,
    'wolf': MODELS.MONSTER_WOLF,
    'skeleton': MODELS.MONSTER_SKELETON,
    'gravestorm': MODELS.MONSTER_DRACOLICH,
    'villain_gravestorm': MODELS.MONSTER_DRACOLICH,
  };

  const idLower = monsterId.toLowerCase();
  
  // Exact match wins
  if (monsterMap[idLower]) return monsterMap[idLower];
  
  // Prefix fallback: sort by length descending so longer keys match first
  const prefixMatch = Object.keys(monsterMap)
    .sort((a, b) => b.length - a.length)
    .find(key => idLower.startsWith(key + '_'));
    
  return prefixMatch ? monsterMap[prefixMatch] : MODELS.MONSTER_GENERIC;
}

/**
 * Hook to load a model with pre-caching via useGLTF.
 * This hook will suspend while the model is loading.
 */
export function useModel(path: string): Group {
  const { scene } = useGLTF(path);
  return scene as Group;
}

export function useOptionalModel(path: string | undefined | null): Group | null {
  if (!path) return null;
  const { scene } = useGLTF(path);
  return scene as Group;
}

/**
 * Preloads major game models.
 */
export function preloadModels() {
  if (DUMMY_MODE) {
    console.log('[ModelLoader] DUMMY_MODE active, skipping model preload');
    return;
  }
  const paths = (Object.values(MODELS) as (string | null)[])
    .filter((path): path is string => typeof path === 'string');
  console.log(`[ModelLoader] Preloading ${paths.length} models...`);
  paths.forEach((path) => {
    try {
      useGLTF.preload(path);
    } catch (err) {
      console.warn(`[ModelLoader] Failed to preload model: ${path}`, err);
    }
  });
}
