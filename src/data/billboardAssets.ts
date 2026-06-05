export type BillboardCategory = 'hero' | 'monster' | 'villain';

export interface BillboardAsset {
  id: string;
  name: string;
  category: BillboardCategory;
  imagePath: string;
}

export const BILLBOARD_ASSETS: BillboardAsset[] = [
  {
    id: 'hero_cleric',
    name: 'Cleric',
    category: 'hero',
    imagePath: '/assets/billboards/heroes/Hero_Cleric.png',
  },
  {
    id: 'hero_fighter',
    name: 'Fighter',
    category: 'hero',
    imagePath: '/assets/billboards/heroes/Hero_Fighter.png',
  },
  {
    id: 'hero_ranger',
    name: 'Ranger',
    category: 'hero',
    imagePath: '/assets/billboards/heroes/Hero_Ranger.png',
  },
  {
    id: 'hero_rogue',
    name: 'Rogue',
    category: 'hero',
    imagePath: '/assets/billboards/heroes/Hero_Rogue.png',
  },
  {
    id: 'hero_wizard',
    name: 'Wizard',
    category: 'hero',
    imagePath: '/assets/billboards/heroes/Hero_Wizard.png',
  },
  {
    id: 'monster_blazing_skeleton',
    name: 'Blazing Skeleton',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_BlazingSkeleton.png',
  },
  {
    id: 'monster_gargoyle',
    name: 'Gargoyle',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_Gargoyle.png',
  },
  {
    id: 'monster_ghoul',
    name: 'Ghoul',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_Ghoul.png',
  },
  {
    id: 'monster_kobold',
    name: 'Kobold Skirmisher',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_KoboldSkirmisher.png',
  },
  {
    id: 'monster_rat_swarm',
    name: 'Rat Swarm',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_RatSwarm.png',
  },
  {
    id: 'monster_skeleton',
    name: 'Skeleton',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_Skeleton.png',
  },
  {
    id: 'monster_spider',
    name: 'Spider',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_Spider.png',
  },
  {
    id: 'monster_wolf',
    name: 'Wolf',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_Wolf.png',
  },
  {
    id: 'monster_wraith',
    name: 'Wraith',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_Wraith.png',
  },
  {
    id: 'monster_zombie',
    name: 'Zombie',
    category: 'monster',
    imagePath: '/assets/billboards/monsters/Monster_Zombie.png',
  },
  {
    id: 'villain_flesh_golem',
    name: 'Flesh Golem',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_FleshGolem.png',
  },
  {
    id: 'villain_gravestorm',
    name: 'Gravestorm',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_Gravestorm.png',
  },
  {
    id: 'villain_howling_hag',
    name: 'Howling Hag',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_HowlingHag.png',
  },
  {
    id: 'villain_klak',
    name: 'Klak',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_Klak.png',
  },
  {
    id: 'villain_strahd',
    name: 'Count Strahd',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_Strahd.png',
  },
  {
    id: 'villain_werewolf',
    name: 'Werewolf',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_Werewolf.png',
  },
  {
    id: 'villain_young_vampire',
    name: 'Young Vampire',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_YoungVampire.png',
  },
  {
    id: 'villain_zombie_dragon',
    name: 'Zombie Dragon',
    category: 'villain',
    imagePath: '/assets/billboards/villains/Villain_ZombieDragon.png',
  },
];

export const getBillboardAsset = (id: string): BillboardAsset | undefined => {
  return BILLBOARD_ASSETS.find(asset => asset.id === id);
};

export const getBillboardsByCategory = (category: BillboardCategory): BillboardAsset[] => {
  return BILLBOARD_ASSETS.filter(asset => asset.category === category);
};

export const getHeroAssets = (): BillboardAsset[] => getBillboardsByCategory('hero');
export const getMonsterAssets = (): BillboardAsset[] => getBillboardsByCategory('monster');
export const getVillainAssets = (): BillboardAsset[] => getBillboardsByCategory('villain');
