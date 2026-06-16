export interface PhysicsProfile {
  mass: number;
  friction: number;
  restitution: number;     // Bounciness
  impulseMultiplier: number;
  dropHeight: number;
}

export interface DiceProfile {
  color: string;
  particleEffect: 'fire' | 'lightning' | 'bones' | 'arcane' | 'toxic' | 'divine' | 'shadow';
  physics: PhysicsProfile;
}

export const DEFAULT_HERO_PHYSICS: PhysicsProfile = {
  mass: 1,
  friction: 0.4,
  restitution: 0.15,
  impulseMultiplier: 1.5,
  dropHeight: 0.6,
};

const HEAVY_VILLAIN_PHYSICS: PhysicsProfile = {
  mass: 2.5,
  friction: 0.5,
  restitution: 0.1, // Heavy, thudding
  impulseMultiplier: 1.0,
  dropHeight: 0.5,
};

const LIGHT_MINION_PHYSICS: PhysicsProfile = {
  mass: 0.5,
  friction: 0.3,
  restitution: 0.2, // Less bouncy, faster settle
  impulseMultiplier: 1.8,
  dropHeight: 0.7,
};

const PROFILES: Record<string, DiceProfile> = {
  // Heroes
  'arjhan': {
    color: '#cc1111', // Ruby Red
    particleEffect: 'divine',
    physics: DEFAULT_HERO_PHYSICS,
  },
  'thorgrim': {
    color: '#b8860b', // Dark Goldenrod
    particleEffect: 'divine',
    physics: { ...DEFAULT_HERO_PHYSICS, mass: 1.5, restitution: 0.3 },
  },
  'kat': {
    color: '#2e8b57', // Sea Green
    particleEffect: 'arcane',
    physics: { ...DEFAULT_HERO_PHYSICS, mass: 0.8, restitution: 0.5 },
  },
  'allisa': {
    color: '#4169e1', // Royal Blue
    particleEffect: 'arcane',
    physics: DEFAULT_HERO_PHYSICS,
  },
  
  // Villains & Bosses
  'klak': {
    color: '#ff4500', // Orange Red
    particleEffect: 'fire',
    physics: HEAVY_VILLAIN_PHYSICS,
  },
  'strahd': {
    color: '#4b0082', // Indigo/Dark Purple
    particleEffect: 'shadow',
    physics: { ...HEAVY_VILLAIN_PHYSICS, dropHeight: 0.8 },
  },
  'zombie_dragon': {
    color: '#556b2f', // Dark Olive Green
    particleEffect: 'toxic',
    physics: { ...HEAVY_VILLAIN_PHYSICS, mass: 4, restitution: 0.1 },
  },

  // Generic Monsters
  'skeleton': {
    color: '#f5f5dc', // Beige/Bone
    particleEffect: 'bones',
    physics: LIGHT_MINION_PHYSICS,
  },
  'zombie': {
    color: '#6b8e23', // Olive Drab
    particleEffect: 'toxic',
    physics: { ...LIGHT_MINION_PHYSICS, restitution: 0.2 },
  },
  'wraith': {
    color: '#483d8b', // Dark Slate Blue
    particleEffect: 'shadow',
    physics: { ...LIGHT_MINION_PHYSICS, mass: 0.3, restitution: 0.7, dropHeight: 0.8 },
  },
  'spider': {
    color: '#800080', // Purple
    particleEffect: 'toxic',
    physics: LIGHT_MINION_PHYSICS,
  },
  'wolf': {
    color: '#696969', // Dim Gray
    particleEffect: 'bones',
    physics: LIGHT_MINION_PHYSICS,
  },
};

const DEFAULT_PROFILE: DiceProfile = {
  color: '#888888',
  particleEffect: 'fire',
  physics: DEFAULT_HERO_PHYSICS,
};

export function getEntityDiceProfile(entityId: string | null, entityName: string, rollType: string | null): DiceProfile {
  // Try to match by exact ID or name substring
  const searchStr = `${entityId || ''} ${entityName}`.toLowerCase();
  
  for (const [key, profile] of Object.entries(PROFILES)) {
    if (searchStr.includes(key)) {
      return profile;
    }
  }

  // Fallbacks based on roll type
  if (rollType === 'trap_disable') {
    return {
      color: '#c0c0c0', // Silver
      particleEffect: 'arcane',
      physics: DEFAULT_HERO_PHYSICS,
    };
  }
  
  return DEFAULT_PROFILE;
}
